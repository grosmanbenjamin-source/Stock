from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

JWT_ALGORITHM = "HS256"
ATELIER_ID = "atelier"


def local_today():
    return datetime.now(ZoneInfo("Europe/Paris")).date().isoformat()


def nf(h: int) -> str:
    return f"{h / 2:g}".replace(".", ",")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "Non authentifié")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Jeton invalide")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")
    return user


# ---------- Models ----------
class LoginIn(BaseModel):
    email: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class PosIn(BaseModel):
    name: str = Field(min_length=1)
    alert_threshold: float = Field(default=0, ge=0)


class SupplyIn(BaseModel):
    quantity: int = Field(gt=0)
    note: Optional[str] = ""


class TransferIn(BaseModel):
    from_id: str
    to_id: str
    quantity: float = Field(gt=0)
    note: Optional[str] = ""


class SaleItem(BaseModel):
    pos_id: str
    whole: int = Field(ge=0)
    halves: int = Field(ge=0)


class SalesIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    items: List[SaleItem]


class AdjustIn(BaseModel):
    location_id: str
    new_stock: float = Field(ge=0)
    note: Optional[str] = ""


def to_halves(q: float) -> int:
    h = q * 2
    if abs(h - round(h)) > 1e-9:
        raise HTTPException(400, "La quantité doit être un multiple de 0,5")
    return int(round(h))


def loc_out(loc: dict) -> dict:
    return {"id": loc["id"], "name": loc["name"], "type": loc["type"],
            "stock": loc["stock_halves"] / 2, "alert_threshold": loc.get("alert_threshold", 0),
            "active": loc.get("active", True)}


async def get_loc(loc_id: str) -> dict:
    loc = await db.locations.find_one({"id": loc_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not loc:
        raise HTTPException(404, "Emplacement introuvable")
    return loc


async def take(loc_id: str, halves: int):
    res = await db.locations.find_one_and_update(
        {"id": loc_id, "stock_halves": {"$gte": halves}}, {"$inc": {"stock_halves": -halves}})
    if not res:
        loc = await get_loc(loc_id)
        raise HTTPException(400, f"Stock insuffisant à « {loc['name']} » ({nf(loc['stock_halves'])} disponible)")


async def give(loc_id: str, halves: int):
    await db.locations.update_one({"id": loc_id}, {"$inc": {"stock_halves": halves}})


async def log_movement(mtype: str, halves: int, from_loc=None, to_loc=None, note="", date=None, extra=None):
    doc = {"id": str(uuid.uuid4()), "type": mtype, "quantity_halves": halves,
           "from_id": from_loc["id"] if from_loc else None, "from_name": from_loc["name"] if from_loc else None,
           "to_id": to_loc["id"] if to_loc else None, "to_name": to_loc["name"] if to_loc else None,
           "note": note or "", "date": date or local_today(),
           "created_at": now_iso(), **(extra or {})}
    await db.movements.insert_one(dict(doc))
    return mov_out(doc)


def mov_out(m: dict) -> dict:
    out = {k: v for k, v in m.items() if k != "_id"}
    out["quantity"] = m["quantity_halves"] / 2
    return out


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    ident = email
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att or {}).get("count", 0) + 1
        upd = {"count": count}
        if count >= 5:
            upd["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(401, "Email ou mot de passe incorrect")
    await db.login_attempts.delete_many({"identifier": ident})
    return {"token": create_token(user["id"], email),
            "user": {"id": user["id"], "email": email, "name": user.get("name", "Admin")}}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


# ---------- Locations ----------
@api.get("/overview")
async def overview(user=Depends(current_user)):
    locs = await db.locations.find({"deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    atelier = next(loc_out(l) for l in locs if l["type"] == "atelier")
    pos = [loc_out(l) for l in locs if l["type"] == "pos"]
    today = local_today()
    sales = await db.movements.find({"type": "sale", "date": today, "cancelled": {"$ne": True}}, {"_id": 0}).to_list(2000)
    sold = {}
    for s in sales:
        sold[s["from_id"]] = sold.get(s["from_id"], 0) + s["quantity_halves"]
    for p in pos:
        p["sold_today"] = sold.get(p["id"], 0) / 2
    total_pos = sum(p["stock"] for p in pos)
    return {"atelier": atelier, "pos": pos, "total_pos_stock": total_pos,
            "total_stock": total_pos + atelier["stock"], "sold_today": sum(p["sold_today"] for p in pos)}


@api.post("/pos")
async def create_pos(body: PosIn, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "name": body.name.strip(), "type": "pos", "stock_halves": 0,
           "alert_threshold": body.alert_threshold, "active": True, "created_at": now_iso()}
    await db.locations.insert_one(dict(doc))
    return loc_out(doc)


@api.put("/pos/{pos_id}")
async def update_pos(pos_id: str, body: PosIn, user=Depends(current_user)):
    loc = await get_loc(pos_id)
    if loc["type"] != "pos":
        raise HTTPException(400, "Impossible de modifier l'atelier")
    await db.locations.update_one({"id": pos_id}, {"$set": {"name": body.name.strip(), "alert_threshold": body.alert_threshold}})
    return loc_out(await get_loc(pos_id))


@api.delete("/pos/{pos_id}")
async def delete_pos(pos_id: str, user=Depends(current_user)):
    loc = await get_loc(pos_id)
    if loc["type"] != "pos":
        raise HTTPException(400, "Impossible de supprimer l'atelier")
    if loc["stock_halves"] > 0:
        raise HTTPException(400, "Videz d'abord le stock de ce point de vente (transfert vers l'atelier)")
    await db.locations.update_one({"id": pos_id}, {"$set": {"deleted": True}})
    return {"ok": True}


# ---------- Stock operations ----------
@api.post("/supply")
async def supply(body: SupplyIn, user=Depends(current_user)):
    atelier = await get_loc(ATELIER_ID)
    halves = body.quantity * 2
    await give(ATELIER_ID, halves)
    return await log_movement("supply", halves, to_loc=atelier, note=body.note)


@api.post("/transfer")
async def transfer(body: TransferIn, user=Depends(current_user)):
    if body.from_id == body.to_id:
        raise HTTPException(400, "Choisissez deux emplacements différents")
    src, dst = await get_loc(body.from_id), await get_loc(body.to_id)
    halves = to_halves(body.quantity)
    await take(src["id"], halves)
    await give(dst["id"], halves)
    mtype = "distribution" if src["type"] == "atelier" else ("return" if dst["type"] == "atelier" else "transfer")
    return await log_movement(mtype, halves, from_loc=src, to_loc=dst, note=body.note)


@api.post("/sales")
async def record_sales(body: SalesIn, user=Depends(current_user)):
    items = [i for i in body.items if i.whole + i.halves > 0]
    if not items:
        raise HTTPException(400, "Aucune vente saisie")
    merged = {}
    for i in items:
        m = merged.setdefault(i.pos_id, {"whole": 0, "halves": 0})
        m["whole"] += i.whole
        m["halves"] += i.halves
    locs = {}
    for pos_id, m in merged.items():
        loc = await get_loc(pos_id)
        need = m["whole"] * 2 + m["halves"]
        if loc["type"] != "pos":
            raise HTTPException(400, "Les ventes se saisissent sur un point de vente")
        if loc["stock_halves"] < need:
            raise HTTPException(400, f"Stock insuffisant à « {loc['name']} » ({nf(loc['stock_halves'])} disponible, {nf(need)} vendu)")
        locs[pos_id] = loc
    out = []
    for pos_id, m in merged.items():
        need = m["whole"] * 2 + m["halves"]
        await take(pos_id, need)
        out.append(await log_movement("sale", need, from_loc=locs[pos_id], date=body.date, extra=m))
    return out


@api.post("/adjust")
async def adjust(body: AdjustIn, user=Depends(current_user)):
    loc = await get_loc(body.location_id)
    new_h = to_halves(body.new_stock)
    diff = new_h - loc["stock_halves"]
    if diff == 0:
        raise HTTPException(400, "Le stock est déjà à cette valeur")
    await db.locations.update_one({"id": loc["id"]}, {"$set": {"stock_halves": new_h}})
    return await log_movement("adjustment", abs(diff), to_loc=loc if diff > 0 else None,
                              from_loc=loc if diff < 0 else None, note=body.note,
                              extra={"before": loc["stock_halves"] / 2, "after": new_h / 2})


# ---------- Movements & reports ----------
@api.get("/movements")
async def movements(type: Optional[str] = None, location_id: Optional[str] = None,
                    date_from: Optional[str] = None, date_to: Optional[str] = None,
                    user=Depends(current_user)):
    q = {"cancelled": {"$ne": True}}
    if type:
        q["type"] = type
    if location_id:
        q["$or"] = [{"from_id": location_id}, {"to_id": location_id}]
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    docs = await db.movements.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [mov_out(d) for d in docs]


@api.delete("/movements/{mov_id}")
async def cancel_movement(mov_id: str, user=Depends(current_user)):
    m = await db.movements.find_one({"id": mov_id, "cancelled": {"$ne": True}}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Mouvement introuvable")
    h = m["quantity_halves"]
    for lid in (m["from_id"], m["to_id"]):
        if lid:
            await get_loc(lid)
    if m["to_id"]:
        await take(m["to_id"], h)
    if m["from_id"]:
        await give(m["from_id"], h)
    await db.movements.update_one({"id": mov_id}, {"$set": {"cancelled": True, "cancelled_at": now_iso()}})
    return {"ok": True}


@api.get("/report/daily")
async def daily_report(date: str, user=Depends(current_user)):
    pos = await db.locations.find({"type": "pos", "deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    sales = await db.movements.find({"type": "sale", "date": date, "cancelled": {"$ne": True}}, {"_id": 0}).to_list(2000)
    rows = []
    for p in pos:
        mine = [s for s in sales if s["from_id"] == p["id"]]
        rows.append({"pos_id": p["id"], "name": p["name"], "stock": p["stock_halves"] / 2,
                     "whole": sum(s.get("whole", 0) for s in mine),
                     "halves": sum(s.get("halves", 0) for s in mine),
                     "total": sum(s["quantity_halves"] for s in mine) / 2,
                     "entries": [mov_out(s) for s in mine]})
    return {"date": date, "rows": rows, "total": sum(r["total"] for r in rows)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.locations.create_index("id", unique=True)
    await db.movements.create_index("id", unique=True)
    await db.movements.create_index([("type", 1), ("date", 1)])
    email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": email}):
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "name": "Admin", "role": "admin",
                                   "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]), "created_at": now_iso()})
    if not await db.locations.find_one({"id": ATELIER_ID}):
        await db.locations.insert_one({"id": ATELIER_ID, "name": "Atelier", "type": "atelier", "stock_halves": 0,
                                       "alert_threshold": 0, "active": True, "created_at": "0"})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# VolailleStock regression tests: auth, POS CRUD, supply, distribution, transfers (halves), sales, adjust, movements/cancel
import os
import uuid
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "grosman.benjamin@gmail.com"
PASSWORD = "Poulet-f1xqDWp6"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def ov(c):
    return c.get(f"{BASE_URL}/api/overview").json()


def stock_of(c, loc_id):
    d = ov(c)
    if loc_id == "atelier":
        return d["atelier"]["stock"]
    return next(p["stock"] for p in d["pos"] if p["id"] == loc_id)


@pytest.fixture(scope="module")
def setup(client):
    atelier_before = stock_of(client, "atelier")
    a = client.post(f"{BASE_URL}/api/pos", json={"name": "TEST_PosA", "alert_threshold": 2}).json()
    b = client.post(f"{BASE_URL}/api/pos", json={"name": "TEST_PosB"}).json()
    yield {"a": a["id"], "b": b["id"], "atelier_before": atelier_before}
    for pid in (a["id"], b["id"]):
        client.post(f"{BASE_URL}/api/adjust", json={"location_id": pid, "new_stock": 0})
        client.delete(f"{BASE_URL}/api/pos/{pid}")
    if stock_of(client, "atelier") != atelier_before:
        client.post(f"{BASE_URL}/api/adjust", json={"location_id": "atelier", "new_stock": atelier_before})


# --- Auth
class TestAuth:
    def test_login_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL.upper(), "password": PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and d["user"]["email"] == EMAIL

    def test_login_wrong(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "bad"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Email ou mot de passe incorrect"

    def test_protected_no_token(self):
        for path in ["/api/overview", "/api/movements", "/api/auth/me"]:
            assert requests.get(f"{BASE_URL}{path}").status_code == 401

    def test_me(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == EMAIL and "password_hash" not in r.json() and "_id" not in r.json()

    def test_bruteforce_lockout(self):
        em = f"test_lock_{uuid.uuid4().hex[:6]}@x.com"
        codes = [requests.post(f"{BASE_URL}/api/auth/login", json={"email": em, "password": "x"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429


# --- POS CRUD
class TestPos:
    def test_create_edit(self, client, setup):
        r = client.put(f"{BASE_URL}/api/pos/{setup['a']}", json={"name": "TEST_PosA2", "alert_threshold": 3})
        assert r.status_code == 200 and r.json()["name"] == "TEST_PosA2"
        p = next(p for p in ov(client)["pos"] if p["id"] == setup["a"])
        assert p["name"] == "TEST_PosA2" and p["alert_threshold"] == 3 and p["stock"] == 0

    def test_cannot_delete_atelier(self, client):
        assert client.delete(f"{BASE_URL}/api/pos/atelier").status_code == 400

    def test_delete_empty_pos(self, client):
        p = client.post(f"{BASE_URL}/api/pos", json={"name": "TEST_Del"}).json()
        assert client.delete(f"{BASE_URL}/api/pos/{p['id']}").status_code == 200
        assert all(x["id"] != p["id"] for x in ov(client)["pos"])
        assert client.delete(f"{BASE_URL}/api/pos/{p['id']}").status_code == 404


# --- Stock flow
class TestStockFlow:
    def test_supply(self, client, setup):
        before = stock_of(client, "atelier")
        r = client.post(f"{BASE_URL}/api/supply", json={"quantity": 20, "note": "TEST"})
        assert r.status_code == 200 and r.json()["quantity"] == 20 and r.json()["type"] == "supply"
        assert stock_of(client, "atelier") == before + 20

    def test_supply_invalid(self, client, setup):
        assert client.post(f"{BASE_URL}/api/supply", json={"quantity": 0}).status_code == 422
        assert client.post(f"{BASE_URL}/api/supply", json={"quantity": 2.5}).status_code == 422

    def test_distribute(self, client, setup):
        at = stock_of(client, "atelier")
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": "atelier", "to_id": setup["a"], "quantity": 10})
        assert r.status_code == 200 and r.json()["type"] == "distribution"
        assert stock_of(client, "atelier") == at - 10 and stock_of(client, setup["a"]) == 10

    def test_distribute_insufficient(self, client, setup):
        at = stock_of(client, "atelier")
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": "atelier", "to_id": setup["a"], "quantity": at + 100})
        assert r.status_code == 400 and "insuffisant" in r.json()["detail"]
        assert stock_of(client, "atelier") == at

    def test_transfer_halves(self, client, setup):
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": setup["a"], "to_id": setup["b"], "quantity": 2.5})
        assert r.status_code == 200 and r.json()["type"] == "transfer" and r.json()["quantity"] == 2.5
        assert stock_of(client, setup["a"]) == 7.5 and stock_of(client, setup["b"]) == 2.5

    def test_transfer_invalid(self, client, setup):
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": setup["a"], "to_id": setup["b"], "quantity": 1.3})
        assert r.status_code == 400 and "0,5" in r.json()["detail"]
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": setup["b"], "to_id": setup["a"], "quantity": 50})
        assert r.status_code == 400
        r = client.post(f"{BASE_URL}/api/transfer", json={"from_id": setup["a"], "to_id": setup["a"], "quantity": 1})
        assert r.status_code == 400
        assert stock_of(client, setup["a"]) == 7.5 and stock_of(client, setup["b"]) == 2.5

    def test_sales(self, client, setup):
        d = date.today().isoformat()
        r = client.post(f"{BASE_URL}/api/sales", json={"date": d, "items": [{"pos_id": setup["a"], "whole": 3, "halves": 3}]})
        assert r.status_code == 200 and r.json()[0]["quantity"] == 4.5
        assert stock_of(client, setup["a"]) == 3
        rep = client.get(f"{BASE_URL}/api/report/daily", params={"date": d}).json()
        row = next(x for x in rep["rows"] if x["pos_id"] == setup["a"])
        assert row["total"] == 4.5 and row["whole"] == 3 and row["halves"] == 3

    def test_sales_exceed(self, client, setup):
        r = client.post(f"{BASE_URL}/api/sales", json={"date": date.today().isoformat(),
                                                        "items": [{"pos_id": setup["a"], "whole": 3, "halves": 1}]})
        assert r.status_code == 400
        assert stock_of(client, setup["a"]) == 3

    def test_sales_empty(self, client, setup):
        r = client.post(f"{BASE_URL}/api/sales", json={"date": date.today().isoformat(), "items": [{"pos_id": setup["a"], "whole": 0, "halves": 0}]})
        assert r.status_code == 400

    def test_sales_duplicate_pos_atomicity(self, client, setup):
        # two items for same POS each within stock but sum exceeds -> should be rejected without partial deduction
        before = stock_of(client, setup["a"])
        r = client.post(f"{BASE_URL}/api/sales", json={"date": date.today().isoformat(), "items": [
            {"pos_id": setup["a"], "whole": 2, "halves": 0}, {"pos_id": setup["a"], "whole": 2, "halves": 0}]})
        after = stock_of(client, setup["a"])
        assert r.status_code == 400
        assert after == before, f"partial deduction: {before} -> {after}"

    def test_adjust(self, client, setup):
        r = client.post(f"{BASE_URL}/api/adjust", json={"location_id": setup["b"], "new_stock": 5.5, "note": "TEST"})
        assert r.status_code == 200 and r.json()["type"] == "adjustment" and r.json()["before"] == 2.5 and r.json()["after"] == 5.5
        assert stock_of(client, setup["b"]) == 5.5
        assert client.post(f"{BASE_URL}/api/adjust", json={"location_id": setup["b"], "new_stock": 5.5}).status_code == 400
        assert client.post(f"{BASE_URL}/api/adjust", json={"location_id": setup["b"], "new_stock": -1}).status_code == 422

    def test_delete_pos_with_stock_refused(self, client, setup):
        r = client.delete(f"{BASE_URL}/api/pos/{setup['b']}")
        assert r.status_code == 400

    def test_movements_filters_and_cancel(self, client, setup):
        ms = client.get(f"{BASE_URL}/api/movements", params={"location_id": setup["b"]}).json()
        assert len(ms) >= 2 and all(setup["b"] in (m["from_id"], m["to_id"]) for m in ms)
        tr = client.get(f"{BASE_URL}/api/movements", params={"type": "transfer", "location_id": setup["b"]}).json()
        assert len(tr) == 1 and tr[0]["quantity"] == 2.5
        d = date.today().isoformat()
        assert len(client.get(f"{BASE_URL}/api/movements", params={"date_from": "2000-01-01", "date_to": "2000-01-02"}).json()) == 0
        # cancel the latest adjustment on B (2.5 -> 5.5) -> back to 2.5
        adj = client.get(f"{BASE_URL}/api/movements", params={"type": "adjustment", "location_id": setup["b"]}).json()[0]
        assert client.delete(f"{BASE_URL}/api/movements/{adj['id']}").status_code == 200
        assert stock_of(client, setup["b"]) == 2.5
        assert client.delete(f"{BASE_URL}/api/movements/{adj['id']}").status_code == 404
        # cancel sale on A -> A back to 3 + 4.5 = 7.5
        sale = client.get(f"{BASE_URL}/api/movements", params={"type": "sale", "location_id": setup["a"], "date_from": d}).json()[0]
        assert client.delete(f"{BASE_URL}/api/movements/{sale['id']}").status_code == 200
        assert stock_of(client, setup["a"]) == 7.5

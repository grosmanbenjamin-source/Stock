import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { api, errMsg, fmt } from "../lib/api";

const PosForm = ({ initial, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || "");
  const [threshold, setThreshold] = useState(initial?.alert_threshold ?? 0);

  const submit = async (e) => {
    e.preventDefault();
    const body = { name, alert_threshold: Number(threshold) || 0 };
    try {
      if (initial) await api.put(`/pos/${initial.id}`, body);
      else await api.post("/pos", body);
      toast.success(initial ? "Point de vente modifié" : "Point de vente créé");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Modifier" : "Nouveau point de vente"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-11" data-testid="pos-name-input" />
          </div>
          <div className="space-y-2">
            <Label>Seuil d'alerte stock bas (0 = aucun)</Label>
            <Input type="number" min={0} step={0.5} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="h-11 font-num" data-testid="pos-threshold-input" />
          </div>
          <Button type="submit" className="w-full h-11 bg-[#2C4030] hover:bg-[#1C271E]" data-testid="pos-save-btn">Enregistrer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function PointsOfSale() {
  const [pos, setPos] = useState([]);
  const [editing, setEditing] = useState(undefined);

  const load = useCallback(() => {
    api.get("/overview").then((r) => setPos(r.data.pos));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (p) => {
    if (!window.confirm(`Supprimer « ${p.name} » ?`)) return;
    try {
      await api.delete(`/pos/${p.id}`);
      toast.success("Point de vente supprimé");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">Points de vente</h1>
        <Button onClick={() => setEditing(null)} className="h-11 rounded-full bg-[#C85A32] hover:bg-[#b34e2a]" data-testid="add-pos-btn">
          <Plus size={18} className="mr-1" /> Ajouter
        </Button>
      </div>
      <div className="rounded-2xl bg-white border border-[#E2DDD5] divide-y divide-[#E2DDD5]">
        {pos.length === 0 && <p className="p-8 text-center text-[#758277]" data-testid="pos-list-empty">Aucun point de vente pour l'instant.</p>}
        {pos.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3" data-testid={`pos-row-${p.id}`}>
            <div className="flex-1">
              <p className="font-display font-bold text-lg">{p.name}</p>
              <p className="text-xs text-[#758277]">Seuil d'alerte : {p.alert_threshold > 0 ? fmt(p.alert_threshold) : "aucun"}</p>
            </div>
            <p className="font-num font-bold text-xl">{fmt(p.stock)}</p>
            <button onClick={() => setEditing(p)} className="p-2 rounded-full hover:bg-[#EFECE6]" data-testid={`edit-pos-${p.id}`}><Pencil size={16} /></button>
            <button onClick={() => remove(p)} className="p-2 rounded-full hover:bg-[#FBE3D8] text-[#C85A32]" data-testid={`delete-pos-${p.id}`}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      {editing !== undefined && <PosForm initial={editing} onClose={() => setEditing(undefined)} onSaved={load} />}
    </div>
  );
}

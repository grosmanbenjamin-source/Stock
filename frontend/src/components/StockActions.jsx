import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api, errMsg, fmt } from "../lib/api";

const LocSelect = ({ value, onChange, locations, testid, placeholder }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testid} className="h-11"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {locations.map((l) => (
        <SelectItem key={l.id} value={l.id} data-testid={`${testid}-option-${l.id}`}>
          {l.name} — {fmt(l.stock)} en stock
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const CONFIG = {
  supply: { title: "Approvisionner l'atelier", desc: "Ajoutez les poulets entiers reçus cette semaine.", btn: "Ajouter au stock" },
  distribute: { title: "Distribuer vers un point de vente", desc: "Envoyez des poulets de l'atelier vers un point de vente.", btn: "Distribuer" },
  transfer: { title: "Transférer entre emplacements", desc: "Déplacez des poulets d'un point de vente à un autre (ou vers l'atelier).", btn: "Transférer" },
  adjust: { title: "Réajuster un stock", desc: "Corrigez le stock après comptage réel.", btn: "Réajuster" },
};

export const StockActionDialog = ({ mode, onClose, data, onDone }) => {
  const [from, setFrom] = useState(mode === "distribute" ? "atelier" : "");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const all = [data.atelier, ...data.pos];
  const cfg = CONFIG[mode];
  const step = mode === "supply" || mode === "distribute" ? 1 : 0.5;

  const submit = async (e) => {
    e.preventDefault();
    const q = Number(qty);
    setBusy(true);
    try {
      if (mode === "supply") await api.post("/supply", { quantity: q, note });
      else if (mode === "adjust") await api.post("/adjust", { location_id: to, new_stock: q, note });
      else await api.post("/transfer", { from_id: from, to_id: to, quantity: q, note });
      toast.success("Stock mis à jour");
      onDone();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const needTo = mode !== "supply";
  const invalid = !qty || (needTo && !to) || (mode === "transfer" && !from);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white sm:rounded-2xl" data-testid={`dialog-${mode}`}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.desc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {mode === "transfer" && (
            <div className="space-y-2">
              <Label>Depuis</Label>
              <LocSelect value={from} onChange={setFrom} locations={all} testid="select-from" placeholder="Choisir l'origine" />
            </div>
          )}
          {needTo && (
            <div className="space-y-2">
              <Label>{mode === "adjust" ? "Emplacement" : "Vers"}</Label>
              <LocSelect value={to} onChange={setTo} testid="select-to" placeholder="Choisir"
                locations={mode === "distribute" ? data.pos : mode === "adjust" ? all : all.filter((l) => l.id !== from)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>{mode === "adjust" ? "Stock réel compté" : "Nombre de poulets"}{step === 0.5 ? " (demis acceptés, ex : 3,5)" : " entiers"}</Label>
            <Input type="number" inputMode="decimal" min={mode === "adjust" ? 0 : step} step={step} value={qty}
              onChange={(e) => setQty(e.target.value)} className="h-12 text-lg font-num" data-testid="input-quantity" required />
          </div>
          <div className="space-y-2">
            <Label>Note (facultatif)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-note" />
          </div>
          <Button type="submit" disabled={busy || invalid} className="w-full h-12 bg-[#2C4030] hover:bg-[#1C271E] text-base" data-testid="submit-stock-action">
            {cfg.btn}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

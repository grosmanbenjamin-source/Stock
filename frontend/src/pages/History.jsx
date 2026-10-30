import { useCallback, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { api, errMsg, fmt, TYPE_LABELS } from "../lib/api";

const COLORS = {
  supply: "bg-[#E5EFE4] text-[#2C4030]",
  distribution: "bg-[#EFECE6] text-[#1A231C]",
  transfer: "bg-[#DCE7F3] text-[#1E3A5F]",
  return: "bg-[#EFECE6] text-[#4B554D]",
  sale: "bg-[#FBE3D8] text-[#9A3F1F]",
  adjustment: "bg-[#FEF3C7] text-[#92400E]",
};

const describe = (m) => {
  if (m.type === "supply") return `→ ${m.to_name}`;
  if (m.type === "sale") return `${m.from_name} · ${m.whole} entiers, ${m.halves} demis`;
  if (m.type === "adjustment") return `${m.to_name || m.from_name} · ${fmt(m.before)} → ${fmt(m.after)}`;
  return `${m.from_name} → ${m.to_name}`;
};

const sign = (m) => (m.type === "supply" || (m.type === "adjustment" && m.to_id) ? "+" : m.type === "sale" || m.type === "adjustment" ? "−" : "");

export default function History() {
  const [items, setItems] = useState([]);
  const [locs, setLocs] = useState([]);
  const [type, setType] = useState("all");
  const [loc, setLoc] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cancelId, setCancelId] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (type !== "all") params.type = type;
    if (loc !== "all") params.location_id = loc;
    if (from) params.date_from = from;
    if (to) params.date_to = to;
    api.get("/movements", { params }).then((r) => setItems(r.data));
  }, [type, loc, from, to]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api.get("/overview").then((r) => setLocs([r.data.atelier, ...r.data.pos]));
  }, []);

  const cancel = async () => {
    try {
      await api.delete(`/movements/${cancelId}`);
      toast.success("Mouvement annulé, stock rétabli");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
    setCancelId(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight rise">Historique</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="bg-white h-11" data-testid="filter-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={loc} onValueChange={setLoc}>
          <SelectTrigger className="bg-white h-11" data-testid="filter-location"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les emplacements</SelectItem>
            {locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white h-11" data-testid="filter-date-from" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white h-11" data-testid="filter-date-to" />
      </div>

      <div className="rounded-2xl bg-white border border-[#E2DDD5] divide-y divide-[#E2DDD5]" data-testid="movements-list">
        {items.length === 0 && <p className="p-8 text-center text-[#758277]" data-testid="movements-empty">Aucun mouvement.</p>}
        {items.map((m) => (
          <div key={m.id} className="p-4 flex items-center gap-3" data-testid={`movement-${m.id}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap ${COLORS[m.type]}`}>{TYPE_LABELS[m.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{describe(m)}</p>
              <p className="text-xs text-[#758277]">{new Date(m.date + "T12:00:00").toLocaleDateString("fr-FR")}{m.note ? ` · ${m.note}` : ""}</p>
            </div>
            <p className="font-num font-bold text-lg whitespace-nowrap">{sign(m)}{fmt(m.quantity)}</p>
            <button onClick={() => setCancelId(m.id)} title="Annuler" className="p-2 rounded-full hover:bg-[#EFECE6] text-[#758277]" data-testid={`cancel-movement-${m.id}`}>
              <Undo2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce mouvement ?</AlertDialogTitle>
            <AlertDialogDescription>Le stock sera remis comme avant ce mouvement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-movement-dismiss">Non</AlertDialogCancel>
            <AlertDialogAction onClick={cancel} className="bg-[#C85A32] hover:bg-[#b34e2a]" data-testid="cancel-movement-confirm">Oui, annuler</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

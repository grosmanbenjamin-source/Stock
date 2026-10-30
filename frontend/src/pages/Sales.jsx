import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { api, errMsg, fmt, today } from "../lib/api";

const Stepper = ({ value, onChange, label, testid }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider font-semibold text-[#758277] mb-1">{label}</p>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-11 h-11 rounded-xl bg-[#EFECE6] grid place-items-center active:scale-95 transition-transform" data-testid={`${testid}-minus`}><Minus size={16} /></button>
      <Input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
        className="w-16 h-11 text-center font-num text-lg" data-testid={testid} />
      <button type="button" onClick={() => onChange(value + 1)} className="w-11 h-11 rounded-xl bg-[#EFECE6] grid place-items-center active:scale-95 transition-transform" data-testid={`${testid}-plus`}><Plus size={16} /></button>
    </div>
  </div>
);

const SaleRow = ({ row, entry, setEntry }) => {
  const total = entry.whole + entry.halves / 2;
  const after = row.stock - total;
  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E2DDD5] flex flex-col md:flex-row md:items-center gap-4 md:justify-between" data-testid={`sales-row-${row.pos_id}`}>
      <div className="min-w-[160px]">
        <p className="font-display font-bold text-lg">{row.name}</p>
        <p className="text-sm text-[#4B554D]">Stock actuel : <span className="font-num font-bold">{fmt(row.stock)}</span></p>
        {row.total > 0 && <p className="text-sm text-[#2C4030]">Déjà saisi ce jour : <span className="font-num font-bold" data-testid={`sales-already-${row.pos_id}`}>{fmt(row.total)}</span> ({row.whole} entiers, {row.halves} demis)</p>}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Stepper label="Entiers vendus" value={entry.whole} onChange={(v) => setEntry({ ...entry, whole: v })} testid={`input-whole-${row.pos_id}`} />
        <Stepper label="Demis vendus" value={entry.halves} onChange={(v) => setEntry({ ...entry, halves: v })} testid={`input-half-${row.pos_id}`} />
        <div className="text-right min-w-[110px]">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#758277]">À déduire</p>
          <p className="font-num text-2xl font-extrabold text-[#C85A32]" data-testid={`sales-total-${row.pos_id}`}>{fmt(total)}</p>
          <p className={`text-xs ${after < 0 ? "text-red-600 font-bold" : "text-[#758277]"}`}>reste {fmt(after)}</p>
        </div>
      </div>
    </div>
  );
};

export default function Sales() {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/report/daily", { params: { date } }).then((r) => setReport(r.data));
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);

  const get = (id) => entries[id] || { whole: 0, halves: 0 };
  const grand = Object.values(entries).reduce((s, e) => s + e.whole + e.halves / 2, 0);

  const submit = async () => {
    const items = Object.entries(entries).map(([pos_id, e]) => ({ pos_id, ...e })).filter((i) => i.whole + i.halves > 0);
    setBusy(true);
    try {
      await api.post("/sales", { date, items });
      toast.success(`${fmt(grand)} poulets déduits du stock`);
      setEntries({});
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!report) return <p className="text-[#758277]">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">Ventes du jour</h1>
          <p className="mt-2 text-[#4B554D]">Saisissez les poulets vendus par point de vente, en entiers et en demis.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto h-11 bg-white" data-testid="sales-date-input" />
      </div>

      {report.rows.length === 0 && <p className="text-[#4B554D]" data-testid="sales-empty">Aucun point de vente créé.</p>}
      <div className="space-y-3">
        {report.rows.map((r) => (
          <SaleRow key={r.pos_id} row={r} entry={get(r.pos_id)} setEntry={(e) => setEntries({ ...entries, [r.pos_id]: e })} />
        ))}
      </div>

      {report.rows.length > 0 && (
        <div className="sticky bottom-20 md:bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#1C271E] text-[#FAF8F5]">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#FAF8F5]/60">Total à déduire</p>
            <p className="font-num text-2xl font-extrabold" data-testid="sales-grand-total">{fmt(grand)} poulets</p>
            <p className="text-xs text-[#FAF8F5]/60">Déjà enregistré ce jour : <span data-testid="sales-day-recorded">{fmt(report.total)}</span></p>
          </div>
          <Button onClick={submit} disabled={busy || grand === 0} className="h-12 px-6 rounded-full bg-[#C85A32] hover:bg-[#b34e2a] text-base" data-testid="submit-sales-btn">
            Enregistrer les ventes
          </Button>
        </div>
      )}
    </div>
  );
}

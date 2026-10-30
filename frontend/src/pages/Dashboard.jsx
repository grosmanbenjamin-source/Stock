import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PackagePlus, Truck, ArrowLeftRight, SlidersHorizontal, AlertTriangle, Store } from "lucide-react";
import { api, fmt } from "../lib/api";
import { StockActionDialog } from "../components/StockActions";

const ActionBtn = ({ icon: Icon, label, onClick, testid, accent }) => (
  <button onClick={onClick} data-testid={testid}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
      accent ? "bg-[#C85A32] text-white" : "bg-white border border-[#E2DDD5] text-[#1A231C]"}`}>
    <Icon size={18} /> {label}
  </button>
);

const PosCard = ({ p, i }) => {
  const low = p.alert_threshold > 0 && p.stock <= p.alert_threshold;
  return (
    <div className="rise p-5 rounded-2xl bg-white border border-[#E2DDD5] hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 50}ms` }} data-testid={`pos-card-${p.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display font-bold text-lg leading-tight">{p.name}</p>
        {low && <span className="flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-[#FEF3C7] text-[#B45309]"><AlertTriangle size={12} />Bas</span>}
      </div>
      <p className="mt-4 font-num text-4xl font-extrabold tracking-tight" data-testid={`pos-stock-${p.id}`}>{fmt(p.stock)}</p>
      <p className="text-xs text-[#758277] uppercase tracking-wider font-semibold">poulets en stock</p>
      <div className="mt-4 pt-3 border-t border-dashed border-[#E2DDD5] text-sm text-[#4B554D]">
        Vendus aujourd'hui : <span className="font-num font-bold text-[#1A231C]" data-testid={`pos-sold-${p.id}`}>{fmt(p.sold_today)}</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null);
  const load = useCallback(() => {
    api.get("/overview").then((r) => setData(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-[#758277]">Chargement…</p>;

  return (
    <div className="space-y-8">
      <section className="rise grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="relative overflow-hidden rounded-3xl bg-[#2C4030] text-[#FAF8F5] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#FAF8F5]/60">Stock atelier</p>
          <p className="mt-3 font-num text-6xl sm:text-7xl font-extrabold tracking-tight" data-testid="atelier-stock-counter">{fmt(data.atelier.stock)}</p>
          <p className="text-[#FAF8F5]/70">poulets disponibles à distribuer</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setMode("supply")} data-testid="btn-supply-atelier" className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#C85A32] font-semibold hover:bg-[#b34e2a] transition-colors">
              <PackagePlus size={18} /> Approvisionner
            </button>
            <button onClick={() => setMode("distribute")} data-testid="btn-distribute-stock" disabled={!data.pos.length} className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#FAF8F5]/10 border border-[#FAF8F5]/25 font-semibold hover:bg-[#FAF8F5]/20 transition-colors disabled:opacity-40">
              <Truck size={18} /> Distribuer
            </button>
          </div>
          <span className="absolute -right-10 -bottom-16 w-56 h-56 rounded-full bg-[#789B77]/25" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white border border-[#E2DDD5] p-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-[#758277]">Dans les points de vente</p>
            <p className="mt-3 font-num text-4xl font-extrabold" data-testid="total-pos-stock">{fmt(data.total_pos_stock)}</p>
          </div>
          <div className="rounded-3xl bg-[#E5EFE4] p-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-[#2C4030]/70">Vendus aujourd'hui</p>
            <p className="mt-3 font-num text-4xl font-extrabold text-[#2C4030]" data-testid="sold-today-total">{fmt(data.sold_today)}</p>
          </div>
          <div className="col-span-2 rounded-3xl bg-[#EFECE6] p-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#4B554D]">Stock total (atelier + points de vente)</p>
            <p className="font-num text-2xl font-extrabold" data-testid="total-stock">{fmt(data.total_stock)}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <ActionBtn icon={ArrowLeftRight} label="Transférer" onClick={() => setMode("transfer")} testid="btn-transfer-stock" />
        <ActionBtn icon={SlidersHorizontal} label="Réajuster un stock" onClick={() => setMode("adjust")} testid="btn-adjust-stock" />
        <Link to="/ventes" data-testid="btn-sales-entry" className="flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm bg-[#C85A32] text-white hover:-translate-y-0.5 transition-transform">
          Saisir les ventes du jour
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">Points de vente</h2>
        {data.pos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2DDD5] p-8 text-center text-[#4B554D]" data-testid="empty-pos">
            <Store className="mx-auto mb-3 text-[#789B77]" />
            Aucun point de vente. <Link to="/points-de-vente" className="text-[#C85A32] font-semibold underline">Créez-en un</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pos.map((p, i) => <PosCard key={p.id} p={p} i={i} />)}
          </div>
        )}
      </section>

      {mode && <StockActionDialog mode={mode} data={data} onClose={() => setMode(null)} onDone={load} />}
    </div>
  );
}

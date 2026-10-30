import { NavLink } from "react-router-dom";
import { LayoutGrid, ShoppingBasket, History, Store, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

const LINKS = [
  { to: "/", label: "Stock", icon: LayoutGrid, id: "nav-dashboard" },
  { to: "/ventes", label: "Ventes du jour", icon: ShoppingBasket, id: "nav-sales" },
  { to: "/historique", label: "Historique", icon: History, id: "nav-history" },
  { to: "/points-de-vente", label: "Points de vente", icon: Store, id: "nav-pos" },
];

const linkCls = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
    isActive ? "bg-[#2C4030] text-[#FAF8F5]" : "text-[#4B554D] hover:bg-[#EFECE6]"
  }`;

export default function Layout({ children }) {
  const { logout } = useAuth();
  return (
    <div className="grain min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-30 bg-[#F7F5F0]/80 backdrop-blur-xl border-b border-[#E2DDD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-[#C85A32] text-white grid place-items-center font-display font-extrabold">V</span>
            <span className="font-display font-bold text-lg tracking-tight">VolailleStock</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end className={linkCls} data-testid={l.id}>
                <l.icon size={16} /> {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ChangePasswordDialog />
            <button onClick={logout} data-testid="logout-btn" className="p-2 rounded-full hover:bg-[#EFECE6] text-[#4B554D]" title="Déconnexion">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#1C271E] grid grid-cols-4">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end data-testid={`${l.id}-mobile`}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${isActive ? "text-[#F3A27F]" : "text-[#FAF8F5]/70"}`}>
            <l.icon size={20} /> {l.label.split(" ")[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

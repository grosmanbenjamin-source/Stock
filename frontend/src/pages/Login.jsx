import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../lib/api";

const HERO = "/login-hero.jpg";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F7F5F0]">
      <div className="hidden lg:block relative">
        <img src={HERO} alt="Poulets" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#1C271E]/55" />
        <div className="absolute bottom-12 left-12 right-12 text-[#FAF8F5]">
          <p className="font-display text-5xl font-extrabold leading-tight">De l'atelier<br />au comptoir.</p>
          <p className="mt-4 text-[#FAF8F5]/80 max-w-sm">Chaque poulet suivi, entier ou par demi.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 rise" data-testid="login-form">
          <div>
            <span className="w-11 h-11 rounded-xl bg-[#C85A32] text-white grid place-items-center font-display font-extrabold text-xl">V</span>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">VolailleStock</h1>
            <p className="mt-2 text-[#4B554D]">Connectez-vous pour gérer votre stock.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-white" data-testid="login-email-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-white" data-testid="login-password-input" />
          </div>
          {error && <p className="text-sm text-[#C85A32] font-medium" data-testid="login-error">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-12 bg-[#2C4030] hover:bg-[#1C271E] text-base rounded-full" data-testid="login-submit-button">
            {busy ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}

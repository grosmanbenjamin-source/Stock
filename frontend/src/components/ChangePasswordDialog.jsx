import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { api, errMsg } from "../lib/api";

export const ChangePasswordDialog = () => {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: next });
      toast.success("Mot de passe modifié");
      setOpen(false);
      setCur("");
      setNext("");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="change-password-btn" className="p-2 rounded-full hover:bg-[#EFECE6] text-[#4B554D]" title="Mot de passe">
          <KeyRound size={18} />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle className="font-display">Changer le mot de passe</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Mot de passe actuel</Label>
            <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required data-testid="current-password-input" />
          </div>
          <div className="space-y-2">
            <Label>Nouveau mot de passe (6 caractères min.)</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required data-testid="new-password-input" />
          </div>
          <Button type="submit" className="w-full bg-[#2C4030] hover:bg-[#1C271E]" data-testid="change-password-submit">Enregistrer</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

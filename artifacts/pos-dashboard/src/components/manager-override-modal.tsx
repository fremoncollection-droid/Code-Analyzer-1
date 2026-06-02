import { useState } from "react";
import { useManagerOverride } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2, ArrowLeft } from "lucide-react";

interface ManagerOverrideModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (overrideToken: string) => void;
  actionLabel: string;
}

export default function ManagerOverrideModal({ open, onClose, onSuccess, actionLabel }: ManagerOverrideModalProps) {
  const { toast } = useToast();
  const [managerUsername, setManagerUsername] = useState("");
  const [pin, setPin] = useState("");

  const override = useManagerOverride({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Manager override approved", description: `Approved by ${data.managerName}` });
        setManagerUsername("");
        setPin("");
        onSuccess(data.overrideToken);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Override failed";
        toast({ title: "Override denied", description: msg, variant: "destructive" });
      },
    },
  });

  function appendDigit(d: string) {
    if (pin.length < 6) setPin(prev => prev + d);
  }

  function backspace() {
    setPin(prev => prev.slice(0, -1));
  }

  function submit() {
    if (!managerUsername || pin.length < 4) {
      toast({ title: "Enter manager username and PIN", variant: "destructive" });
      return;
    }
    override.mutate({ data: { username: managerUsername, pin } });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" /> Manager Override
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">A manager must approve: <strong>{actionLabel}</strong></p>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Manager Username</Label>
            <input
              value={managerUsername}
              onChange={e => setManagerUsername(e.target.value)}
              placeholder="manager username"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Manager PIN</Label>
            <div className="flex justify-center gap-2 py-1">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full transition-colors ${i < pin.length ? "bg-amber-500" : "bg-muted"}`} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="h-12 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 active:scale-95"
              >
                {d}
              </button>
            ))}
            <button type="button" onClick={backspace} className="h-12 rounded-lg bg-muted hover:bg-muted/80 active:scale-95 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => appendDigit("0")} className="h-12 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 active:scale-95">0</button>
            <button
              type="button"
              onClick={submit}
              disabled={override.isPending || !managerUsername || pin.length < 4}
              className="h-12 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-400 active:scale-95 disabled:opacity-50"
            >
              {override.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Approve"}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

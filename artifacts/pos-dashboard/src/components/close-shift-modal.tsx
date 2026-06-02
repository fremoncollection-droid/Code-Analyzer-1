import { useState } from "react";
import { useCloseShift } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Coins } from "lucide-react";

interface CloseShiftModalProps {
  open: boolean;
  onClose: () => void;
  shiftId: string;
}

export default function CloseShiftModal({ open, onClose, shiftId }: CloseShiftModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actualCash, setActualCash] = useState("");
  const [actualMoMo, setActualMoMo] = useState("");
  const [actualCard, setActualCard] = useState("");
  const [closingFloat, setClosingFloat] = useState("");
  const [result, setResult] = useState<any>(null);

  const closeShift = useCloseShift({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/shifts"] });
        toast({ title: "Shift closed", description: "Reconciliation complete" });
      },
      onError: (err: any) => {
        toast({ title: "Close failed", description: err?.response?.data?.error || "Could not close shift", variant: "destructive" });
      },
    },
  });

  function handleSubmit() {
    closeShift.mutate({
      data: {
        shiftId,
        actualCash: actualCash || "0",
        actualMoMo: actualMoMo || "0",
        actualCard: actualCard || "0",
        closingFloat: closingFloat || "0",
      },
    });
  }

  function handleClose() {
    setResult(null);
    setActualCash("");
    setActualMoMo("");
    setActualCard("");
    setClosingFloat("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500" /> Close Shift
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-center text-green-600">Shift closed successfully</p>
            <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                <span>Method</span><span>Expected</span><span>Actual</span>
              </div>
              {["cash", "momo", "card"].map((method) => {
                const exp = result.expected?.[method] ?? "0";
                const act = result.actual?.[method] ?? 0;
                const var_ = result.variance?.[method] ?? 0;
                return (
                  <div key={method} className="grid grid-cols-3 gap-1 text-sm">
                    <span className="capitalize font-medium">{method}</span>
                    <span className="tabular-nums">₵{exp}</span>
                    <span className={`tabular-nums ${var_ === 0 ? "text-green-600" : "text-red-600"}`}>₵{act}</span>
                  </div>
                );
              })}
              <div className="border-t pt-1 text-xs text-muted-foreground">
                Variance: Cash ₵{result.variance?.cash}, MoMo ₵{result.variance?.momo}, Card ₵{result.variance?.card}
              </div>
            </div>
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Enter physical counts (no system totals shown):</p>
            <div className="space-y-1">
              <Label className="text-xs">Cash in drawer (₵)</Label>
              <input type="number" step="0.01" value={actualCash} onChange={e => setActualCash(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MoMo received (₵)</Label>
              <input type="number" step="0.01" value={actualMoMo} onChange={e => setActualMoMo(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Card payments (₵)</Label>
              <input type="number" step="0.01" value={actualCard} onChange={e => setActualCard(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closing float (₵)</Label>
              <input type="number" step="0.01" value={closingFloat} onChange={e => setClosingFloat(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="0.00" />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={closeShift.isPending}>
                {closeShift.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Close Shift"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

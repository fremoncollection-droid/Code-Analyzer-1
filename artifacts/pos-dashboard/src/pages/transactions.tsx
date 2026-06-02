import { useState } from "react";
import { useListTransactions, useVoidTransaction } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, Banknote, Smartphone, CreditCard, XCircle, Eye } from "lucide-react";
import ReceiptModal from "@/components/receipt-modal";
import ManagerOverrideModal from "@/components/manager-override-modal";

const PAYMENT_ICONS: Record<string, any> = { cash: Banknote, momo: Smartphone, card: CreditCard };

export default function TransactionsPage() {
  const { user, selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [voidDialog, setVoidDialog] = useState<{ id: string; receipt: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideToken, setOverrideToken] = useState<string | null>(null);

  const { data, isLoading } = useListTransactions({
    locationId: selectedLocationId ?? undefined,
    paymentMethod: paymentFilter !== "all" ? paymentFilter : undefined,
    limit: 100,
  });

  const voidTx = useVoidTransaction({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/transactions"] });
        setVoidDialog(null);
        setVoidReason("");
        setOverrideToken(null);
        toast({ title: "Transaction voided" });
      },
      onError: () => toast({ title: "Failed to void", variant: "destructive" }),
    },
  });

  const transactions = data?.data ?? [];
  const isCashier = user?.role === "cashier";

  function startVoid(tx: { id: string; receiptNumber: string }) {
    setVoidDialog({ id: tx.id, receipt: tx.receiptNumber });
    if (isCashier) {
      setOverrideModal(true);
    }
  }

  function handleVoidSubmit() {
    if (!voidDialog) return;
    const payload: any = { reason: voidReason };
    if (overrideToken) payload.overrideToken = overrideToken;
    voidTx.mutate({ id: voidDialog.id, data: payload });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="momo">MoMo</SelectItem>
            <SelectItem value="card">Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Receipt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cashier</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Payment</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : transactions.map(tx => {
                const Icon = PAYMENT_ICONS[tx.paymentMethod] ?? Banknote;
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3 h-3 text-muted-foreground" />
                        {tx.receiptNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">{tx.cashierName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <span className="capitalize text-sm">{tx.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(tx.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {tx.isVoided ? (
                        <Badge variant="destructive" className="text-xs">Voided</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs text-teal-700 bg-teal-50">Completed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setReceiptId(tx.id)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {!tx.isVoided && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                            onClick={() => startVoid(tx)}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && transactions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Void dialog */}
      <Dialog open={!!voidDialog && !overrideModal} onOpenChange={() => setVoidDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void Transaction</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            You are about to void <strong>{voidDialog?.receipt}</strong>. This action cannot be undone.
          </p>
          <div className="space-y-1">
            <Label>Reason for voiding *</Label>
            <Input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!voidReason || voidTx.isPending}
              onClick={handleVoidSubmit}
            >
              Void Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager override modal */}
      <ManagerOverrideModal
        open={overrideModal}
        onClose={() => setOverrideModal(false)}
        actionLabel="Void Transaction"
        onSuccess={(token) => { setOverrideToken(token); setOverrideModal(false); }}
      />

      {receiptId && (
        <ReceiptModal open={!!receiptId} onClose={() => setReceiptId(null)} transactionId={receiptId} />
      )}
    </div>
  );
}

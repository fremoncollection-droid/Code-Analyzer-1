import { useState } from "react";
import { useListTransactions, useVoidTransaction } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, Banknote, Smartphone, CreditCard, XCircle, Eye, Building2, ShoppingBag, CalendarDays, TrendingUp } from "lucide-react";
import { useSalesMode } from "@/lib/sales-mode";
import ReceiptModal from "@/components/receipt-modal";
import ManagerOverrideModal from "@/components/manager-override-modal";

const PAYMENT_ICONS: Record<string, any> = { cash: Banknote, momo: Smartphone, card: CreditCard, net30: CreditCard, purchase_order: ShoppingBag };
const MODE_ICONS: Record<string, any> = { retail: ShoppingBag, wholesale: Building2 };
const MODE_COLORS: Record<string, string> = { retail: "bg-emerald-50 text-emerald-700", wholesale: "bg-blue-50 text-blue-700" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const { user, selectedLocationId } = useAuth();
  const { salesMode, isRetail } = useSalesMode();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [voidDialog, setVoidDialog] = useState<{ id: string; receipt: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideToken, setOverrideToken] = useState<string | null>(null);

  // Daily summary state
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // Build startDate / endDate from selected date (full day window)
  const startDate = `${selectedDate}T00:00:00.000Z`;
  const endDate = `${selectedDate}T23:59:59.999Z`;

  // Main list – filtered by date always
  const { data, isLoading } = useListTransactions({
    locationId: selectedLocationId ?? undefined,
    paymentMethod: paymentFilter !== "all" ? paymentFilter : undefined,
    salesMode,
    startDate,
    endDate,
    limit: 200,
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

  // Compute daily totals from ALL non-voided transactions for the day
  // (regardless of payment filter so the summary always shows the full day)
  const nonVoided = transactions.filter(tx => !tx.isVoided);

  function sumByMethod(method: string) {
    return nonVoided
      .filter(tx => tx.paymentMethod === method)
      .reduce((acc, tx) => acc + parseFloat(tx.total ?? "0"), 0);
  }

  const cashTotal   = sumByMethod("cash");
  const momoTotal   = sumByMethod("momo");
  const cardTotal   = sumByMethod("card");
  const net30Total  = sumByMethod("net30");
  const poTotal     = sumByMethod("purchase_order");
  const grandTotal  = nonVoided.reduce((acc, tx) => acc + parseFloat(tx.total ?? "0"), 0);

  const breakdown = [
    { label: "Cash",           value: cashTotal,  icon: Banknote,      color: "text-teal-600",   bg: "bg-teal-50",   show: cashTotal > 0 },
    { label: "MoMo",           value: momoTotal,  icon: Smartphone,    color: "text-yellow-600", bg: "bg-yellow-50", show: momoTotal > 0 },
    { label: "Card",           value: cardTotal,  icon: CreditCard,    color: "text-blue-600",   bg: "bg-blue-50",   show: cardTotal > 0 },
    { label: "Net 30",         value: net30Total, icon: CreditCard,    color: "text-indigo-600", bg: "bg-indigo-50", show: net30Total > 0 },
    { label: "Purchase Order", value: poTotal,    icon: ShoppingBag,   color: "text-purple-600", bg: "bg-purple-50", show: poTotal > 0 },
  ].filter(b => b.show);

  function startVoid(tx: { id: string; receiptNumber: string }) {
    setVoidDialog({ id: tx.id, receipt: tx.receiptNumber });
    if (isCashier) setOverrideModal(true);
  }

  function handleVoidSubmit() {
    if (!voidDialog) return;
    const payload: any = { reason: voidReason };
    if (overrideToken) payload.overrideToken = overrideToken;
    voidTx.mutate({ id: voidDialog.id, data: payload });
  }

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-muted-foreground text-sm">{nonVoided.length} transaction{nonVoided.length !== 1 ? "s" : ""}</p>
            <Badge className={cn("text-[10px]", isRetail ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
              {isRetail ? "Retail" : "Wholesale"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date picker */}
          <div className="flex items-center gap-2 border rounded-lg px-3 h-9 bg-background">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent outline-none cursor-pointer"
            />
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
              <SelectItem value="net30">Net 30</SelectItem>
              <SelectItem value="purchase_order">Purchase Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Daily Summary Card */}
      <Card className="border-card-border overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold text-sm">{formatDateLabel(selectedDate)}</span>
          </div>
          <div className="text-white text-right">
            <p className="text-xs text-white/70">Total Received</p>
            <p className="text-xl font-bold">{isLoading ? "…" : formatCurrency(grandTotal)}</p>
          </div>
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-5 py-4 flex gap-6">
              {[1,2,3].map(i => <div key={i} className="h-10 w-28 bg-muted rounded animate-pulse" />)}
            </div>
          ) : breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-5">
              No transactions recorded for this date.
            </p>
          ) : (
            <div className="flex flex-wrap gap-px bg-border">
              {breakdown.map(b => (
                <div key={b.label} className="flex items-center gap-3 px-5 py-3 bg-background flex-1 min-w-[140px]">
                  <div className={cn("p-2 rounded-lg", b.bg)}>
                    <b.icon className={cn("w-4 h-4", b.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{b.label}</p>
                    <p className={cn("font-bold text-base", b.color)}>{formatCurrency(b.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Receipt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mode</th>
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
                    <td colSpan={8} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : transactions.map(tx => {
                const Icon = PAYMENT_ICONS[tx.paymentMethod as string] ?? Banknote;
                const ModeIcon = MODE_ICONS[tx.salesMode as string] ?? ShoppingBag;
                return (
                  <tr key={tx.id} className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    tx.isVoided ? "opacity-50" : "hover:bg-muted/30"
                  )}>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3 h-3 text-muted-foreground" />
                        {tx.receiptNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-[10px]", MODE_COLORS[tx.salesMode as string] ?? "bg-muted")}>
                        <ModeIcon className="w-2.5 h-2.5 mr-0.5" />
                        {tx.salesMode ?? "retail"}
                      </Badge>
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
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No transactions for {formatDateLabel(selectedDate)}
                  </td>
                </tr>
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

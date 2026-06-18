import { useState, useMemo, useEffect } from "react";
import { useSalesMode } from "@/lib/sales-mode";
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
import {
  Receipt, Banknote, Smartphone, CreditCard, XCircle, Eye, Building2, ShoppingBag,
  TrendingUp, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUp, ArrowDown, X,
} from "lucide-react";
import ReceiptModal from "@/components/receipt-modal";
import ManagerOverrideModal from "@/components/manager-override-modal";

const PAYMENT_ICONS: Record<string, any> = {
  cash: Banknote, momo: Smartphone, card: CreditCard,
  net30: CreditCard, purchase_order: ShoppingBag,
};
const MODE_COLORS: Record<string, string> = {
  retail: "bg-emerald-50 text-emerald-700",
  wholesale: "bg-blue-50 text-blue-700",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function calDays(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const total = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MiniCalendar({
  selectedDate, calMonth, onDaySelect, onMonthChange, salesDays,
}: {
  selectedDate: string;
  calMonth: string;
  onDaySelect: (d: string) => void;
  onMonthChange: (m: string) => void;
  salesDays: Record<string, { retail: number; wholesale: number }>;
}) {
  const today = todayStr();
  const [y, m] = calMonth.split("-").map(Number);
  const cells = calDays(calMonth);
  const canNext = calMonth < today.slice(0, 7);

  function prev() {
    const d = new Date(y, m - 2, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  }
  function next() {
    if (!canNext) return;
    const d = new Date(y, m, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-1 hover:bg-muted rounded transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold">{monthLabel(calMonth)}</span>
        <button onClick={next} disabled={!canNext} className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-[9px] text-muted-foreground font-medium py-0.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-8" />;
          const dateStr = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isFuture = dateStr > today;
          const isSel = dateStr === selectedDate;
          const isToday = dateStr === today;
          const sale = salesDays[dateStr];
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => { if (!isFuture) onDaySelect(dateStr); }}
              className={cn(
                "relative flex flex-col items-center justify-start pt-1 h-8 rounded text-xs transition-colors",
                isSel ? "bg-primary text-primary-foreground font-bold"
                  : isToday ? "ring-1 ring-primary font-bold hover:bg-muted"
                  : "hover:bg-muted",
                isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <span>{day}</span>
              {sale && (
                <div className="flex gap-0.5 absolute bottom-0.5">
                  {sale.retail > 0 && (
                    <div className={cn("w-1 h-1 rounded-full", isSel ? "bg-white/80" : "bg-emerald-500")} />
                  )}
                  {sale.wholesale > 0 && (
                    <div className={cn("w-1 h-1 rounded-full", isSel ? "bg-sky-200" : "bg-blue-500")} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-border">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">Retail</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">Wholesale</span>
        </div>
      </div>
    </div>
  );
}

type SortField = "date" | "amount" | "cashier" | "mode" | "payment";
type SortDir = "asc" | "desc";

export default function TransactionsPage() {
  const { user, selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calMonth, setCalMonth] = useState(todayStr().slice(0, 7));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const { salesMode } = useSalesMode();
  const [modeFilter, setModeFilter] = useState<"all" | "retail" | "wholesale">(salesMode);
  useEffect(() => { setModeFilter(salesMode); }, [salesMode]);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [voidDialog, setVoidDialog] = useState<{ id: string; receipt: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideToken, setOverrideToken] = useState<string | null>(null);

  const startDate = `${selectedDate}T00:00:00.000Z`;
  const endDate   = `${selectedDate}T23:59:59.999Z`;

  // All transactions for selected day (both modes)
  const { data, isLoading } = useListTransactions({
    locationId: selectedLocationId ?? undefined,
    paymentMethod: paymentFilter !== "all" ? paymentFilter : undefined,
    startDate,
    endDate,
    limit: 500,
  } as any);

  // Monthly data for calendar dots
  const [calY, calM] = calMonth.split("-").map(Number);
  const calStart = `${calMonth}-01T00:00:00.000Z`;
  const calEnd = (() => {
    const d = new Date(calY, calM, 0);
    return `${d.toISOString().slice(0, 10)}T23:59:59.999Z`;
  })();
  const { data: monthData } = useListTransactions({
    locationId: selectedLocationId ?? undefined,
    startDate: calStart,
    endDate: calEnd,
    limit: 2000,
  } as any);

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

  const allTx = (data?.data ?? []) as any[];
  const isCashier = user?.role === "cashier";

  // Retail / wholesale totals from all non-voided (ignoring mode filter for summary)
  const nonVoided = allTx.filter(tx => !tx.isVoided);
  const retailTotal    = nonVoided.filter(tx => (tx.salesMode ?? "retail") === "retail").reduce((s, tx) => s + parseFloat(tx.total ?? "0"), 0);
  const wholesaleTotal = nonVoided.filter(tx => tx.salesMode === "wholesale").reduce((s, tx) => s + parseFloat(tx.total ?? "0"), 0);
  const grandTotal     = retailTotal + wholesaleTotal;

  function sumByMethod(method: string) {
    return nonVoided.filter(tx => tx.paymentMethod === method).reduce((s, tx) => s + parseFloat(tx.total ?? "0"), 0);
  }
  const payBreakdown = [
    { label: "Cash", value: sumByMethod("cash"), icon: Banknote, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "MoMo", value: sumByMethod("momo"), icon: Smartphone, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Card", value: sumByMethod("card"), icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Net 30", value: sumByMethod("net30"), icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Purchase Order", value: sumByMethod("purchase_order"), icon: ShoppingBag, color: "text-purple-600", bg: "bg-purple-50" },
  ].filter(b => b.value > 0);

  // Calendar sales days for the shown month
  const salesDays = useMemo(() => {
    const map: Record<string, { retail: number; wholesale: number }> = {};
    const mTx = ((monthData as any)?.data ?? []) as any[];
    for (const tx of mTx) {
      if (tx.isVoided) continue;
      const day = new Date(tx.createdAt).toLocaleDateString("en-CA");
      if (!map[day]) map[day] = { retail: 0, wholesale: 0 };
      const amt = parseFloat(tx.total ?? "0");
      if ((tx.salesMode ?? "retail") === "retail") map[day].retail += amt;
      else map[day].wholesale += amt;
    }
    return map;
  }, [monthData]);

  // Mode-filtered + sorted table list
  const tableData = useMemo(() => {
    let list = allTx.filter(tx => {
      if (modeFilter === "retail") return (tx.salesMode ?? "retail") === "retail";
      if (modeFilter === "wholesale") return tx.salesMode === "wholesale";
      return true;
    });
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "date")    { av = a.createdAt; bv = b.createdAt; }
      else if (sortField === "amount")   { av = parseFloat(a.total ?? "0"); bv = parseFloat(b.total ?? "0"); }
      else if (sortField === "cashier")  { av = (a.cashierName ?? "").toLowerCase(); bv = (b.cashierName ?? "").toLowerCase(); }
      else if (sortField === "mode")     { av = a.salesMode ?? ""; bv = b.salesMode ?? ""; }
      else if (sortField === "payment")  { av = a.paymentMethod ?? ""; bv = b.paymentMethod ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [allTx, modeFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={cn(
          "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
          active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
        )}
      >
        <span>{label}</span>
        {active ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowDown className="w-3 h-3 opacity-20" />}
      </button>
    );
  }

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

  const displayedCount = modeFilter === "all" ? nonVoided.length
    : modeFilter === "retail" ? nonVoided.filter(tx => (tx.salesMode ?? "retail") === "retail").length
    : nonVoided.filter(tx => tx.salesMode === "wholesale").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className={cn(
              "p-2 rounded-lg border transition-colors",
              sidebarOpen ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted"
            )}
            title="Toggle sidebar"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {displayedCount} transaction{displayedCount !== 1 ? "s" : ""} · {formatDateLabel(selectedDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ===== SIDEBAR ===== */}
        {sidebarOpen && (
          <aside className="w-60 shrink-0 space-y-4">
            {/* Calendar card */}
            <Card className="border-card-border p-3">
              <MiniCalendar
                selectedDate={selectedDate}
                calMonth={calMonth}
                onDaySelect={(d) => { setSelectedDate(d); setCalMonth(d.slice(0, 7)); }}
                onMonthChange={setCalMonth}
                salesDays={salesDays}
              />
            </Card>

            {/* Mode filter */}
            <Card className="border-card-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales Mode</p>
              {(["all","retail","wholesale"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModeFilter(m)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors capitalize",
                    modeFilter === m ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  )}
                >
                  {m === "retail" ? <ShoppingBag className="w-3 h-3" /> : m === "wholesale" ? <Building2 className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {m === "all" ? "All Modes" : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </Card>

            {/* Payment filter */}
            <Card className="border-card-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</p>
              {[
                { v: "all", label: "All Methods" },
                { v: "cash", label: "Cash" },
                { v: "momo", label: "MoMo" },
                { v: "card", label: "Card" },
                { v: "net30", label: "Net 30" },
                { v: "purchase_order", label: "Purchase Order" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setPaymentFilter(v)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    paymentFilter === v ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </Card>

            {/* Sort */}
            <Card className="border-card-border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort By</p>
              <SortBtn field="date" label="Date & Time" />
              <SortBtn field="amount" label="Amount" />
              <SortBtn field="cashier" label="Cashier" />
              <SortBtn field="mode" label="Sales Mode" />
              <SortBtn field="payment" label="Payment Method" />
            </Card>
          </aside>
        )}

        {/* ===== MAIN AREA ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Summary card */}
          <Card className="border-card-border overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-semibold text-sm">{formatDateLabel(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-5">
                  {/* Retail */}
                  <div className="text-right">
                    <p className="text-[10px] text-white/60">Retail</p>
                    <p className="text-base font-bold text-emerald-300">
                      {isLoading ? "…" : formatCurrency(retailTotal)}
                    </p>
                  </div>
                  {/* Wholesale */}
                  <div className="text-right">
                    <p className="text-[10px] text-white/60">Wholesale</p>
                    <p className="text-base font-bold text-sky-300">
                      {isLoading ? "…" : formatCurrency(wholesaleTotal)}
                    </p>
                  </div>
                  {/* Combined */}
                  <div className="text-right pl-3 border-l border-white/20">
                    <p className="text-[10px] text-white/70">Combined</p>
                    <p className="text-xl font-bold text-white">
                      {isLoading ? "…" : formatCurrency(grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="px-5 py-4 flex gap-6">
                  {[1,2,3].map(i => <div key={i} className="h-10 w-28 bg-muted rounded animate-pulse" />)}
                </div>
              ) : payBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-5">No transactions recorded for this date.</p>
              ) : (
                <div className="flex flex-wrap gap-px bg-border">
                  {payBreakdown.map(b => (
                    <div key={b.label} className="flex items-center gap-3 px-4 py-3 bg-background flex-1 min-w-[130px]">
                      <div className={cn("p-1.5 rounded-lg", b.bg)}>
                        <b.icon className={cn("w-4 h-4", b.color)} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{b.label}</p>
                        <p className={cn("font-bold text-sm", b.color)}>{formatCurrency(b.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
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
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    : tableData.map(tx => {
                        const Icon = PAYMENT_ICONS[tx.paymentMethod as string] ?? Banknote;
                        const isWholesale = tx.salesMode === "wholesale";
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
                              <Badge className={cn("text-[10px]", isWholesale ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700")}>
                                {isWholesale ? <Building2 className="w-2.5 h-2.5 mr-0.5" /> : <ShoppingBag className="w-2.5 h-2.5 mr-0.5" />}
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
                              {tx.isVoided
                                ? <Badge variant="destructive" className="text-xs">Voided</Badge>
                                : <Badge variant="secondary" className="text-xs text-teal-700 bg-teal-50">Completed</Badge>}
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
                      })
                  }
                  {!isLoading && tableData.length === 0 && (
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
        </div>
      </div>

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
            <Button variant="destructive" disabled={!voidReason || voidTx.isPending} onClick={handleVoidSubmit}>
              Void Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

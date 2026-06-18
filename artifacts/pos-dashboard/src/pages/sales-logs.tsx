import { useState, useMemo } from "react";
import { useListSalesLogs } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, ShoppingBag, Building2, TrendingUp, Users,
  ChevronDown, ChevronRight, ChevronLeft, SlidersHorizontal, ArrowUp, ArrowDown,
} from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  sale:             "bg-green-50 text-green-700",
  add_to_cart:      "bg-teal-50 text-teal-700",
  remove_from_cart: "bg-orange-50 text-orange-700",
  checkout:         "bg-blue-50 text-blue-700",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
}

function formatDayLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function getDateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
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

type SortField = "time" | "amount" | "salesperson" | "mode" | "action";
type SortDir = "asc" | "desc";

export default function SalesLogsPage() {
  const { user } = useAuth();
  const { salesMode } = useSalesMode();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calMonth, setCalMonth] = useState(todayStr().slice(0, 7));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modeFilter, setModeFilter] = useState<"all" | "retail" | "wholesale">("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  if (!isAdmin && !isManager) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-sm mt-1">Only managers and admins can view sales logs.</p>
      </div>
    );
  }

  const startDate = `${selectedDate}T00:00:00.000Z`;
  const endDate   = `${selectedDate}T23:59:59.999Z`;

  // All logs for selected day (no mode filter at API level)
  const { data: logs, isLoading } = useListSalesLogs({
    action: actionFilter !== "all" ? actionFilter : undefined,
    startDate,
    endDate,
    limit: 1000,
  } as any);

  // Monthly logs for calendar dots
  const [calY, calM] = calMonth.split("-").map(Number);
  const calStart = `${calMonth}-01T00:00:00.000Z`;
  const calEnd = (() => {
    const d = new Date(calY, calM, 0);
    return `${d.toISOString().slice(0, 10)}T23:59:59.999Z`;
  })();
  const { data: monthLogs } = useListSalesLogs({
    startDate: calStart,
    endDate: calEnd,
    limit: 5000,
  } as any);

  const allLogs = (logs ?? []) as any[];

  // Apply mode filter locally
  const filteredLogs = useMemo(() =>
    modeFilter === "all" ? allLogs
      : allLogs.filter(l => (modeFilter === "retail"
        ? (l.salesMode ?? "retail") === "retail"
        : l.salesMode === "wholesale")),
    [allLogs, modeFilter]
  );

  // Totals split by mode (from all logs, not filtered)
  const retailTotal    = allLogs.filter(l => (l.salesMode ?? "retail") === "retail").reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
  const wholesaleTotal = allLogs.filter(l => l.salesMode === "wholesale").reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
  const grandTotal     = retailTotal + wholesaleTotal;

  // Calendar sales days
  const salesDays = useMemo(() => {
    const map: Record<string, { retail: number; wholesale: number }> = {};
    const mLogs = (monthLogs ?? []) as any[];
    for (const l of mLogs) {
      const day = getDateKey(l.createdAt);
      if (!map[day]) map[day] = { retail: 0, wholesale: 0 };
      const amt = parseFloat(l.total ?? "0");
      if ((l.salesMode ?? "retail") === "retail") map[day].retail += amt;
      else map[day].wholesale += amt;
    }
    return map;
  }, [monthLogs]);

  // Group by date and sort
  const byDate = useMemo(() => {
    return filteredLogs.reduce<Record<string, any[]>>((acc, log) => {
      const key = getDateKey(log.createdAt);
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});
  }, [filteredLogs]);

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function getSalespersonSummary(dayLogs: any[]) {
    const map: Record<string, { name: string; total: number; qty: number; count: number }> = {};
    for (const l of dayLogs) {
      const id = l.salespersonId ?? "unknown";
      if (!map[id]) map[id] = { name: l.salespersonName ?? "Unknown", total: 0, qty: 0, count: 0 };
      map[id].total += parseFloat(l.total ?? "0");
      map[id].qty += l.quantity ?? 0;
      map[id].count++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  function toggleDay(date: string) {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  }

  // Sort logs within each day group
  function sortDayLogs(dayLogs: any[]) {
    return [...dayLogs].sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "time")        { av = a.createdAt; bv = b.createdAt; }
      else if (sortField === "amount") { av = parseFloat(a.total ?? "0"); bv = parseFloat(b.total ?? "0"); }
      else if (sortField === "salesperson") { av = (a.salespersonName ?? "").toLowerCase(); bv = (b.salespersonName ?? "").toLowerCase(); }
      else if (sortField === "mode")   { av = a.salesMode ?? ""; bv = b.salesMode ?? ""; }
      else if (sortField === "action") { av = a.action ?? ""; bv = b.action ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

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

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
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
          <h1 className="text-2xl font-bold">Sales Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {filteredLogs.length} entr{filteredLogs.length !== 1 ? "ies" : "y"} · {formatDayLabel(selectedDate)}
          </p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ===== SIDEBAR ===== */}
        {sidebarOpen && (
          <aside className="w-60 shrink-0 space-y-4">
            {/* Calendar */}
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

            {/* Action filter */}
            <Card className="border-card-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Type</p>
              {[
                { v: "all", label: "All Actions" },
                { v: "sale", label: "Sale" },
                { v: "add_to_cart", label: "Add to Cart" },
                { v: "remove_from_cart", label: "Remove from Cart" },
                { v: "checkout", label: "Checkout" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setActionFilter(v)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    actionFilter === v ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </Card>

            {/* Sort */}
            <Card className="border-card-border p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sort By</p>
              <SortBtn field="time" label="Time" />
              <SortBtn field="amount" label="Amount" />
              <SortBtn field="salesperson" label="Salesperson" />
              <SortBtn field="mode" label="Sales Mode" />
              <SortBtn field="action" label="Action Type" />
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
                  <span className="font-semibold text-sm">{formatDayLabel(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] text-white/60">Retail</p>
                    <p className="text-base font-bold text-emerald-300">
                      {isLoading ? "…" : formatCurrency(retailTotal)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/60">Wholesale</p>
                    <p className="text-base font-bold text-sky-300">
                      {isLoading ? "…" : formatCurrency(wholesaleTotal)}
                    </p>
                  </div>
                  <div className="text-right pl-3 border-l border-white/20">
                    <p className="text-[10px] text-white/70">Combined</p>
                    <p className="text-xl font-bold text-white">
                      {isLoading ? "…" : formatCurrency(grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!isLoading && filteredLogs.length > 0 && (
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-px bg-border">
                  {getSalespersonSummary(filteredLogs).map(sp => (
                    <div key={sp.name} className="flex items-center gap-3 px-4 py-3 bg-background flex-1 min-w-[160px]">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                        {sp.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{sp.name}</p>
                        <p className="font-bold text-sm text-teal-700">{formatCurrency(sp.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{sp.count} sale{sp.count !== 1 ? "s" : ""} · {sp.qty} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
            {!isLoading && filteredLogs.length === 0 && (
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-4">No sales recorded for this date.</p>
              </CardContent>
            )}
          </Card>

          {/* Log groups */}
          {isLoading ? (
            <Card className="border-card-border">
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </Card>
          ) : sortedDates.length === 0 ? null : (
            <div className="space-y-4">
              {sortedDates.map(date => {
                const dayLogs = sortDayLogs(byDate[date]);
                const dayTotal    = dayLogs.reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
                const dayRetail   = dayLogs.filter(l => (l.salesMode ?? "retail") === "retail").reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
                const dayWholesale = dayLogs.filter(l => l.salesMode === "wholesale").reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
                const dayQty      = dayLogs.reduce((s, l) => s + (l.quantity ?? 0), 0);
                const spSummary   = getSalespersonSummary(dayLogs);
                const isExpanded  = expandedDays[date] !== false;

                return (
                  <Card key={date} className="border-card-border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border"
                      onClick={() => toggleDay(date)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-semibold text-sm">{formatDayLabel(date)}</span>
                        <Badge variant="secondary" className="text-[10px]">{dayLogs.length} entries</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Retail</p>
                          <p className="font-semibold text-xs text-emerald-600">{formatCurrency(dayRetail)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Wholesale</p>
                          <p className="font-semibold text-xs text-blue-600">{formatCurrency(dayWholesale)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Units</p>
                          <p className="font-semibold text-xs">{dayQty}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                          <p className="font-bold text-sm text-teal-700">{formatCurrency(dayTotal)}</p>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <>
                        <div className="flex flex-wrap gap-px bg-border border-b border-border">
                          {spSummary.map(sp => (
                            <div key={sp.name} className="flex items-center gap-2 px-4 py-2 bg-background flex-1 min-w-[150px]">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                {sp.name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{sp.name}</p>
                                <p className="text-[10px] text-muted-foreground">{formatCurrency(sp.total)} · {sp.count} sales</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/20">
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Time</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Salesperson</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Mode</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Action</th>
                                <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs">Details</th>
                                <th className="text-right px-4 py-2 text-muted-foreground font-medium text-xs">Qty</th>
                                <th className="text-right px-4 py-2 text-muted-foreground font-medium text-xs">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayLogs.map((log: any) => {
                                const color = ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground";
                                const isWholesale = log.salesMode === "wholesale";
                                const time = new Date(log.createdAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
                                return (
                                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{time}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                          {log.salespersonName?.[0]?.toUpperCase() ?? "?"}
                                        </div>
                                        <span className="text-xs">{log.salespersonName ?? "System"}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${isWholesale ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                                        {isWholesale ? <Building2 className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
                                        {log.salesMode ?? "retail"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${color}`}>
                                        {log.action.replace(/_/g, " ")}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">{log.details ?? "—"}</td>
                                    <td className="px-4 py-2.5 text-right text-xs font-medium">{log.quantity ?? "—"}</td>
                                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-teal-700">
                                      {log.total ? formatCurrency(log.total) : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

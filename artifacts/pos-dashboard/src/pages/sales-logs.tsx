import { useState } from "react";
import { useListSalesLogs } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ShoppingBag, Building2, ClipboardList, Tag, Eye, CalendarDays, TrendingUp, Users, ChevronDown, ChevronRight } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  sale: "bg-green-50 text-green-700",
  add_to_cart: "bg-teal-50 text-teal-700",
  remove_from_cart: "bg-orange-50 text-orange-700",
  checkout: "bg-blue-50 text-blue-700",
};

const MODE_COLORS: Record<string, string> = {
  retail: "bg-emerald-50 text-emerald-700",
  wholesale: "bg-blue-50 text-blue-700",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function getDateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

export default function SalesLogsPage() {
  const { user } = useAuth();
  const { salesMode } = useSalesMode();
  const [actionFilter, setActionFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState(salesMode);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const startDate = `${selectedDate}T00:00:00.000Z`;
  const endDate = `${selectedDate}T23:59:59.999Z`;

  const { data: logs, isLoading } = useListSalesLogs({
    salesMode: modeFilter,
    action: actionFilter !== "all" ? actionFilter : undefined,
    startDate,
    endDate,
    limit: 500,
  });

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

  // Group logs by date
  const allLogs = (logs ?? []) as any[];
  const byDate = allLogs.reduce<Record<string, any[]>>((acc, log) => {
    const key = getDateKey(log.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // Grand total across all logs for the selected date
  const grandTotal = allLogs.reduce((sum, l) => sum + parseFloat(l.total ?? "0"), 0);
  const grandQty = allLogs.reduce((sum, l) => sum + (l.quantity ?? 0), 0);

  function toggleDay(date: string) {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  }

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{allLogs.length} entries for selected date</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Select value={modeFilter} onValueChange={v => setModeFilter(v as "retail" | "wholesale")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="wholesale">Wholesale</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="add_to_cart">Add to Cart</SelectItem>
              <SelectItem value="remove_from_cart">Remove from Cart</SelectItem>
              <SelectItem value="checkout">Checkout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day Summary Banner */}
      <Card className="border-card-border overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold text-sm">{formatDayLabel(selectedDate)}</span>
          </div>
          <div className="text-white text-right">
            <p className="text-xs text-white/70">Total Sales</p>
            <p className="text-xl font-bold">{isLoading ? "…" : formatCurrency(grandTotal)}</p>
          </div>
        </div>
        {!isLoading && allLogs.length > 0 && (
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-px bg-border">
              {/* Per-salesperson summary */}
              {getSalespersonSummary(allLogs).map(sp => (
                <div key={sp.name} className="flex items-center gap-3 px-5 py-3 bg-background flex-1 min-w-[180px]">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                    {sp.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{sp.name}</p>
                    <p className="font-bold text-base text-teal-700">{formatCurrency(sp.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{sp.count} sale{sp.count !== 1 ? "s" : ""} · {sp.qty} units</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
        {!isLoading && allLogs.length === 0 && (
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">No sales recorded for this date.</p>
          </CardContent>
        )}
      </Card>

      {/* Grouped log entries */}
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
            const dayLogs = byDate[date];
            const dayTotal = dayLogs.reduce((s, l) => s + parseFloat(l.total ?? "0"), 0);
            const dayQty = dayLogs.reduce((s, l) => s + (l.quantity ?? 0), 0);
            const spSummary = getSalespersonSummary(dayLogs);
            const isExpanded = expandedDays[date] !== false; // default expanded

            return (
              <Card key={date} className="border-card-border overflow-hidden">
                {/* Day header — clickable to collapse */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border"
                  onClick={() => toggleDay(date)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">{formatDayLabel(date)}</span>
                    <Badge variant="secondary" className="text-[10px]">{dayLogs.length} entries</Badge>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Units Sold</p>
                      <p className="font-semibold text-sm">{dayQty}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Day Total</p>
                      <p className="font-bold text-sm text-teal-700">{formatCurrency(dayTotal)}</p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <>
                    {/* Salesperson breakdown for this day */}
                    <div className="flex flex-wrap gap-px bg-border border-b border-border">
                      {spSummary.map(sp => (
                        <div key={sp.name} className="flex items-center gap-2 px-4 py-2 bg-background flex-1 min-w-[150px]">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0">
                            {sp.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{sp.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(sp.total)} · {sp.count} sales</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Log rows */}
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
                            const modeColor = MODE_COLORS[log.salesMode] ?? "bg-muted text-muted-foreground";
                            const ModeIcon = log.salesMode === "wholesale" ? Building2 : ShoppingBag;
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
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${modeColor}`}>
                                    <ModeIcon className="w-2.5 h-2.5" /> {log.salesMode}
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
  );
}

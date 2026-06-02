import { useGetAnalyticsSummary, useGetSalesByDay, useGetTopItems, useListLocations } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShoppingBag, CreditCard, AlertTriangle, Banknote, Smartphone, BarChart3, ShoppingBag as RetailIcon, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function DashboardPage() {
  const { selectedLocationId } = useAuth();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("today");

  const { data: summary, isLoading } = useGetAnalyticsSummary({
    locationId: selectedLocationId ?? undefined,
    period,
  });
  const { data: salesByDay } = useGetSalesByDay({
    locationId: selectedLocationId ?? undefined,
    days: period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365,
  });
  const { data: topItems } = useGetTopItems({
    locationId: selectedLocationId ?? undefined,
    limit: 5,
  });

  const metrics = [
    {
      title: "Total Revenue",
      value: summary ? formatCurrency(summary.totalRevenue) : "—",
      icon: TrendingUp,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      title: "Transactions",
      value: summary?.totalTransactions?.toLocaleString() ?? "—",
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Avg. Order Value",
      value: summary ? formatCurrency(summary.averageOrderValue) : "—",
      icon: CreditCard,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Low Stock Items",
      value: summary?.lowStockItems?.toLocaleString() ?? "—",
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const s = summary as any;
  const modeBreakdown = s ? [
    { label: "Retail", value: parseFloat(s.retailSales ?? "0"), icon: RetailIcon, color: "bg-emerald-500", textColor: "text-emerald-600" },
    { label: "Wholesale", value: parseFloat(s.wholesaleSales ?? "0"), icon: Building2, color: "bg-blue-600", textColor: "text-blue-600" },
  ] : [];

  const paymentBreakdown = s ? [
    { label: "Cash", value: parseFloat(s.cashSales ?? "0"), icon: Banknote, color: "bg-teal-500" },
    { label: "MoMo", value: parseFloat(s.momoSales ?? "0"), icon: Smartphone, color: "bg-yellow-500" },
    { label: "Card", value: parseFloat(s.cardSales ?? "0"), icon: CreditCard, color: "bg-blue-500" },
    { label: "Net 30", value: parseFloat(s.net30Sales ?? "0"), icon: CreditCard, color: "bg-indigo-500" },
    { label: "PO", value: parseFloat(s.poSales ?? "0"), icon: ShoppingBag, color: "bg-purple-500" },
  ] : [];

  const total = paymentBreakdown.reduce((s, p) => s + p.value, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of your store performance</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.title} className="border-card-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{m.title}</p>
                  <p className="text-2xl font-bold mt-1">{isLoading ? "..." : m.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${m.bg}`}>
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="lg:col-span-2 border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              Sales Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesByDay && salesByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={salesByDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tickFormatter={d => formatShortDate(d)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₵${v}`} />
                  <Tooltip formatter={(v: any) => [`₵${parseFloat(v).toFixed(2)}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(174 72% 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode split */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modeBreakdown.map(p => (
              <div key={p.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={`flex items-center gap-2 font-medium ${p.textColor}`}>
                    <p.icon className="w-3 h-3" />
                    {p.label}
                  </span>
                  <span className="font-medium">{formatCurrency(p.value)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div
                    className={`h-full rounded-full ${p.color}`}
                    style={{ width: total > 0 ? `${(p.value / total) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
            {modeBreakdown.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No sales yet</p>
            )}
          </CardContent>
        </Card>

        {/* Payment breakdown */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentBreakdown.map(p => (
              <div key={p.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <p.icon className="w-3 h-3" />
                    {p.label}
                  </span>
                  <span className="font-medium">{formatCurrency(p.value)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div
                    className={`h-full rounded-full ${p.color}`}
                    style={{ width: total > 0 ? `${(p.value / total) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
            {total === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No sales yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top items */}
      {topItems && topItems.length > 0 && (
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topItems.map((item, i) => (
                <div key={item.itemId} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium text-sm">{item.name}</span>
                  <Badge variant="secondary">{item.quantitySold} sold</Badge>
                  <span className="text-sm font-semibold text-teal-600">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

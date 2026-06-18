import { useGetAnalyticsSummary, useGetSalesByDay, useGetTopItems } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingBag, CreditCard, AlertTriangle, Banknote, Smartphone,
  BarChart3, ShoppingBag as RetailIcon, Building2, PackageCheck
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { selectedLocationId } = useAuth();
  const { salesMode, isWholesale } = useSalesMode();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("today");
  const [, navigate] = useLocation();

  const { data: summary, isLoading } = useGetAnalyticsSummary({
    locationId: selectedLocationId ?? undefined,
    period,
    salesMode,
  });
  const { data: salesByDay } = useGetSalesByDay({
    locationId: selectedLocationId ?? undefined,
    days: period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365,
    salesMode,
  });
  const { data: topItems } = useGetTopItems({
    locationId: selectedLocationId ?? undefined,
    limit: 5,
    salesMode,
  });

  const s = summary as any;

  const accent = isWholesale
    ? { text: "text-blue-600", bg: "bg-blue-50", bar: "hsl(217 91% 60%)", badge: "bg-blue-600", border: "border-blue-200" }
    : { text: "text-teal-600", bg: "bg-teal-50", bar: "hsl(174 72% 36%)", badge: "bg-emerald-500", border: "border-teal-200" };

  const metrics = [
    {
      title: "Total Revenue",
      value: summary ? formatCurrency(summary.totalRevenue) : "—",
      icon: TrendingUp,
      color: accent.text,
      bg: accent.bg,
      href: "/analytics",
    },
    {
      title: "Transactions",
      value: summary?.totalTransactions?.toLocaleString() ?? "—",
      icon: ShoppingBag,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/transactions",
    },
    {
      title: "Avg. Order Value",
      value: summary ? formatCurrency(summary.averageOrderValue) : "—",
      icon: CreditCard,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      href: "/analytics",
    },
    isWholesale
      ? {
          title: "Credit Sales",
          value: s ? formatCurrency(parseFloat(s.net30Sales ?? "0") + parseFloat(s.poSales ?? "0")) : "—",
          icon: PackageCheck,
          color: "text-amber-600",
          bg: "bg-amber-50",
          href: "/transactions",
        }
      : {
          title: "Low Stock Items",
          value: summary?.lowStockItems?.toLocaleString() ?? "—",
          icon: AlertTriangle,
          color: "text-amber-600",
          bg: "bg-amber-50",
          href: "/inventory?filter=lowstock",
        },
  ];

  const paymentBreakdown = s
    ? isWholesale
      ? [
          { label: "Cash", value: parseFloat(s.cashSales ?? "0"), icon: Banknote, color: "bg-teal-500" },
          { label: "MoMo", value: parseFloat(s.momoSales ?? "0"), icon: Smartphone, color: "bg-yellow-500" },
          { label: "Card", value: parseFloat(s.cardSales ?? "0"), icon: CreditCard, color: "bg-blue-500" },
          { label: "Net 30", value: parseFloat(s.net30Sales ?? "0"), icon: CreditCard, color: "bg-indigo-500" },
          { label: "Purchase Order", value: parseFloat(s.poSales ?? "0"), icon: ShoppingBag, color: "bg-purple-500" },
        ]
      : [
          { label: "Cash", value: parseFloat(s.cashSales ?? "0"), icon: Banknote, color: "bg-teal-500" },
          { label: "MoMo", value: parseFloat(s.momoSales ?? "0"), icon: Smartphone, color: "bg-yellow-500" },
          { label: "Card", value: parseFloat(s.cardSales ?? "0"), icon: CreditCard, color: "bg-blue-500" },
        ]
    : [];

  const total = paymentBreakdown.reduce((s, p) => s + p.value, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Mode banner */}
      <div className={cn(
        "rounded-xl px-4 py-3 flex items-center gap-3 border",
        isWholesale
          ? "bg-blue-600 border-blue-700"
          : "bg-emerald-600 border-emerald-700"
      )}>
        <div className={cn("p-1.5 rounded-md", isWholesale ? "bg-blue-500" : "bg-emerald-500")}>
          {isWholesale ? <Building2 className="w-5 h-5 text-white" /> : <RetailIcon className="w-5 h-5 text-white" />}
        </div>
        <div>
          <p className="font-bold text-white text-base leading-tight">
            {isWholesale ? "Wholesale Dashboard" : "Retail Dashboard"}
          </p>
          <p className="text-white/75 text-xs">
            {isWholesale
              ? "Showing B2B wholesale transactions only"
              : "Showing retail walk-in transactions only"}
          </p>
        </div>
        <div className="ml-auto">
          <Select value={period} onValueChange={v => setPeriod(v as any)}>
            <SelectTrigger className="w-32 bg-white/15 border-white/30 text-white text-sm h-8">
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
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card
            key={m.title}
            onClick={() => navigate(m.href)}
            className="border-card-border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-border/80 active:scale-95"
          >
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
        <Card onClick={() => navigate("/analytics")} className="lg:col-span-2 border-card-border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className={cn("w-4 h-4", accent.text)} />
              {isWholesale ? "Wholesale Revenue Over Time" : "Retail Revenue Over Time"}
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
                  <Bar dataKey="revenue" fill={accent.bar} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No {isWholesale ? "wholesale" : "retail"} sales yet for this period
              </div>
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
        <Card onClick={() => navigate("/inventory")} className="border-card-border cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Top Selling Items — {isWholesale ? "Wholesale" : "Retail"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topItems.map((item, i) => (
                <div key={item.itemId} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    accent.badge
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium text-sm">{item.name}</span>
                  <Badge variant="secondary">{item.quantitySold} sold</Badge>
                  <span className={cn("text-sm font-semibold", accent.text)}>{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

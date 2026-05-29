import { useState } from "react";
import { useGetAnalyticsSummary, useGetSalesByDay, useGetTopItems } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, AlertTriangle } from "lucide-react";

const COLORS = ["hsl(174 72% 36%)", "hsl(38 90% 50%)", "hsl(198 80% 44%)", "hsl(0 72% 51%)"];

export default function AnalyticsPage() {
  const { selectedLocationId } = useAuth();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("week");

  const days = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;

  const { data: summary } = useGetAnalyticsSummary({ locationId: selectedLocationId ?? undefined, period });
  const { data: salesByDay } = useGetSalesByDay({ locationId: selectedLocationId ?? undefined, days });
  const { data: topItems } = useGetTopItems({ locationId: selectedLocationId ?? undefined, limit: 10 });

  const paymentData = summary ? [
    { name: "Cash", value: parseFloat(summary.cashSales ?? "0") },
    { name: "MoMo", value: parseFloat(summary.momoSales ?? "0") },
    { name: "Card", value: parseFloat(summary.cardSales ?? "0") },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sales performance insights</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenue", value: summary ? formatCurrency(summary.totalRevenue) : "—", icon: DollarSign, color: "text-teal-600", bg: "bg-teal-50" },
          { label: "Transactions", value: summary?.totalTransactions?.toLocaleString() ?? "—", icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avg Order", value: summary ? formatCurrency(summary.averageOrderValue) : "—", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Low Stock", value: String(summary?.lowStockItems ?? 0), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(m => (
          <Card key={m.label} className="border-card-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold mt-1">{m.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${m.bg}`}>
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend */}
        <Card className="lg:col-span-2 border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByDay && salesByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesByDay} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="date" tickFormatter={d => formatShortDate(d)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₵${v}`} />
                  <Tooltip formatter={(v: any) => [`₵${parseFloat(v).toFixed(2)}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(174 72% 36%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">No sales data</div>
            )}
          </CardContent>
        </Card>

        {/* Payment breakdown pie */}
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Split</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {paymentData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 w-full mt-2">
                  {paymentData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 text-muted-foreground">{d.name}</span>
                      <span className="font-medium">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top items bar chart */}
      {topItems && topItems.length > 0 && (
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topItems.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => [v, "Units Sold"]} />
                  <Bar dataKey="quantitySold" fill="hsl(174 72% 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {topItems.slice(0, 8).map((item, i) => (
                  <div key={item.itemId} className="flex items-center gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate">{item.name}</span>
                    <Badge variant="secondary" className="text-xs">{item.quantitySold} sold</Badge>
                    <span className="text-teal-600 font-semibold text-xs">{formatCurrency(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

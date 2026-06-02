import { useState } from "react";
import { useListSalesLogs } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ShoppingBag, Building2, Eye, ClipboardList, User, Tag } from "lucide-react";

const ACTION_ICONS: Record<string, any> = {
  sale: ShoppingBag,
  add_to_cart: Tag,
  remove_from_cart: Tag,
  checkout: ClipboardList,
  default: Eye,
};

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

export default function SalesLogsPage() {
  const { user } = useAuth();
  const { salesMode, isRetail } = useSalesMode();
  const [actionFilter, setActionFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState(salesMode);

  const { data: logs, isLoading } = useListSalesLogs({
    salesMode: modeFilter,
    action: actionFilter !== "all" ? actionFilter : undefined,
    limit: 100,
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Logs</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-muted-foreground text-sm">{logs?.length ?? 0} entries</p>
            <Badge className={cn("text-[10px]", MODE_COLORS[modeFilter])}>
              {modeFilter === "retail" ? "Retail" : "Wholesale"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={modeFilter} onValueChange={v => setModeFilter(v as "retail" | "wholesale")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="wholesale">Wholesale</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
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

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Time</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Salesperson</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mode</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Details</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : logs?.map((log: any) => {
                const Icon = ACTION_ICONS[log.action] ?? ACTION_ICONS.default;
                const color = ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground";
                const modeColor = MODE_COLORS[log.salesMode] ?? "bg-muted text-muted-foreground";
                const ModeIcon = log.salesMode === "wholesale" ? Building2 : ShoppingBag;
                return (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {log.salespersonName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-sm">{log.salespersonName ?? "System"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${modeColor}`}>
                        <ModeIcon className="w-3 h-3" /> {log.salesMode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
                        <Icon className="w-3 h-3" /> {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.details ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">{log.quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">
                      {log.total ? formatCurrency(log.total) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (!logs || logs.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No sales logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

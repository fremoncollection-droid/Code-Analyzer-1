import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, UserCheck, UserX, Clock, Coins, Lock, Trash } from "lucide-react";

const ACTION_ICONS: Record<string, any> = {
  login: UserCheck,
  logout: UserX,
  void: Trash,
  shift_open: Clock,
  shift_close: Clock,
  override: Lock,
  discount: Coins,
  create: Eye,
  update: Eye,
  delete: Trash,
  create_user: UserCheck,
  update_user: UserCheck,
  delete_user: UserX,
  default: Eye,
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-50 text-green-700",
  logout: "bg-gray-50 text-gray-600",
  void: "bg-red-50 text-red-700",
  shift_open: "bg-teal-50 text-teal-700",
  shift_close: "bg-blue-50 text-blue-700",
  override: "bg-amber-50 text-amber-700",
  discount: "bg-purple-50 text-purple-700",
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-sky-50 text-sky-700",
  delete: "bg-red-50 text-red-700",
  create_user: "bg-emerald-50 text-emerald-700",
  update_user: "bg-sky-50 text-sky-700",
  delete_user: "bg-red-50 text-red-700",
};

export default function AuditPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [actionFilter, setActionFilter] = useState("all");
  const [limit, setLimit] = useState(50);

  const { data: logs, isLoading } = useListAuditLogs({
    action: actionFilter !== "all" ? actionFilter : undefined,
    limit: limit,
  });

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  if (!isAdmin && !isManager) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-sm mt-1">Only managers and admins can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track all system actions and overrides</p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="void">Void</SelectItem>
            <SelectItem value="shift_open">Shift Open</SelectItem>
            <SelectItem value="shift_close">Shift Close</SelectItem>
            <SelectItem value="override">Override</SelectItem>
            <SelectItem value="discount">Discount</SelectItem>
            <SelectItem value="create">Inventory Added</SelectItem>
            <SelectItem value="update">Inventory Updated</SelectItem>
            <SelectItem value="delete">Inventory Deleted</SelectItem>
            <SelectItem value="create_user">User Created</SelectItem>
            <SelectItem value="update_user">User Updated</SelectItem>
            <SelectItem value="delete_user">User Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Time</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Table</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Record</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Approved By</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">IP</th>
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
                return (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {log.userName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-sm">{log.userName ?? "System"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
                        <Icon className="w-3 h-3" /> {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.tableName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.recordId ? log.recordId.slice(0, 8) : "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {log.approverName ? (
                        <span className="text-amber-600 font-medium">{log.approverName}</span>
                      ) : (
                        <span className="text-muted-foreground">Self</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground text-right font-mono">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (!logs || logs.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

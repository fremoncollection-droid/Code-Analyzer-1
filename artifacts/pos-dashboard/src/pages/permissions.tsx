import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListUsers,
  useListPermissions,
  useUpdateUserPermission,
  useDeletePermission,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Check, X, LockKeyhole, Unlock, Info } from "lucide-react";

const MODULES = [
  { key: "pos",               label: "Point of Sale",    cashierBuiltIn: true },
  { key: "inventory",         label: "Inventory" },
  { key: "transactions",      label: "Transactions" },
  { key: "analytics",         label: "Analytics" },
  { key: "tasks",             label: "Tasks" },
  { key: "discount-requests", label: "Discount Requests" },
  { key: "cashiers",          label: "Cashiers / Admins" },
  { key: "shifts",            label: "Shifts" },
  { key: "transfers",         label: "Transfers" },
  { key: "audit",             label: "Audit Log" },
  { key: "settings",          label: "Settings" },
  { key: "sales-logs",        label: "Sales Logs" },
  { key: "display",           label: "Display Mode" },
  { key: "locations",         label: "Locations" },
  { key: "categories",        label: "Categories" },
  { key: "units",             label: "Units" },
  { key: "shelves",           label: "Shelves" },
];

const ROLE_FULL_ACCESS: Record<string, string> = {
  admin:   "Admins have unrestricted access to every module — permissions cannot be configured for this role.",
  manager: "Managers already have role-based access to all standard modules. Permission grants only apply to cashier accounts.",
};

const ACTIONS = [
  { key: "canView",    label: "View" },
  { key: "canCreate",  label: "Create" },
  { key: "canEdit",    label: "Edit" },
  { key: "canDelete",  label: "Delete" },
  { key: "canApprove", label: "Approve" },
];

export default function PermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "assigned" | "unassigned">("all");

  const { data: users } = useListUsers();
  const { data: permissions } = useListPermissions(
    selectedUser ? { userId: selectedUser } : undefined
  );

  const updatePerm = useUpdateUserPermission();
  const deletePerm = useDeletePermission();

  const selectedUserData = users?.find(u => u.id === selectedUser);
  const isSelectedCashier = selectedUserData?.role === "cashier";

  const handleToggle = async (module: string, action: string, current: boolean) => {
    if (!selectedUser) return;
    try {
      const body: Record<string, boolean | string> = { module };
      const existing = permissions?.find(p => p.module === module);
      if (existing) {
        ACTIONS.forEach(a => {
          body[a.key] = a.key === action ? !current : (existing as any)[a.key] ?? false;
        });
      } else {
        ACTIONS.forEach(a => {
          body[a.key] = a.key === action;
        });
      }
      await updatePerm.mutateAsync({ userId: selectedUser, data: body as any });
      toast({ title: "Permission updated" });
      qc.invalidateQueries({ queryKey: ["/api/permissions"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleResetModule = async (module: string) => {
    const existing = permissions?.find(p => p.module === module);
    if (!existing) return;
    try {
      await deletePerm.mutateAsync({ id: existing.id });
      toast({ title: "Permission removed" });
      qc.invalidateQueries({ queryKey: ["/api/permissions"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // For filter counts: built-in modules count as "assigned" for cashiers
  const assignedModules = MODULES.filter(m => {
    if (isSelectedCashier && m.cashierBuiltIn) return true;
    return !!permissions?.find(p => p.module === m.key);
  });
  const unassignedModules = MODULES.filter(m => {
    if (isSelectedCashier && m.cashierBuiltIn) return false;
    return !permissions?.find(p => p.module === m.key);
  });

  const visibleModules =
    filterMode === "assigned"   ? assignedModules :
    filterMode === "unassigned" ? unassignedModules :
    MODULES;

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-sm mt-1">Only admins can manage permissions.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Role & Permissions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Assign granular access per user and module
        </p>
      </div>

      {/* User picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            Select User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose a user to manage their permissions" />
            </SelectTrigger>
            <SelectContent>
              {users?.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.username} — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUserData && (
            <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="outline" className="capitalize">{selectedUserData.role}</Badge>
              {selectedUserData.email && <span className="text-muted-foreground">{selectedUserData.email}</span>}
              {selectedUserData.station && (
                <Badge variant="secondary" className="text-[10px]">{selectedUserData.station}</Badge>
              )}
              {selectedUser && permissions && (
                <Badge className="bg-teal-50 text-teal-700 text-[10px] ml-auto">
                  {assignedModules.length} / {MODULES.length} modules assigned
                </Badge>
              )}
            </div>
          )}
          {/* Cashier info banner */}
          {isSelectedCashier && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Cashier role</strong> — Point of Sale access is built-in and cannot be removed.
                Toggle any other module below to grant that cashier additional access to that page.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-based access notice — shown for admin/manager instead of permission grid */}
      {selectedUser && selectedUserData && ROLE_FULL_ACCESS[selectedUserData.role] && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-900 capitalize">{selectedUserData.role} — Full Access</p>
              <p className="text-xs text-amber-700 mt-1">{ROLE_FULL_ACCESS[selectedUserData.role]}</p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {MODULES.map(m => (
                  <div key={m.key} className="flex items-center gap-1.5 text-xs text-amber-800">
                    <Check className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUser && selectedUserData && !ROLE_FULL_ACCESS[selectedUserData.role] && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600" />
                Module Access
              </CardTitle>
              <div className="flex items-center gap-1 text-xs">
                {(["all", "assigned", "unassigned"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${
                      filterMode === mode
                        ? "bg-teal-600 text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "all"        ? `All (${MODULES.length})` :
                     mode === "assigned"   ? `Assigned (${assignedModules.length})` :
                     `No Access (${unassignedModules.length})`}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-4 py-2 border-b border-border bg-muted/30">
              <div className="col-span-3">Module</div>
              <div className="col-span-1 text-center">Status</div>
              {ACTIONS.map(a => (
                <div key={a.key} className="col-span-1 text-center">{a.label}</div>
              ))}
              <div className="col-span-1" />
            </div>

            <div className="divide-y divide-border">
              {visibleModules.map(module => {
                const existing = permissions?.find(p => p.module === module.key);
                const isBuiltIn = isSelectedCashier && module.cashierBuiltIn;
                const hasAny = isBuiltIn || !!existing;

                return (
                  <div
                    key={module.key}
                    className={`grid grid-cols-12 gap-2 items-center px-4 py-2.5 text-sm transition-colors ${
                      isBuiltIn
                        ? "bg-teal-50/60"
                        : hasAny
                        ? "bg-teal-50/30 hover:bg-teal-50/50"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Module name */}
                    <div className="col-span-3 flex items-center gap-2 font-medium">
                      {hasAny
                        ? <Unlock className="w-3 h-3 text-teal-600 flex-shrink-0" />
                        : <LockKeyhole className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      }
                      {module.label}
                    </div>

                    {/* Status badge */}
                    <div className="col-span-1 flex justify-center">
                      {isBuiltIn ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-teal-600 text-white font-semibold whitespace-nowrap">
                          Built-in
                        </Badge>
                      ) : hasAny ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 font-semibold">
                          Assigned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                          No Access
                        </Badge>
                      )}
                    </div>

                    {/* Toggle buttons — disabled for built-in modules */}
                    {ACTIONS.map(action => {
                      const val = isBuiltIn
                        ? action.key === "canView"
                        : (existing as any)?.[action.key] ?? false;
                      return (
                        <div key={action.key} className="col-span-1 flex justify-center">
                          <button
                            onClick={() => !isBuiltIn && handleToggle(module.key, action.key, val)}
                            disabled={isBuiltIn}
                            title={
                              isBuiltIn
                                ? "Built-in access for this role"
                                : val ? `Revoke ${action.label}` : `Grant ${action.label}`
                            }
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                              isBuiltIn
                                ? "bg-teal-600/40 text-teal-700 cursor-default"
                                : val
                                ? "bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
                                : "bg-muted border border-border hover:bg-muted/80 text-muted-foreground cursor-pointer"
                            }`}
                          >
                            {val ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    })}

                    {/* Remove button — not shown for built-in */}
                    <div className="col-span-1 flex justify-end">
                      {existing && !isBuiltIn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
                          onClick={() => handleResetModule(module.key)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleModules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {filterMode === "assigned" ? "No modules assigned yet." : "All modules have been assigned."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

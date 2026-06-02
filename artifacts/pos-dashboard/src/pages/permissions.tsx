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
import { Shield, Users, Layers, Check, X } from "lucide-react";

const MODULES = [
  "pos", "inventory", "transactions", "analytics", "leads", "tasks",
  "discount-requests", "cashiers", "shifts", "transfers", "audit", "settings",
  "sales-logs", "display", "locations", "categories", "units", "shelves",
];

const ACTIONS = [
  { key: "canView", label: "View", icon: Check },
  { key: "canCreate", label: "Create", icon: Check },
  { key: "canEdit", label: "Edit", icon: Check },
  { key: "canDelete", label: "Delete", icon: Check },
  { key: "canApprove", label: "Approve", icon: Check },
];

export default function PermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");

  const { data: users } = useListUsers();
  const { data: permissions } = useListPermissions(
    selectedUser ? { userId: selectedUser } : undefined
  );

  const updatePerm = useUpdateUserPermission();
  const deletePerm = useDeletePermission();

  const selectedUserData = users?.find(u => u.id === selectedUser);

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
      qc.invalidateQueries({ queryKey: ["listPermissions"] });
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
      qc.invalidateQueries({ queryKey: ["listPermissions"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Role & Permissions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Admin control: assign granular permissions per user and module
        </p>
      </div>

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
              <SelectValue placeholder="Select a user to manage permissions" />
            </SelectTrigger>
            <SelectContent>
              {users?.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.username} ({u.role}) {u.locationId ? "— " + u.locationId : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUserData && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="outline">{selectedUserData.role}</Badge>
              <span className="text-muted-foreground">{selectedUserData.email}</span>
              {selectedUserData.station && (
                <Badge variant="secondary" className="text-[10px]">{selectedUserData.station}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" />
              Module Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 py-1">
                <div className="col-span-2">Module</div>
                <div className="col-span-1 text-center">View</div>
                <div className="col-span-1 text-center">Create</div>
                <div className="col-span-1 text-center">Edit</div>
                <div className="col-span-1 text-center">Delete</div>
                <div className="col-span-1 text-center">Approve</div>
                <div className="col-span-1"></div>
              </div>
              {MODULES.map(module => {
                const existing = permissions?.find(p => p.module === module);
                return (
                  <div
                    key={module}
                    className={`grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-md text-sm ${
                      existing ? "bg-teal-50/50 border border-teal-100" : "border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="col-span-2 flex items-center gap-2 font-medium">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      {module}
                    </div>
                    {ACTIONS.map(action => {
                      const val = (existing as any)?.[action.key] ?? false;
                      return (
                        <div key={action.key} className="col-span-1 flex justify-center">
                          <button
                            onClick={() => handleToggle(module, action.key, val)}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                              val
                                ? "bg-teal-600 text-white"
                                : "bg-muted border border-border hover:bg-muted/80"
                            }`}
                          >
                            {val ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        </div>
                      );
                    })}
                    <div className="col-span-1 flex justify-end">
                      {existing && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleResetModule(module)}>
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

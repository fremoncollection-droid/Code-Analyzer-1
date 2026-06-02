import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useListLocations } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, User, Edit2, Trash2, UserCheck, UserX } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700",
  manager: "bg-blue-50 text-blue-700",
  cashier: "bg-teal-50 text-teal-700",
  supervisor: "bg-amber-50 text-amber-700",
};

export default function CashiersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState({
    username: "", email: "", password: "", pin: "",
    role: "cashier", locationId: "", station: "", isActive: true,
  });

  const { data: users, isLoading } = useListUsers({ role: "cashier" });
  const { data: locations } = useListLocations();

  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Cashier created" }); },
      onError: () => toast({ title: "Create failed", variant: "destructive" }),
    },
  });

  const updateUser = useUpdateUser({
    mutation: {
      onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Cashier updated" }); },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const deleteUser = useDeleteUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Cashier deleted" }); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ["/api/users"] }); }
  function closeDialog() { setDialogOpen(false); setEditUser(null); }

  function openCreate() {
    setEditUser(null);
    setForm({ username: "", email: "", password: "", pin: "", role: "cashier", locationId: "none", station: "", isActive: true });
    setDialogOpen(true);
  }

  function openEdit(u: any) {
    setEditUser(u);
    setForm({
      username: u.username, email: u.email, password: "", pin: "",
      role: u.role, locationId: u.locationId ?? "none", station: u.station ?? "", isActive: u.isActive,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editUser) {
      const updates: any = {};
      if (form.email !== editUser.email) updates.email = form.email;
      if (form.role !== editUser.role) updates.role = form.role;
      if (form.locationId !== (editUser.locationId ?? "none")) updates.locationId = form.locationId === "none" ? null : form.locationId;
      if (form.station !== (editUser.station ?? "")) updates.station = form.station || null;
      if (form.isActive !== editUser.isActive) updates.isActive = form.isActive;
      if (form.password) updates.password = form.password;
      if (form.pin) updates.pin = form.pin;
      if (Object.keys(updates).length === 0) { closeDialog(); return; }
      updateUser.mutate({ id: editUser.id, data: updates });
    } else {
      if (!form.username || !form.email || !form.password) {
        toast({ title: "Username, email, and password required", variant: "destructive" });
        return;
      }
      createUser.mutate({
        data: {
          username: form.username,
          email: form.email,
          password: form.password,
          pin: form.pin || undefined,
          role: form.role,
          locationId: form.locationId || undefined,
          station: form.station || undefined,
        },
      });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cashier Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create and manage cashier accounts</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Cashier
        </Button>
      </div>

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Role</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Location</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Station</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : users?.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {u.username?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.username}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {locations?.find(l => l.id === u.locationId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.station ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <Badge variant="secondary" className="text-xs text-green-700 bg-green-50 gap-1"><UserCheck className="w-3 h-3" /> Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-red-600 gap-1"><UserX className="w-3 h-3" /> Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteUser.mutate({ id: u.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (!users || users.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No cashiers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? "Edit Cashier" : "Add Cashier"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editUser} />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Password {editUser ? "(leave to keep)" : "*"}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>PIN (optional)</Label>
                <Input value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} placeholder="4-6 digits" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Station</Label>
              <Input value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} placeholder="e.g. Counter 1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <Label htmlFor="active" className="text-sm cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createUser.isPending || updateUser.isPending}>
              {editUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

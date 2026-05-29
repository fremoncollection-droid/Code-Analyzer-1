import { useState } from "react";
import { useListShifts, useCreateShift, useUpdateShift, useDeleteShift } from "@workspace/api-client-react";
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
import { Plus, Calendar, Clock, User, CheckCircle2, Edit2, Trash2, LogIn, LogOut } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  active: "bg-teal-50 text-teal-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
};

export default function ShiftsPage() {
  const { user, selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editShift, setEditShift] = useState<any | null>(null);
  const [form, setForm] = useState({ userId: "", locationId: selectedLocationId ?? "", startTime: "", endTime: "", openingCash: "", notes: "" });

  const { data: shifts, isLoading } = useListShifts({ locationId: selectedLocationId ?? undefined });
  const { data: locations } = useListLocations();

  const createShift = useCreateShift({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Shift scheduled" }); } } });
  const updateShift = useUpdateShift({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Shift updated" }); } } });
  const deleteShift = useDeleteShift({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Shift deleted" }); } } });

  const canManage = ["admin", "manager", "supervisor"].includes(user?.role ?? "");

  function invalidate() { qc.invalidateQueries({ queryKey: ["/api/shifts"] }); }
  function closeDialog() { setDialogOpen(false); setEditShift(null); }

  function openCreate() {
    setEditShift(null);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setForm({ userId: user?.id ?? "", locationId: selectedLocationId ?? "", startTime: now.toISOString().slice(0, 16), endTime: "", openingCash: "", notes: "" });
    setDialogOpen(true);
  }

  function handleClockIn(shift: any) {
    updateShift.mutate({ id: shift.id, data: { status: "active" } });
  }
  function handleClockOut(shift: any) {
    updateShift.mutate({ id: shift.id, data: { status: "completed", endTime: new Date().toISOString() } });
  }

  function handleSubmit() {
    if (editShift) {
      updateShift.mutate({ id: editShift.id, data: { status: editShift.status, openingCash: form.openingCash || undefined, notes: form.notes || undefined } });
    } else {
      createShift.mutate({ data: { userId: form.userId || user!.id, locationId: form.locationId, startTime: new Date(form.startTime).toISOString(), endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined, openingCash: form.openingCash || undefined, notes: form.notes || undefined } });
    }
  }

  const myShift = shifts?.find(s => s.userId === user?.id && s.status === "active");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shifts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schedule and track work shifts</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Schedule Shift
          </Button>
        )}
      </div>

      {/* My active shift */}
      {myShift && (
        <div className="flex items-center gap-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <CheckCircle2 className="w-6 h-6 text-teal-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-teal-800">You are currently clocked in</p>
            <p className="text-sm text-teal-600">Started: {formatDate(myShift.startTime)}</p>
          </div>
          <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 gap-2" onClick={() => handleClockOut(myShift)}>
            <LogOut className="w-3 h-3" /> Clock Out
          </Button>
        </div>
      )}

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Staff</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Location</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Start</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">End</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Status</th>
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
              ) : shifts?.map(shift => (
                <tr key={shift.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {shift.userName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="font-medium">{shift.userName ?? "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{shift.locationName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(shift.startTime)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{shift.endTime ? formatDate(shift.endTime) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[shift.status] ?? "bg-muted text-muted-foreground"}`}>
                      {shift.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {shift.status === "scheduled" && shift.userId === user?.id && (
                        <Button size="sm" variant="ghost" className="text-teal-600 gap-1" onClick={() => handleClockIn(shift)}>
                          <LogIn className="w-3 h-3" /> Clock In
                        </Button>
                      )}
                      {shift.status === "active" && shift.userId === user?.id && (
                        <Button size="sm" variant="ghost" className="text-amber-600 gap-1" onClick={() => handleClockOut(shift)}>
                          <LogOut className="w-3 h-3" /> Clock Out
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteShift.mutate({ id: shift.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (!shifts || shifts.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No shifts scheduled</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Schedule dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Shift</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Location</Label>
              <Select value={form.locationId} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End Time (optional)</Label>
                <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Opening Cash (₵)</Label>
              <Input type="number" step="0.01" value={form.openingCash} onChange={e => setForm(f => ({ ...f, openingCash: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.locationId || !form.startTime || createShift.isPending}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

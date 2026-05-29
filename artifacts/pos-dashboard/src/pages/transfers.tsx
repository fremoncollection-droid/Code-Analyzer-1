import { useState } from "react";
import { useListTransfers, useCreateTransfer, useApproveTransfer, useListInventory, useListLocations } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowRight, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  completed: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function TransfersPage() {
  const { user, selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ itemId: "", fromLocationId: "", toLocationId: "", quantity: "1", notes: "" });

  const { data: transfers, isLoading } = useListTransfers({ locationId: selectedLocationId ?? undefined });
  const { data: inventory } = useListInventory({ locationId: selectedLocationId ?? undefined });
  const { data: locations } = useListLocations();

  const createTransfer = useCreateTransfer({ mutation: { onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Transfer requested" }); } } });
  const approveTransfer = useApproveTransfer({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Transfer approved" }); } } });

  const canApprove = ["admin", "manager"].includes(user?.role ?? "");
  function invalidate() { qc.invalidateQueries({ queryKey: ["/api/transfers"] }); }

  function handleSubmit() {
    createTransfer.mutate({ data: {
      itemId: form.itemId,
      fromLocationId: form.fromLocationId,
      toLocationId: form.toLocationId,
      quantity: parseInt(form.quantity),
      notes: form.notes || undefined,
    }});
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Transfers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Move inventory between locations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Request Transfer
        </Button>
      </div>

      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Item</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Route</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Qty</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date</th>
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
              ) : transfers?.map(t => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.itemName ?? t.itemId}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t.fromLocationName ?? t.fromLocationId}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{t.toLocationName ?? t.toLocationId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{t.quantity}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.createdAt ? formatDate(t.createdAt) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[t.status] ?? "bg-muted text-muted-foreground"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canApprove && t.status === "pending" && (
                      <Button size="sm" variant="ghost" className="text-teal-600 gap-1" onClick={() => approveTransfer.mutate({ id: t.id })}>
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && (!transfers || transfers.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transfers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Item *</Label>
              <Select value={form.itemId} onValueChange={v => setForm(f => ({ ...f, itemId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventory?.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} (Qty: {i.quantity})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From Location *</Label>
                <Select value={form.fromLocationId} onValueChange={v => setForm(f => ({ ...f, fromLocationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
                  <SelectContent>{locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>To Location *</Label>
                <Select value={form.toLocationId} onValueChange={v => setForm(f => ({ ...f, toLocationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
                  <SelectContent>{locations?.filter(l => l.id !== form.fromLocationId).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity *</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.itemId || !form.fromLocationId || !form.toLocationId || createTransfer.isPending}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

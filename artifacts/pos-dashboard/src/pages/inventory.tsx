import { useState } from "react";
import { useListInventory, useListCategories, useListLocations, useListUnits, useListShelves, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, AlertTriangle, Package } from "lucide-react";

export default function InventoryPage() {
  const { selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    price: "",
    cost: "",
    quantity: "0",
    minQuantity: "5",
    categoryId: "",
    unitId: "",
    shelfId: "",
    unit: "piece",
  });

  const { data: inventory, isLoading } = useListInventory({
    locationId: selectedLocationId ?? undefined,
    search: search || undefined,
  });
  const { data: categories } = useListCategories();
  const { data: locations } = useListLocations();
  const { data: units } = useListUnits();
  const { data: shelves } = useListShelves();

  const createItem = useCreateInventoryItem({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Item created" }); } } });
  const updateItem = useUpdateInventoryItem({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Item updated" }); } } });
  const deleteItem = useDeleteInventoryItem({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Item deleted" }); } } });

  function invalidate() { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); }

  function openCreate() {
    setEditItem(null);
    setForm({ name: "", sku: "", price: "", cost: "", quantity: "0", minQuantity: "5", categoryId: "", unitId: "", shelfId: "", unit: "piece" });
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      price: item.price,
      cost: item.cost ?? "",
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      categoryId: item.categoryId ?? "",
      unitId: item.unitId ?? "",
      shelfId: item.shelfId ?? "",
      unit: item.unit ?? "piece",
    });
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setEditItem(null); }

  function handleSubmit() {
    const payload = {
      name: form.name,
      sku: form.sku || undefined,
      price: form.price,
      cost: form.cost || undefined,
      quantity: parseInt(form.quantity),
      minQuantity: parseInt(form.minQuantity),
      categoryId: form.categoryId || undefined,
      unitId: form.unitId || undefined,
      shelfId: form.shelfId || undefined,
      unit: form.unit,
      locationId: selectedLocationId ?? undefined,
    };
    if (editItem) {
      updateItem.mutate({ id: editItem.id, data: payload });
    } else {
      createItem.mutate({ data: payload });
    }
  }

  const lowStockItems = inventory?.filter(i => i.quantity <= (i.minQuantity ?? 0)) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{inventory?.length ?? 0} items</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{lowStockItems.length} item{lowStockItems.length > 1 ? "s are" : " is"} running low on stock</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory..." className="pl-9" />
      </div>

      {/* Table */}
      <Card className="border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Item</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Category</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Price</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Stock</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-48" /></td>
                  </tr>
                ))
              ) : inventory?.map(item => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                        {item.unitName && <p className="text-xs text-muted-foreground">{item.unitName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.categoryName ? <Badge variant="secondary" className="text-xs">{item.categoryName}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${item.quantity <= (item.minQuantity ?? 0) ? "text-amber-600" : "text-foreground"}`}>
                      {item.quantity}
                    </span>
                    <span className="text-muted-foreground text-xs"> / {item.minQuantity ?? 0} min</span>
                    {item.quantity <= (item.minQuantity ?? 0) && (
                      <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteItem.mutate({ id: item.id })}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && inventory?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
            </div>
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={form.unitId} onValueChange={v => setForm(f => ({ ...f, unitId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Selling Price (₵) *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Cost Price (₵)</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Min Stock Alert</Label>
              <Input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Shelf</Label>
              <Select value={form.shelfId} onValueChange={v => setForm(f => ({ ...f, shelfId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select shelf" /></SelectTrigger>
                <SelectContent>
                  {shelves?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.zone})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.price || createItem.isPending || updateItem.isPending}>
              {editItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

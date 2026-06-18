import { useState, useMemo, useRef, useCallback } from "react";
import { useSearch } from "wouter";
import { useListInventory, useListCategories, useListLocations, useListUnits, useListShelves, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, AlertTriangle, Package, TrendingUp, DollarSign, ShoppingBag, BarChart2, X, Filter, ChevronUp, ChevronDown } from "lucide-react";

export default function InventoryPage() {
  const { selectedLocationId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const urlSearch = useSearch();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [missingFilter, setMissingFilter] = useState<string | null>(() => {
    const params = new URLSearchParams(urlSearch);
    return params.get("filter") || null;
  });
  const [showKpis, setShowKpis] = useState(true);
  const [tableHeight, setTableHeight] = useState(480);
  const dragState = useRef<{ startY: number; startH: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startH: tableHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const delta = ev.clientY - dragState.current.startY;
      setTableHeight(Math.max(180, Math.min(1200, dragState.current.startH + delta)));
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [tableHeight]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", price: "", wholesalePrice1: "", wholesalePrice2: "",
    cost: "", quantity: "0", minQuantity: "5", categoryId: "", unitId: "", shelfId: "", unit: "piece",
  });

  const { data: inventory, isLoading } = useListInventory({
    locationId: selectedLocationId ?? undefined,
    search: search || undefined,
  });
  const { data: categories } = useListCategories();
  const { data: units } = useListUnits();
  const { data: shelves } = useListShelves();

  const createItem = useCreateInventoryItem({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Item created" }); } } });
  const updateItem = useUpdateInventoryItem({ mutation: { onSuccess: () => { invalidate(); closeDialog(); toast({ title: "Item updated" }); } } });
  const deleteItem = useDeleteInventoryItem({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Item deleted" }); } } });

  function invalidate() { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); }
  function openCreate() {
    setEditItem(null);
    setForm({ name: "", sku: "", price: "", wholesalePrice1: "", wholesalePrice2: "", cost: "", quantity: "0", minQuantity: "5", categoryId: "", unitId: "", shelfId: "", unit: "piece" });
    setDialogOpen(true);
  }
  function openEdit(item: any) {
    setEditItem(item);
    setForm({ name: item.name, sku: item.sku ?? "", price: item.price, wholesalePrice1: item.wholesalePrice1 ?? "", wholesalePrice2: item.wholesalePrice2 ?? "", cost: item.cost ?? "", quantity: String(item.quantity), minQuantity: String(item.minQuantity), categoryId: item.categoryId ?? "", unitId: item.unitId ?? "", shelfId: item.shelfId ?? "", unit: item.unit ?? "piece" });
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditItem(null); }
  function handleSubmit() {
    const payload = {
      name: form.name,
      sku: form.sku || undefined,
      price: form.price || "0",
      wholesalePrice1: form.wholesalePrice1 || undefined,
      wholesalePrice2: form.wholesalePrice2 || undefined,
      cost: form.cost || undefined,
      quantity: parseInt(form.quantity) || 0,
      minQuantity: parseInt(form.minQuantity) || 0,
      categoryId: form.categoryId || undefined,
      unitId: form.unitId || undefined,
      shelfId: form.shelfId || undefined,
      unit: form.unit,
      locationId: selectedLocationId ?? undefined,
    };
    if (editItem) updateItem.mutate({ id: editItem.id, data: payload });
    else createItem.mutate({ data: payload });
  }

  const allItems = inventory ?? [];
  const lowStockItems = allItems.filter(i => i.quantity <= (i.minQuantity ?? 0));

  const MISSING_OPTIONS = [
    { key: "lowstock",   label: "Low Stock" },
    { key: "category",   label: "No Category" },
    { key: "cost",       label: "No Cost Price" },
    { key: "sell",       label: "No Sell Price" },
    { key: "wholesale",  label: "No Wholesale" },
    { key: "stock",      label: "Zero Stock" },
  ];

  const items = useMemo(() => {
    let list = allItems;
    if (categoryFilter !== "__all__")
      list = list.filter(i => i.categoryId === categoryFilter);
    if (missingFilter === "lowstock")  list = list.filter(i => (i.quantity ?? 0) <= (i.minQuantity ?? 0));
    if (missingFilter === "category")  list = list.filter(i => !i.categoryId);
    if (missingFilter === "cost")      list = list.filter(i => !i.cost || parseFloat(i.cost) === 0);
    if (missingFilter === "sell")      list = list.filter(i => !i.price || parseFloat(i.price) === 0);
    if (missingFilter === "wholesale") list = list.filter(i => !i.wholesalePrice1);
    if (missingFilter === "stock")     list = list.filter(i => (i.quantity ?? 0) === 0);
    return list;
  }, [allItems, categoryFilter, missingFilter]);

  // Compute totals
  const totalSellingValue = items.reduce((sum, i) => sum + parseFloat(i.price ?? "0") * (i.quantity ?? 0), 0);
  const totalCostValue = items.reduce((sum, i) => sum + parseFloat(i.cost ?? "0") * (i.quantity ?? 0), 0);
  const totalProfit = totalSellingValue - totalCostValue;
  const profitMargin = totalSellingValue > 0 ? (totalProfit / totalSellingValue) * 100 : 0;
  const itemsWithCost = items.filter(i => i.cost && parseFloat(i.cost) > 0).length;

  return (
    <div className="flex flex-col px-6 pt-6 pb-8 gap-4">

      {/* ── Top section (scrolls with page) ── */}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {(categoryFilter !== "__all__" || missingFilter)
                ? <>{items.length} of {allItems.length} items</>
                : <>{allItems.length} items</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowKpis(v => !v)}
              title={showKpis ? "Collapse summary" : "Expand summary"}
            >
              {showKpis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showKpis ? "Collapse" : "Expand"}
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </div>
        </div>

        {/* Financial summary cards */}
        {!isLoading && items.length > 0 && showKpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-card-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="w-4 h-4 text-teal-600" />
                  <p className="text-xs text-muted-foreground font-medium">Stock Value</p>
                </div>
                <p className="text-xl font-bold text-teal-700">{formatCurrency(totalSellingValue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">at selling price</p>
              </CardContent>
            </Card>
            <Card className="border-card-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-orange-500" />
                  <p className="text-xs text-muted-foreground font-medium">Total Cost</p>
                </div>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(totalCostValue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{itemsWithCost} items with cost set</p>
              </CardContent>
            </Card>
            <Card className="border-card-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-muted-foreground font-medium">Potential Profit</p>
                </div>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(totalProfit)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">if all stock is sold</p>
              </CardContent>
            </Card>
            <Card className="border-card-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-muted-foreground font-medium">Profit Margin</p>
                </div>
                <p className={`text-xl font-bold ${profitMargin >= 20 ? "text-green-600" : profitMargin >= 10 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {profitMargin.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">overall average</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Low stock alert */}
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{lowStockItems.length} item{lowStockItems.length > 1 ? "s are" : " is"} running low on stock</span>
          </div>
        )}

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {categories?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Filter className="w-3.5 h-3.5" /> Missing:
            </div>
            {MISSING_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setMissingFilter(missingFilter === opt.key ? null : opt.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  missingFilter === opt.key
                    ? "bg-destructive/10 border-destructive/40 text-destructive"
                    : "bg-muted/50 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {opt.label}
                {missingFilter === opt.key && <X className="inline w-3 h-3 ml-1 -mr-0.5" />}
              </button>
            ))}
            {(categoryFilter !== "__all__" || missingFilter) && (
              <button
                onClick={() => { setCategoryFilter("__all__"); setMissingFilter(null); }}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground ml-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Drag handle ── */}
      <div
        className="group flex flex-col items-center gap-1 py-1 cursor-row-resize select-none"
        onMouseDown={onDragStart}
        title="Drag to resize table"
      >
        <div className="w-12 h-1 rounded-full bg-border group-hover:bg-teal-400 transition-colors duration-150" />
        <div className="w-8 h-1 rounded-full bg-border/60 group-hover:bg-teal-300 transition-colors duration-150" />
      </div>

      {/* ── Table (height draggable) ── */}
      <div style={{ height: tableHeight }} className="flex flex-col">
        <Card className="border-card-border flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium sticky left-0 z-20 bg-card">Item</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Category</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Cost Price</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Sell Price</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Wholesale</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Profit/unit</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Stock</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total Cost</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={9} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-48" /></td>
                  </tr>
                ))
              ) : items.map(item => {
                const sellPrice = parseFloat(item.price ?? "0");
                const costPrice = parseFloat(item.cost ?? "0");
                const profitPerUnit = costPrice > 0 ? sellPrice - costPrice : null;
                const totalItemCost = costPrice * (item.quantity ?? 0);
                const margin = costPrice > 0 && sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice * 100) : null;

                return (
                  <tr key={item.id} className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 z-10 bg-background group-hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
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
                      {item.categoryName
                        ? <Badge variant="secondary" className="text-xs">{item.categoryName}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {costPrice > 0
                        ? <span className="text-orange-600 font-medium">{formatCurrency(costPrice)}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(sellPrice)}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {item.wholesalePrice1
                        ? <span className="text-blue-600 font-medium">{formatCurrency(item.wholesalePrice1)}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {profitPerUnit !== null ? (
                        <div>
                          <span className={`font-semibold text-sm ${profitPerUnit >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {formatCurrency(profitPerUnit)}
                          </span>
                          {margin !== null && (
                            <p className="text-[10px] text-muted-foreground">{margin.toFixed(1)}%</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${item.quantity <= (item.minQuantity ?? 0) ? "text-amber-600" : "text-foreground"}`}>
                        {item.quantity}
                      </span>
                      <span className="text-muted-foreground text-xs"> / {item.minQuantity ?? 0}</span>
                      {item.quantity <= (item.minQuantity ?? 0) && (
                        <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalItemCost > 0
                        ? <span className="text-orange-600 font-medium text-sm">{formatCurrency(totalItemCost)}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit2 className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteItem.mutate({ id: item.id })}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No items found</td></tr>
              )}
            </tbody>
          </table>
          </div>{/* end overflow-auto scroll area */}

          {/* Pinned totals bar — outside scroll, always visible */}
          {!isLoading && items.length > 0 && (
            <div className="shrink-0 border-t-2 border-border bg-muted/30 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-semibold">
              <span className="text-muted-foreground mr-auto">Totals · {items.length} items</span>
              <span className="text-muted-foreground font-normal text-xs">Avg cost: <span className="text-orange-600 font-semibold">{totalCostValue > 0 ? formatCurrency(totalCostValue / (itemsWithCost || 1)) : "—"}</span></span>
              <span className="text-muted-foreground font-normal text-xs">Avg sell: <span className="font-semibold">{formatCurrency(totalSellingValue / items.length)}</span></span>
              <span className="text-muted-foreground font-normal text-xs">Avg profit: <span className={`font-semibold ${totalProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(totalProfit / (itemsWithCost || 1))}</span></span>
              <span className="text-muted-foreground font-normal text-xs">Stock: <span className="font-semibold">{items.reduce((s, i) => s + (i.quantity ?? 0), 0)} units</span></span>
              <span className="text-muted-foreground font-normal text-xs">Total cost: <span className="text-orange-600 font-bold">{formatCurrency(totalCostValue)}</span></span>
            </div>
          )}
        </Card>
      </div>{/* end table height wrapper */}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Select value={form.unitId || "__none__"} onValueChange={v => setForm(f => ({ ...f, unitId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing section */}
              <div className="col-span-2 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Cost Price (₵)</Label>
                    <Input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label>Selling Price (₵)</Label>
                    <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                {/* Live profit preview */}
                {form.cost && form.price && parseFloat(form.cost) > 0 && parseFloat(form.price) > 0 && (
                  <div className="flex items-center gap-4 pt-1 border-t border-border text-xs">
                    <span className="text-muted-foreground">Profit per unit:</span>
                    <span className={`font-bold ${parseFloat(form.price) - parseFloat(form.cost) >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {formatCurrency(parseFloat(form.price) - parseFloat(form.cost))}
                    </span>
                    <span className="text-muted-foreground">Margin:</span>
                    <span className="font-bold text-blue-600">
                      {((parseFloat(form.price) - parseFloat(form.cost)) / parseFloat(form.price) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">Wholesale Pricing (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tier 1 Price (₵)</Label>
                      <Input type="number" step="0.01" value={form.wholesalePrice1} onChange={e => setForm(f => ({ ...f, wholesalePrice1: e.target.value }))} placeholder="0.00" className="bg-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tier 2 Price (₵)</Label>
                      <Input type="number" step="0.01" value={form.wholesalePrice2} onChange={e => setForm(f => ({ ...f, wholesalePrice2: e.target.value }))} placeholder="0.00" className="bg-white" />
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-600">Leave blank to use selling price for wholesale orders</p>
                </div>
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
                <Select value={form.categoryId || "__none__"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Shelf</Label>
                <Select value={form.shelfId || "__none__"} onValueChange={v => setForm(f => ({ ...f, shelfId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select shelf" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {shelves?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.zone})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || createItem.isPending || updateItem.isPending}>
              {editItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

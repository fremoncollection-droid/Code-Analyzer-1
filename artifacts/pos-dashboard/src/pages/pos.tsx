import { useState, useEffect, useRef } from "react";
import { useListInventory, useListCategories, useCreateTransaction, useInitiateMoMo, useGetMoMoStatus } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Wifi, WifiOff, CheckCircle2, Printer, X } from "lucide-react";
import ReceiptModal from "@/components/receipt-modal";

const TAX_RATE = 0.15;

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

const OFFLINE_QUEUE_KEY = "pos_offline_queue";

function loadOfflineQueue(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveOfflineQueue(q: any[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

export default function POSPage() {
  const { selectedLocationId } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo" | "card">("cash");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [momoPhone, setMomoPhone] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "Telecel">("MTN");
  const [momoRef, setMomoRef] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(loadOfflineQueue().length);
  const [completedTx, setCompletedTx] = useState<any | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const { data: categories } = useListCategories();
  const { data: inventory } = useListInventory({
    locationId: selectedLocationId ?? undefined,
    search: search || undefined,
    categoryId: selectedCategory ?? undefined,
  });

  const createTx = useCreateTransaction({
    mutation: {
      onSuccess: (tx) => {
        setCart([]);
        setCheckoutOpen(false);
        setMomoRef(null);
        setCompletedTx(tx);
        setReceiptOpen(true);
        toast({ title: "Sale recorded", description: `Receipt: ${tx.receiptNumber}` });
      },
      onError: (err: any) => {
        // If offline, queue it
        if (!navigator.onLine) {
          queueOffline();
        } else {
          toast({ title: "Sale failed", description: err.message, variant: "destructive" });
        }
      },
    },
  });

  const initiateMoMo = useInitiateMoMo({
    mutation: {
      onSuccess: (r) => {
        setMomoRef(r.reference);
        toast({ title: "MoMo request sent", description: r.message });
      },
      onError: () => {
        toast({ title: "MoMo failed", description: "Could not initiate payment", variant: "destructive" });
      },
    },
  });

  const { data: momoStatus } = useGetMoMoStatus(momoRef ?? "placeholder", {
    query: {
      enabled: !!momoRef,
      refetchInterval: 2000,
    } as any,
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  async function syncOfflineQueue() {
    const queue = loadOfflineQueue();
    if (queue.length === 0) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/transactions/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("pos_token")}`,
        },
        body: JSON.stringify({ transactions: queue }),
      });
      if (res.ok) {
        saveOfflineQueue([]);
        setOfflineCount(0);
        toast({ title: "Offline sales synced", description: `${queue.length} transaction(s) uploaded` });
      }
    } catch {}
  }

  function queueOffline() {
    const queue = loadOfflineQueue();
    queue.push(buildTxPayload());
    saveOfflineQueue(queue);
    setOfflineCount(queue.length);
    setCart([]);
    setCheckoutOpen(false);
    toast({ title: "Saved offline", description: "Will sync when connection is restored" });
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;

  function buildTxPayload() {
    return {
      locationId: selectedLocationId!,
      items: cart.map(i => ({
        itemId: i.itemId,
        name: i.name,
        quantity: i.quantity,
        price: i.price.toFixed(2),
        total: (i.price * i.quantity).toFixed(2),
      })),
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      paymentMethod,
      momoPhone: paymentMethod === "momo" ? momoPhone : undefined,
      momoNetwork: paymentMethod === "momo" ? momoNetwork : undefined,
      momoReference: momoRef ?? undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
    };
  }

  function addToCart(item: any) {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        return prev.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: parseFloat(item.price), quantity: 1, unit: item.unit ?? "piece" }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  }

  function handleCheckout() {
    if (cart.length === 0) { toast({ title: "Cart is empty", variant: "destructive" }); return; }
    if (!selectedLocationId) { toast({ title: "No location selected", variant: "destructive" }); return; }
    if (!isOnline) { queueOffline(); return; }
    createTx.mutate({ data: buildTxPayload() });
  }

  function handleMoMoInitiate() {
    if (!momoPhone) { toast({ title: "Enter MoMo phone number", variant: "destructive" }); return; }
    initiateMoMo.mutate({ data: { phone: momoPhone, network: momoNetwork, amount: total.toFixed(2), reference: `POS-${Date.now()}` } });
  }

  const momoConfirmed = momoStatus?.status === "successful";

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen overflow-hidden">
      {/* Product grid */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border overflow-hidden">
        {/* Search + filter */}
        <div className="p-4 border-b border-border space-y-3 bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors", !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >All</button>
            {categories?.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors", selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-teal-600"><Wifi className="w-3 h-3" /> Online</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600"><WifiOff className="w-3 h-3" /> Offline mode</span>
          )}
          {offlineCount > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{offlineCount} queued</Badge>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedLocationId ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No location selected</p>
              <p className="text-sm">Select a location from the sidebar to start selling</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {inventory?.map(item => {
                const inCart = cart.find(c => c.itemId === item.id);
                const outOfStock = item.quantity <= 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => !outOfStock && addToCart(item)}
                    disabled={outOfStock}
                    className={cn(
                      "relative p-3 rounded-xl border text-left transition-all hover:shadow-md active:scale-95",
                      inCart ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
                      outOfStock && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                        {inCart.quantity}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                      <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-xs leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-primary font-semibold text-sm mt-1">{formatCurrency(item.price)}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {outOfStock ? "Out of stock" : `${item.quantity} ${item.unit ?? "pcs"}`}
                    </p>
                  </button>
                );
              })}
              {inventory?.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>No products found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="w-80 xl:w-96 flex flex-col bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Cart
            {cart.length > 0 && <Badge className="ml-auto">{cart.length}</Badge>}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Tap a product to add it</p>
            </div>
          ) : cart.map(item => (
            <div key={item.itemId} className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.itemId, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                <button onClick={() => updateQty(item.itemId, 1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="w-16 text-right">
                <p className="text-xs font-semibold">{formatCurrency(item.price * item.quantity)}</p>
              </div>
              <button onClick={() => removeFromCart(item.itemId)} className="text-destructive hover:text-destructive/70 ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT (15%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-1.5">
            {(["cash", "momo", "card"] as const).map(pm => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                  paymentMethod === pm ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                {pm === "cash" && <Banknote className="w-4 h-4" />}
                {pm === "momo" && <Smartphone className="w-4 h-4" />}
                {pm === "card" && <CreditCard className="w-4 h-4" />}
                {pm === "cash" ? "Cash" : pm === "momo" ? "MoMo" : "Card"}
              </button>
            ))}
          </div>

          <Button
            className="w-full"
            disabled={cart.length === 0 || createTx.isPending}
            onClick={() => setCheckoutOpen(true)}
          >
            {createTx.isPending ? "Processing..." : `Checkout — ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>VAT (15%)</span><span>{formatCurrency(taxAmount)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{formatCurrency(total)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name (optional)</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Customer Phone (optional)</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+233..." className="h-8 text-sm" />
              </div>
            </div>

            {paymentMethod === "momo" && (
              <div className="space-y-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">MoMo Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Network</Label>
                    <Select value={momoNetwork} onValueChange={v => setMomoNetwork(v as any)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MTN">MTN</SelectItem>
                        <SelectItem value="Telecel">Telecel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number</Label>
                    <Input value={momoPhone} onChange={e => setMomoPhone(e.target.value)} placeholder="024xxxxxxx" className="h-8 text-sm" />
                  </div>
                </div>
                {!momoRef ? (
                  <Button size="sm" variant="outline" className="w-full border-yellow-400 text-yellow-700" onClick={handleMoMoInitiate} disabled={initiateMoMo.isPending}>
                    {initiateMoMo.isPending ? "Sending..." : "Send Payment Request"}
                  </Button>
                ) : momoConfirmed ? (
                  <div className="flex items-center gap-2 text-teal-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Payment confirmed!
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-700 text-sm">
                    <div className="w-3 h-3 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                    Waiting for customer approval...
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCheckoutOpen(false); setMomoRef(null); }}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              disabled={createTx.isPending || (paymentMethod === "momo" && !momoConfirmed)}
            >
              {createTx.isPending ? "Processing..." : "Complete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      {completedTx && (
        <ReceiptModal
          open={receiptOpen}
          onClose={() => { setReceiptOpen(false); setCompletedTx(null); }}
          transactionId={completedTx.id}
        />
      )}
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
}

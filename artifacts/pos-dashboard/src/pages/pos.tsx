import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useListInventory, useListCategories, useListLocations, useCreateTransaction, useInitiateMoMo, useGetMoMoStatus, useGetSettings, useGetActiveShift, useOpenShift, useListUsers, useCreateSalesLog } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSalesMode } from "@/lib/sales-mode";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone,
  Wifi, WifiOff, CheckCircle2, X, ScanBarcode, ChevronUp,
  Package, Send, Clock, Building2, ShoppingBag
} from "lucide-react";
import ReceiptModal from "@/components/receipt-modal";

interface TaxRates {
  vat: number;
  nhil: number;
  getFund: number;
  covid: number;
}

function getTaxRates(settings: Record<string, string> | undefined): TaxRates {
  return {
    vat: (parseFloat(settings?.vat_rate ?? "15") || 15) / 100,
    nhil: (parseFloat(settings?.nhil_rate ?? "2.5") || 2.5) / 100,
    getFund: (parseFloat(settings?.getfund_rate ?? "2.5") || 2.5) / 100,
    covid: (parseFloat(settings?.covid_rate ?? "1") || 1) / 100,
  };
}

interface TaxBreakdown {
  vat: number;
  nhil: number;
  getFund: number;
  covid: number;
  totalTax: number;
}

function computeTaxBreakdown(subtotal: number, rates: TaxRates): TaxBreakdown {
  const vat = subtotal * rates.vat;
  const nhil = subtotal * rates.nhil;
  const getFund = subtotal * rates.getFund;
  const covid = subtotal * rates.covid;
  return { vat, nhil, getFund, covid, totalTax: vat + nhil + getFund + covid };
}

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  sku?: string | null;
}

const OFFLINE_QUEUE_KEY = "pos_offline_queue";

function loadOfflineQueue(): any[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]"); } catch { return []; }
}
function saveOfflineQueue(q: any[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

export default function POSPage() {
  const { user, selectedLocationId } = useAuth();
  const { salesMode, isWholesale } = useSalesMode();
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<number>(0);
  const lastScanRef = useRef<number>(0);
  const scanBufferRef = useRef<string>("");

  // --- State ---
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo" | "card">("cash");
  const [checkoutTier, setCheckoutTier] = useState<1 | 2>(1);
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [momoConfirming, setMomoConfirming] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [showScannerHint, setShowScannerHint] = useState(false);
  const [quickScan, setQuickScan] = useState(false);
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanAnimRef = useRef<number>(0);

  // --- Data ---
  const { data: categories } = useListCategories();
  const { data: inventory, isLoading: invLoading } = useListInventory({
    locationId: selectedLocationId ?? undefined,
  });
  const { data: locations } = useListLocations();
  const { data: settings } = useGetSettings();
  const { data: allUsers } = useListUsers();
  // Wholesale customers (users with customerType = 'wholesale')
  const wholesaleCustomers = allUsers?.filter((u: any) => u.customerType === "wholesale") ?? [];
  const selectedCustomer = wholesaleCustomers.find((c: any) => c.id === selectedCustomerId);
  // Active shift
  const { data: activeShift } = useGetActiveShift(user?.id ?? "", {
    query: { enabled: !!user?.id } as any,
  });
  const [shiftOpenDialog, setShiftOpenDialog] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const openShift = useOpenShift({
    mutation: {
      onSuccess: (shift) => {
        setShiftOpenDialog(false);
        setOpeningFloat("");
        toast({ title: "Shift opened", description: `Started at ${shift.locationName}` });
        qc.invalidateQueries({ queryKey: ["/api/shifts/active"] });
      },
      onError: (err: any) => {
        if (err?.error?.includes("already has an active shift")) {
          toast({ title: "Shift already active", description: "You have an open shift" });
          qc.invalidateQueries({ queryKey: ["/api/shifts/active"] });
        } else {
          toast({ title: "Could not open shift", description: err.message, variant: "destructive" });
        }
      },
    },
  });

  const createSalesLog = useCreateSalesLog({
    mutation: {
      onError: () => {},
    },
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
        qc.invalidateQueries({ queryKey: ["/api/analytics"] });
        // Log the sale
        createSalesLog.mutate({
          data: {
            action: "sale",
            salesMode: (tx.salesMode ?? "retail") as any,
            orderId: tx.id,
            details: `Receipt ${tx.receiptNumber} via ${tx.paymentMethod}`,
            total: tx.total,
          } as any,
        });
      },
      onError: (err: any) => {
        if (!navigator.onLine) queueOffline();
        else toast({ title: "Sale failed", description: err.message, variant: "destructive" });
      },
    },
  });

  const initiateMoMo = useInitiateMoMo({
    mutation: {
      onSuccess: (r) => {
        setMomoRef(r.reference);
        toast({ title: "MoMo request sent", description: r.message });
      },
      onError: () => toast({ title: "MoMo failed", description: "Could not initiate payment", variant: "destructive" }),
    },
  });

  const { data: momoStatus } = useGetMoMoStatus(momoRef ?? "placeholder", {
    query: { enabled: !!momoRef, refetchInterval: 2000 } as any,
  });

  // --- Mode switching: clear cart when mode changes ---
  const prevModeRef = useRef(salesMode);
  useEffect(() => {
    if (prevModeRef.current !== salesMode) {
      setCart([]);
      setPaymentMethod("cash");
      setSelectedCustomerId(null);
      setCustomerName("");
      setCustomerPhone("");
      prevModeRef.current = salesMode;
    }
  }, [salesMode]);

  // --- Computed ---
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxRates = getTaxRates(settings as any);
  const taxBreakdown = computeTaxBreakdown(subtotal, taxRates);
  const taxAmount = taxBreakdown.totalTax;
  const total = subtotal + taxAmount;
  const momoConfirmed = momoStatus?.status === "successful";
  const cashReceivedNum = parseFloat(cashReceived) || 0;

  // Checkout repricing — apply checkoutTier to cart items using live inventory prices
  const checkoutCart = useMemo(() => {
    if (!isWholesale) return cart;
    return cart.map(cartItem => {
      const invItem = (inventory as any[])?.find((i: any) => i.id === cartItem.itemId);
      if (!invItem) return cartItem;
      let price = parseFloat(invItem.price);
      if (checkoutTier === 2 && invItem.wholesalePrice2) price = parseFloat(invItem.wholesalePrice2);
      else if (invItem.wholesalePrice1) price = parseFloat(invItem.wholesalePrice1);
      return { ...cartItem, price };
    });
  }, [cart, checkoutTier, inventory, isWholesale]);
  const checkoutSubtotal = checkoutCart.reduce((s, i) => s + i.price * i.quantity, 0);
  const checkoutTaxBreakdown = computeTaxBreakdown(checkoutSubtotal, taxRates);
  const checkoutTaxAmount = checkoutTaxBreakdown.totalTax;
  const checkoutTotal = checkoutSubtotal + checkoutTaxAmount;
  const changeDue = Math.max(0, cashReceivedNum - checkoutTotal);
  const insufficientCash = cashReceived === "" || cashReceivedNum < checkoutTotal;

  // Sync checkoutTier when checkout opens
  useEffect(() => {
    if (checkoutOpen) {
      setCheckoutTier(isWholesale ? (((selectedCustomer as any)?.wholesaleTier ?? 1) as 1 | 2) : 1);
    }
  }, [checkoutOpen]);

  // Get wholesale tier price for an item
  function getItemPrice(item: any): number {
    if (isWholesale && item.wholesalePrice1) {
      const tier = (selectedCustomer as any)?.wholesaleTier ?? 1;
      if (tier === 2 && item.wholesalePrice2) return parseFloat(item.wholesalePrice2);
      return parseFloat(item.wholesalePrice1);
    }
    return parseFloat(item.price);
  }

  // --- Barcode / search scanner ---
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
  }, []);

  // Auto-add on exact SKU match when inventory data arrives
  useEffect(() => {
    if (!search || !inventory || inventory.length === 0) return;
    const skuMatch = inventory.find(i => i.sku?.toLowerCase() === search.toLowerCase());
    if (skuMatch) {
      addToCart(skuMatch);
      setSearch("");
      setQuickScan(true);
      setTimeout(() => setQuickScan(false), 600);
    }
  }, [inventory]);

  // --- Camera barcode scanning ---
  useEffect(() => {
    if (!cameraScanOpen) return;
    let stream: MediaStream | null = null;
    let detector: any = null;
    let cancelled = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Try Barcode Detection API (Chrome on Android, Edge)
        if ("BarcodeDetector" in window) {
          const BD = (window as any).BarcodeDetector;
          detector = new BD({ formats: ["code_128", "ean_13", "ean_8", "code_39", "upc_a", "upc_e"] });
          scanLoop();
        } else {
          // Fallback: canvas-based scanning (simplified frame capture)
          fallbackScanLoop();
        }
      } catch (err) {
        toast({ title: "Camera error", description: "Could not access camera. Make sure you gave permission.", variant: "destructive" });
      }
    }

    async function scanLoop() {
      if (cancelled || !cameraScanOpen) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) { requestAnimationFrame(scanLoop); return; }
      try {
        const results = await detector.detect(video);
        if (results && results.length > 0) {
          const barcode = results[0].rawValue;
          if (barcode) {
            setSearch(barcode);
            setCameraScanOpen(false);
            searchRef.current?.focus();
            return;
          }
        }
      } catch {}
      requestAnimationFrame(scanLoop);
    }

    function fallbackScanLoop() {
      if (cancelled || !cameraScanOpen) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) { requestAnimationFrame(fallbackScanLoop); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // We can't decode without a barcode library; let user know
      // After 8 seconds, close the scanner and prompt to use USB scanner
      setTimeout(() => {
        if (cameraScanOpen) {
          setCameraScanOpen(false);
          toast({ title: "Barcode scanner not available", description: "Your browser doesn't support camera barcode scanning. Use a USB barcode scanner instead.", variant: "destructive" });
        }
      }, 8000);
    }

    startCamera();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [cameraScanOpen]);

  // --- Keyboard shortcut: F12 = checkout ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        if (cart.length > 0 && !checkoutOpen) setCheckoutOpen(true);
      }
      // ESC closes dialogs
      if (e.key === "Escape") {
        if (checkoutOpen) { setCheckoutOpen(false); setMomoRef(null); }
        if (mobileCartOpen) setMobileCartOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length, checkoutOpen, mobileCartOpen]);

  // --- Online/offline ---
  useEffect(() => {
    const on = () => { setIsOnline(true); syncOfflineQueue(); };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function syncOfflineQueue() {
    const queue = loadOfflineQueue();
    if (queue.length === 0) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/transactions/sync`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("pos_token")}` },
        body: JSON.stringify({ transactions: queue }),
      });
      if (res.ok) {
        saveOfflineQueue([]);
        setOfflineCount(0);
        toast({ title: "Offline sales synced", description: `${queue.length} transaction(s) uploaded` });
        qc.invalidateQueries({ queryKey: ["/api/analytics"] });
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

  function buildTxPayload() {
    return {
      locationId: selectedLocationId!,
      shiftId: activeShift?.id ?? undefined,
      items: checkoutCart.map(i => ({ itemId: i.itemId, name: i.name, quantity: i.quantity, price: i.price.toFixed(2), total: (i.price * i.quantity).toFixed(2) })),
      subtotal: checkoutSubtotal.toFixed(2),
      taxAmount: checkoutTaxAmount.toFixed(2),
      taxBreakdown: {
        vat: checkoutTaxBreakdown.vat.toFixed(2),
        nhil: checkoutTaxBreakdown.nhil.toFixed(2),
        getFund: checkoutTaxBreakdown.getFund.toFixed(2),
        covid: checkoutTaxBreakdown.covid.toFixed(2),
      },
      total: checkoutTotal.toFixed(2),
      paymentMethod,
      salesMode,
      wholesaleTier: isWholesale ? checkoutTier : undefined,
      customerId: selectedCustomerId ?? undefined,
      momoPhone: paymentMethod === "momo" ? momoPhone : undefined,
      momoNetwork: paymentMethod === "momo" ? momoNetwork : undefined,
      momoReference: momoRef ?? undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      notes: paymentMethod === "cash" && cashReceived
        ? JSON.stringify({ cashReceived: cashReceivedNum.toFixed(2), changeDue: changeDue.toFixed(2) })
        : undefined,
    };
  }

  function addToCart(item: any) {
    const price = getItemPrice(item);
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        return prev.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price, quantity: 1, unit: item.unit ?? "piece", sku: item.sku }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  }

  function clearCart() {
    if (cart.length === 0) return;
    setCart([]);
    toast({ title: "Cart cleared" });
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

  async function handleMoMoConfirm() {
    if (!momoRef) return;
    setMomoConfirming(true);
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch(`/api/momo/confirm/${momoRef}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Confirm failed");
    } catch {
      toast({ title: "Could not confirm payment", variant: "destructive" });
    } finally {
      setMomoConfirming(false);
    }
  }

  // --- Receipt print handler ---
  function handlePrintReceipt() {
    if (!completedTx) return;
    const printContent = document.getElementById("receipt-print");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; } .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; } .bold { font-weight: bold; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
    win.close();
  }

  // --- UI Helpers ---
  const cartItems = cart.length;
  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const items = inventory ?? [];
  const filtered = items.filter(item => {
    if (selectedCategory && item.categoryId !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || (item.sku?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-screen overflow-hidden">
      {/* ============ PRODUCT GRID (Left) ============ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border overflow-hidden">
        {/* Toolbar: Search + Categories */}
        <div className="shrink-0 p-3 lg:p-4 border-b border-border space-y-2 bg-card">
          {/* Search bar — always focused, auto-focus after scan */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Scan barcode or search products..."
                className={cn("pl-10 text-sm transition-shadow", quickScan && "ring-2 ring-primary")}
                autoFocus
              />
              {search && (
                <button onClick={() => { setSearch(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => setCameraScanOpen(true)}
              className="shrink-0 w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              title="Scan barcode with camera"
            >
              <ScanBarcode className="w-4 h-4" />
            </button>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0", !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >All</button>
            {categories?.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0", selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 lg:px-4 py-1.5 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 text-xs text-teal-600"><Wifi className="w-3 h-3" /> Online</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600"><WifiOff className="w-3 h-3" /> Offline</span>
            )}
            {offlineCount > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{offlineCount} queued</Badge>
            )}
            {activeShift ? (
              <Badge variant="outline" className="text-xs text-teal-700 border-teal-200 bg-teal-50/50"><Clock className="w-3 h-3 mr-1" /> Shift active</Badge>
            ) : (
              <button onClick={() => setShiftOpenDialog(true)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><Clock className="w-3 h-3" /> No shift · Open</button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} items</span>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          {!selectedLocationId ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No location selected</p>
              <p className="text-sm">Select a location from the sidebar to start selling</p>
            </div>
          ) : invLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map(item => {
                const inCart = cart.find(c => c.itemId === item.id);
                const outOfStock = item.quantity <= 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => !outOfStock && addToCart(item)}
                    disabled={outOfStock}
                    className={cn(
                      "relative p-3 lg:p-4 rounded-xl border text-left transition-all hover:shadow-md active:scale-95",
                      inCart ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
                      outOfStock && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                        {inCart.quantity}
                      </span>
                    )}
                    <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg bg-muted flex items-center justify-center mb-2">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-xs lg:text-sm leading-tight line-clamp-2">{item.name}</p>
                    {(item.unitName || item.unit) && <p className="text-[10px] text-muted-foreground mt-0.5">{item.unitName || item.unit}</p>}
                    <p className={cn("font-semibold text-sm lg:text-base mt-1", isWholesale ? "text-blue-600" : "text-primary")}>
                      {isWholesale ? (
                        <>
                          {formatCurrency(getItemPrice(item))}
                          {item.price && <span className="text-[10px] text-muted-foreground line-through ml-1">{formatCurrency(item.price)}</span>}
                        </>
                      ) : (
                        formatCurrency(item.price)
                      )}
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {outOfStock ? "Out of stock" : `${item.quantity} ${item.unit ?? "pcs"} left`}
                    </p>
                    {item.sku && (
                      <p className="text-muted-foreground text-[9px] mt-0.5 font-mono">{item.sku}</p>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mb-2 opacity-20" />
                  <p>No products found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ CART SIDEBAR (Right) — Desktop ============ */}
      <div className="hidden lg:flex w-96 xl:w-[28rem] flex-col bg-card border-l border-border overflow-hidden">
        {/* Cart header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            {isWholesale ? "Wholesale Cart" : "Cart"}
            {cartItems > 0 && <Badge variant="secondary" className="text-xs">{cartItemCount} items</Badge>}
          </h2>
          {cartItems > 0 && (
            <button onClick={clearCart} className="text-xs text-destructive hover:underline">
              Clear
            </button>
          )}
        </div>

        {/* Wholesale customer selector */}
        {isWholesale && (
          <div className="shrink-0 px-4 py-3 border-b border-border bg-blue-50/50">
            <Label className="text-xs text-blue-700 flex items-center gap-1 mb-1.5">
              <Building2 className="w-3 h-3" /> Business Customer <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search customer name..."
                className="h-8 text-sm pr-8"
              />
              {customerSearch && (
                <button onClick={() => setCustomerSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {customerSearch && (
              <div className="mt-1 border border-border rounded-md bg-background max-h-28 overflow-y-auto">
                {wholesaleCustomers.filter((c: any) => c.username?.toLowerCase().includes(customerSearch.toLowerCase()) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No customers found</p>
                ) : (
                  wholesaleCustomers.filter((c: any) => c.username?.toLowerCase().includes(customerSearch.toLowerCase()) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())).map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(""); }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center justify-between"
                    >
                      <span>{c.username}</span>
                      <Badge variant="outline" className="text-[10px]">Tier {c.wholesaleTier ?? 1}</Badge>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-700">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium">{selectedCustomer.username}</span>
                <Badge variant="outline" className="text-[10px]">Tier {(selectedCustomer as any).wholesaleTier ?? 1}</Badge>
                <button onClick={() => setSelectedCustomerId(null)} className="text-muted-foreground hover:text-destructive ml-auto">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs mt-1">Tap a product to add it</p>
              <p className="text-[10px] text-muted-foreground mt-3">Press F12 to checkout</p>
            </div>
          ) : cart.map(item => (
            <div key={item.itemId} className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.itemId, -1)} className="w-7 h-7 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                <button onClick={() => updateQty(item.itemId, 1)} className="w-7 h-7 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="w-16 text-right">
                <p className="text-xs font-semibold tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
              </div>
              <button onClick={() => removeFromCart(item.itemId)} className="text-destructive hover:text-destructive/70 p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Checkout Panel */}
        <div className="shrink-0 border-t border-border p-4 space-y-3">
          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT ({(taxRates.vat * 100).toFixed(1)}%)</span>
              <span className="tabular-nums">{formatCurrency(taxBreakdown.vat)}</span>
            </div>
            {taxBreakdown.nhil > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>NHIL ({(taxRates.nhil * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">{formatCurrency(taxBreakdown.nhil)}</span>
              </div>
            )}
            {taxBreakdown.getFund > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GETFund ({(taxRates.getFund * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">{formatCurrency(taxBreakdown.getFund)}</span>
              </div>
            )}
            {taxBreakdown.covid > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>COVID ({(taxRates.covid * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">{formatCurrency(taxBreakdown.covid)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className={cn("grid gap-2", isWholesale ? "grid-cols-3" : "grid-cols-3")}>
            {(() => {
              const methods = [
                { key: "cash" as const, icon: Banknote, label: "Cash" },
                { key: "momo" as const, icon: Smartphone, label: "MoMo" },
                { key: "card" as const, icon: CreditCard, label: "Card" },
              ];
              return methods.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-colors min-h-[48px]",
                    paymentMethod === key
                      ? isWholesale ? "border-blue-600 bg-blue-50 text-blue-600" : "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ));
            })()}
          </div>

          {/* Pay / F12 */}
          <Button
            className={cn("w-full h-12 text-base font-bold gap-2", isWholesale && "bg-blue-600 hover:bg-blue-700")}
            disabled={cartItems === 0 || createTx.isPending}
            onClick={() => setCheckoutOpen(true)}
          >
            {createTx.isPending ? "Processing..." : (
              <>
                <span>Pay</span>
                <span className="text-xs font-normal opacity-80">F12</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ============ MOBILE CART BUTTON (bottom sticky) ============ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border p-3 flex items-center gap-3">
        <button
          onClick={() => setMobileCartOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="tabular-nums">{formatCurrency(total)}</span>
          <Badge className="bg-primary-foreground text-primary text-xs ml-1">{cartItemCount}</Badge>
        </button>
      </div>

      {/* ============ MOBILE CART DRAWER ============ */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-40 transition-opacity",
        mobileCartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileCartOpen(false)} />
        <div className={cn(
          "absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-xl transition-transform duration-300 flex flex-col max-h-[85vh]",
          mobileCartOpen ? "translate-y-0" : "translate-y-full"
        )}>
          {/* Drag handle */}
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Cart ({cartItemCount})
            </h3>
            <div className="flex items-center gap-2">
              {cartItems > 0 && (
                <button onClick={clearCart} className="text-xs text-destructive hover:underline">Clear</button>
              )}
              <button onClick={() => setMobileCartOpen(false)} className="p-1">
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          {/* Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cartItems === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : cart.map(item => (
              <div key={item.itemId} className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.itemId, -1)} className="w-8 h-8 rounded-md bg-muted flex items-center justify-center min-w-[32px] min-h-[32px]"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                  <button onClick={() => updateQty(item.itemId, 1)} className="w-8 h-8 rounded-md bg-muted flex items-center justify-center min-w-[32px] min-h-[32px]"><Plus className="w-3 h-3" /></button>
                </div>
                <div className="w-14 text-right">
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(item.price * item.quantity)}</p>
                </div>
                <button onClick={() => removeFromCart(item.itemId)} className="text-destructive p-1 min-w-[32px] min-h-[32px] flex items-center justify-center">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {/* Totals + Payment */}
          <div className="shrink-0 border-t border-border p-3 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>VAT</span><span className="tabular-nums">{formatCurrency(taxBreakdown.vat)}</span></div>
              {taxBreakdown.nhil > 0 && <div className="flex justify-between text-muted-foreground"><span>NHIL</span><span className="tabular-nums">{formatCurrency(taxBreakdown.nhil)}</span></div>}
              {taxBreakdown.getFund > 0 && <div className="flex justify-between text-muted-foreground"><span>GETFund</span><span className="tabular-nums">{formatCurrency(taxBreakdown.getFund)}</span></div>}
              {taxBreakdown.covid > 0 && <div className="flex justify-between text-muted-foreground"><span>COVID</span><span className="tabular-nums">{formatCurrency(taxBreakdown.covid)}</span></div>}
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary tabular-nums">{formatCurrency(total)}</span></div>
            </div>
            <div className={cn("grid gap-2", isWholesale ? "grid-cols-3" : "grid-cols-3")}>
              {[
                { key: "cash" as const, icon: Banknote, label: "Cash" },
                { key: "momo" as const, icon: Smartphone, label: "MoMo" },
                { key: "card" as const, icon: CreditCard, label: "Card" },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setPaymentMethod(key)} className={cn("flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium min-h-[48px]", paymentMethod === key ? (isWholesale ? "border-blue-600 bg-blue-50 text-blue-600" : "border-primary bg-primary/10 text-primary") : "border-border text-muted-foreground")}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
            <Button className={cn("w-full h-12 text-base font-bold gap-2", isWholesale && "bg-blue-600 hover:bg-blue-700")} disabled={cartItems === 0 || createTx.isPending} onClick={() => { setMobileCartOpen(false); setCheckoutOpen(true); }}>
              {createTx.isPending ? "Processing..." : <><span>Pay</span><span className="tabular-nums">{formatCurrency(total)}</span></>}
            </Button>
          </div>
        </div>
      </div>

      {/* ============ CHECKOUT DIALOG ============ */}
      <Dialog open={checkoutOpen} onOpenChange={(v) => { if (!v) { setCheckoutOpen(false); setMomoRef(null); setCashReceived(""); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Complete Sale
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Bill Summary */}
            <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(checkoutSubtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>VAT ({(taxRates.vat * 100).toFixed(1)}%)</span><span className="tabular-nums">{formatCurrency(checkoutTaxBreakdown.vat)}</span></div>
              {checkoutTaxBreakdown.nhil > 0 && <div className="flex justify-between text-muted-foreground"><span>NHIL ({(taxRates.nhil * 100).toFixed(1)}%)</span><span className="tabular-nums">{formatCurrency(checkoutTaxBreakdown.nhil)}</span></div>}
              {checkoutTaxBreakdown.getFund > 0 && <div className="flex justify-between text-muted-foreground"><span>GETFund ({(taxRates.getFund * 100).toFixed(1)}%)</span><span className="tabular-nums">{formatCurrency(checkoutTaxBreakdown.getFund)}</span></div>}
              {checkoutTaxBreakdown.covid > 0 && <div className="flex justify-between text-muted-foreground"><span>COVID ({(taxRates.covid * 100).toFixed(1)}%)</span><span className="tabular-nums">{formatCurrency(checkoutTaxBreakdown.covid)}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary tabular-nums">{formatCurrency(checkoutTotal)}</span></div>
              <div className="text-xs text-muted-foreground mt-1">{cartItemCount} items · {paymentMethod.toUpperCase()}</div>
            </div>

            {/* Customer */}
            {isWholesale ? (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="space-y-1">
                  <Label className="text-xs text-blue-700 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Business Customer <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-1.5 text-sm text-blue-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="font-medium">{selectedCustomer.username}</span>
                      <Badge variant="outline" className="text-[10px]">Tier {(selectedCustomer as any).wholesaleTier ?? 1}</Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No business customer linked</p>
                  )}
                </div>
                {/* Tier selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCheckoutTier(1)} className={cn("rounded-md border px-3 py-2 text-xs text-left transition-colors", checkoutTier === 1 ? "bg-blue-600 text-white border-blue-600" : "bg-white border-border text-muted-foreground hover:border-blue-400")}>
                    <p className="font-semibold">Tier 1</p>
                    <p className="opacity-80 mt-0.5">Standard wholesale price</p>
                  </button>
                  <button type="button" onClick={() => setCheckoutTier(2)} className={cn("rounded-md border px-3 py-2 text-xs text-left transition-colors", checkoutTier === 2 ? "bg-blue-600 text-white border-blue-600" : "bg-white border-border text-muted-foreground hover:border-blue-400")}>
                    <p className="font-semibold">Tier 2</p>
                    <p className="opacity-80 mt-0.5">Preferred / volume price</p>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-700">Customer Name</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="h-8 text-sm bg-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-700">Customer Phone</Label>
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+233..." className="h-8 text-sm bg-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Customer Phone</Label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+233..." className="h-8 text-sm" />
                </div>
              </div>
            )}

            {/* MoMo Panel */}
            {paymentMethod === "momo" && (
              <div className="space-y-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">Mobile Money Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Network</Label>
                    <Select value={momoNetwork} onValueChange={v => setMomoNetwork(v as any)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="MTN">MTN</SelectItem><SelectItem value="Telecel">Telecel</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number</Label>
                    <Input value={momoPhone} onChange={e => setMomoPhone(e.target.value)} placeholder="024xxxxxxx" className="h-8 text-sm" />
                  </div>
                </div>
                {!momoRef ? (
                  <Button size="sm" variant="outline" className="w-full border-yellow-400 text-yellow-700" onClick={handleMoMoInitiate} disabled={initiateMoMo.isPending}>
                    <Send className="w-3 h-3 mr-1" /> {initiateMoMo.isPending ? "Sending..." : "Send Payment Request"}
                  </Button>
                ) : momoConfirmed ? (
                  <div className="flex items-center gap-2 text-teal-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Payment confirmed!
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-yellow-700">Ask the customer to approve the payment on their phone, then tap below once they show you their confirmation.</p>
                    <Button size="sm" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleMoMoConfirm} disabled={momoConfirming}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {momoConfirming ? "Confirming..." : "Confirm Payment Received"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Cash handling — amount received + change calculator */}
            {paymentMethod === "cash" && (
              <div className="space-y-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                <div className="flex items-center gap-2 text-sm text-teal-700 font-medium">
                  <Banknote className="w-4 h-4" />
                  Total due: <span className="tabular-nums font-bold">{formatCurrency(checkoutTotal)}</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-teal-800 font-semibold">Amount Received (₵)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    onFocus={e => e.target.select()}
                    placeholder="0.00"
                    className="h-10 text-base bg-white border-teal-300 focus:border-teal-500"
                    autoFocus
                  />
                </div>

                <div className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                  cashReceived === ""
                    ? "bg-white/60 text-muted-foreground border border-teal-200"
                    : insufficientCash
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "bg-teal-600 text-white"
                )}>
                  <span className="text-[13px]">Change Due</span>
                  <span className="tabular-nums text-base">
                    {cashReceived === ""
                      ? "—"
                      : insufficientCash
                      ? "Insufficient Cash"
                      : formatCurrency(changeDue)}
                  </span>
                </div>

                {cashReceived !== "" && insufficientCash && (
                  <p className="text-xs text-red-600 text-center">
                    Short by <span className="font-bold tabular-nums">{formatCurrency(total - cashReceivedNum)}</span>
                  </p>
                )}
              </div>
            )}
            {paymentMethod === "card" && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
                <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Process card payment for <strong className="tabular-nums">{formatCurrency(total)}</strong></div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCheckoutOpen(false); setMomoRef(null); setCashReceived(""); }}>Cancel</Button>
            <Button className={cn(isWholesale && "bg-blue-600 hover:bg-blue-700")} onClick={handleCheckout} disabled={createTx.isPending || (paymentMethod === "momo" && !momoConfirmed) || (paymentMethod === "cash" && insufficientCash)}>
              {createTx.isPending ? "Processing..." : "Complete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ CAMERA BARCODE SCANNER ============ */}
      <Dialog open={cameraScanOpen} onOpenChange={setCameraScanOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="relative bg-black aspect-[3/4] overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            {/* Scan target overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-56 h-32 border-2 border-white/60 rounded-lg relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/60 animate-scan" />
              </div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white/80 text-xs">Point barcode at the box</p>
            </div>
            <button
              onClick={() => setCameraScanOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ SHIFT OPEN DIALOG ============ */}
      <Dialog open={shiftOpenDialog} onOpenChange={setShiftOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4" /> Open Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Opening Float (₵)</Label>
              <Input type="number" min="0" step="0.01" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
            </div>
            <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground">
              Location: {locations?.find(l => l.id === selectedLocationId)?.name ?? "No location selected"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftOpenDialog(false)}>Cancel</Button>
            <Button
              disabled={!selectedLocationId || !openingFloat || openShift.isPending}
              onClick={() => {
                if (!user?.id || !selectedLocationId) return;
                openShift.mutate({ data: { userId: user.id, locationId: selectedLocationId, openingFloat } });
              }}
            >
              {openShift.isPending ? "Opening..." : "Open Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ RECEIPT MODAL ============ */}
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

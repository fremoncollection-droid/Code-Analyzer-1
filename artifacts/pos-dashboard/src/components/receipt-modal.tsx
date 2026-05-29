import { useGetReceipt } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer, Download, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  transactionId: string;
}

export default function ReceiptModal({ open, onClose, transactionId }: Props) {
  const { data: receipt, isLoading } = useGetReceipt(transactionId || "placeholder", {
    query: { enabled: open && !!transactionId } as any,
  });

  const handlePrint = () => {
    const printContent = document.getElementById("receipt-content");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .small { font-size: 10px; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
    win.close();
  };

  if (!receipt && !isLoading) return null;
  const tx = receipt?.transaction;
  const loc = receipt?.location;
  const items = Array.isArray(tx?.items) ? tx.items : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Receipt</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="w-3 h-3 mr-1" /> Print
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading receipt...</div>
        ) : (
          <div id="receipt-content" className="font-mono text-xs space-y-1">
            {/* Header */}
            <div className="text-center space-y-0.5">
              <p className="font-bold text-sm">{loc?.name ?? "MirrorTech"}</p>
              {loc?.address && <p className="text-muted-foreground text-[10px]">{loc.address}</p>}
              {loc?.phone && <p className="text-muted-foreground text-[10px]">Tel: {loc.phone}</p>}
              <p className="text-muted-foreground text-[10px]">Ghana Revenue Authority</p>
              <p className="font-bold text-[10px]">E-VAT RECEIPT</p>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Receipt #:</span><span className="font-bold">{tx?.receiptNumber}</span></div>
              <div className="flex justify-between"><span>GRA Ref:</span><span>{receipt?.graReceiptNumber}</span></div>
              <div className="flex justify-between"><span>Date:</span><span>{tx?.createdAt ? formatDate(tx.createdAt) : "—"}</span></div>
              {tx?.cashierName && <div className="flex justify-between"><span>Cashier:</span><span>{tx.cashierName}</span></div>}
              {tx?.customerName && <div className="flex justify-between"><span>Customer:</span><span>{tx.customerName}</span></div>}
            </div>

            <Separator className="border-dashed" />

            {/* Items */}
            <div className="space-y-1">
              <p className="font-bold text-[10px]">ITEMS</p>
              {items.map((item: any, i: number) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[10px] truncate">{item.name}</p>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{item.quantity} × {formatCurrency(item.price)}</span>
                    <span>{formatCurrency(item.total ?? (parseFloat(item.price) * item.quantity))}</span>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="border-dashed" />

            {/* Totals */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(tx?.subtotal ?? 0)}</span></div>
              <div className="flex justify-between"><span>VAT (15%)</span><span>{formatCurrency(tx?.taxAmount ?? 0)}</span></div>
              <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1 mt-1">
                <span>TOTAL</span>
                <span>{formatCurrency(tx?.total ?? 0)}</span>
              </div>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize font-bold">{tx?.paymentMethod}</span>
              </div>
              {tx?.momoPhone && <div className="flex justify-between"><span>MoMo Phone</span><span>{tx.momoPhone}</span></div>}
              {tx?.momoNetwork && <div className="flex justify-between"><span>Network</span><span>{tx.momoNetwork}</span></div>}
              {tx?.momoReference && <div className="flex justify-between"><span>Ref</span><span>{tx.momoReference}</span></div>}
            </div>

            <Separator className="border-dashed" />

            <div className="text-center text-[10px] space-y-0.5 text-muted-foreground">
              <p>Thank you for your purchase!</p>
              <p>Goods once sold are not returnable</p>
              <p className="text-[9px]">This is a computer generated receipt</p>
              <p className="text-[9px] font-bold">MirrorTech POS v2.0</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

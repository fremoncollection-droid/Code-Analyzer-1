import { useGetReceipt, useGetSettings } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  transactionId: string;
}

export default function ReceiptModal({ open, onClose, transactionId }: Props) {
  const { data: receipt, isLoading } = useGetReceipt(transactionId || "placeholder", {
    query: { enabled: open && !!transactionId } as any,
  });
  const { data: settings } = useGetSettings();

  const logoUrl = settings?.logo_url;
  const appName = settings?.app_name || "Fremon Collection POS";
  const receiptPhone = settings?.receipt_phone;
  const receiptEmail = settings?.receipt_email;
  const receiptWebsite = settings?.receipt_website;
  const receiptTagline = settings?.receipt_tagline || "Wholesale & Retail Sales";
  const receiptTin = settings?.receipt_tin;
  const receiptFooter = settings?.receipt_footer || "Thank you for shopping with us!";
  const receiptReturnPolicy = settings?.receipt_return_policy || "Goods once sold are not returnable.";
  const showLogo = settings?.receipt_show_logo !== "false";

  const handlePrint = () => {
    const printContent = document.getElementById("receipt-content");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>Receipt</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 5mm 4mm 8mm;
          color: #000;
          background: #fff;
          line-height: 1.4;
        }
        img.logo { display: block; max-width: 56px; max-height: 56px; margin: 0 auto 4px; object-fit: contain; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .text-base { font-size: 13px; }
        .text-sm { font-size: 11px; }
        .text-xs { font-size: 10px; }
        .text-tiny { font-size: 9px; }
        .muted { color: #555; }
        .row { display: flex; justify-content: space-between; align-items: baseline; margin: 1.5px 0; }
        .divider-dashed { border: none; border-top: 1px dashed #666; margin: 5px 0; }
        .divider-solid  { border: none; border-top: 1px solid #000;  margin: 5px 0; }
        .divider-double { border: none; border-top: 3px double #000; margin: 5px 0; }
        .gra-box { border: 1.5px solid #000; text-align: center; padding: 2px 4px; margin: 5px 0; }
        .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; padding: 2px 0; }
        .item-name { font-weight: 600; font-size: 11px; }
        .item-detail { color: #444; font-size: 10px; display: flex; justify-content: space-between; }
        .section-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #444; text-transform: uppercase; }
        .void-stamp { border: 2px solid #000; display: inline-block; padding: 1px 6px; font-weight: 700; font-size: 10px; letter-spacing: 2px; }
      </style>
      </head><body>
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
  const businessName = loc?.name || appName;
  const displayPhone = receiptPhone || loc?.phone;
  const displayAddress = loc?.address;

  const taxBreakdown = (() => {
    const bd = (tx as any)?.taxBreakdown as Record<string, string> | null;
    if (bd && typeof bd === "object") return bd;
    return null;
  })();

  const cashInfo = (() => {
    if ((tx as any)?.paymentMethod !== "cash" || !(tx as any)?.notes) return null;
    try { return JSON.parse((tx as any).notes); } catch { return null; }
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[380px] p-0 overflow-hidden bg-gray-100">
        {/* Toolbar */}
        <DialogHeader className="px-4 py-2.5 bg-white border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-semibold">Receipt Preview</DialogTitle>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handlePrint}>
            <Printer className="w-3 h-3" /> Print Receipt
          </Button>
        </DialogHeader>

        {/* Scrollable receipt area */}
        <div className="overflow-y-auto max-h-[82vh] py-4 px-3 flex justify-center bg-gray-100">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm w-full">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading receipt…
            </div>
          ) : (
            <div
              id="receipt-content"
              className="bg-white shadow-lg"
              style={{
                width: "280px",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "11px",
                lineHeight: "1.45",
                color: "#000",
              }}
            >
              {/* ── HEADER ── */}
              <div className="px-5 pt-5 pb-3 text-center">
                {showLogo && logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="logo mx-auto mb-2"
                    style={{ maxWidth: "64px", maxHeight: "64px", objectFit: "contain", display: "block" }}
                  />
                )}
                <p className="bold text-base" style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                  {businessName}
                </p>
                {receiptTagline && (
                  <p className="text-tiny muted" style={{ fontSize: "9px", letterSpacing: "2px", color: "#666", textTransform: "uppercase", marginTop: "1px" }}>
                    {receiptTagline}
                  </p>
                )}
                {displayAddress && (
                  <p className="text-tiny" style={{ fontSize: "9px", color: "#555", marginTop: "3px" }}>{displayAddress}</p>
                )}
                {displayPhone && (
                  <p className="text-tiny" style={{ fontSize: "9px", color: "#555" }}>Tel: {displayPhone}</p>
                )}
                {receiptEmail && (
                  <p className="text-tiny" style={{ fontSize: "9px", color: "#555" }}>{receiptEmail}</p>
                )}
                {receiptWebsite && (
                  <p className="text-tiny" style={{ fontSize: "9px", color: "#555" }}>{receiptWebsite}</p>
                )}
                {receiptTin && (
                  <p className="text-tiny" style={{ fontSize: "9px", color: "#555" }}>TIN: {receiptTin}</p>
                )}
              </div>

              {/* ── GRA STAMP ── */}
              <div className="mx-4 mb-2" style={{ border: "1.5px solid #000", textAlign: "center", padding: "3px 4px" }}>
                <p style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px" }}>GHANA REVENUE AUTHORITY</p>
                <p style={{ fontSize: "10px", fontWeight: 700 }}>E-VAT OFFICIAL RECEIPT</p>
              </div>

              {/* ── DASHED DIVIDER ── */}
              <div style={{ borderTop: "1px dashed #999", margin: "4px 16px" }} />

              {/* ── TRANSACTION INFO ── */}
              <div className="px-5" style={{ fontSize: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span style={{ color: "#666" }}>Receipt No:</span>
                  <span style={{ fontWeight: 700 }}>{tx?.receiptNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span style={{ color: "#666" }}>GRA Ref:</span>
                  <span style={{ fontFamily: "monospace" }}>{receipt?.graReceiptNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span style={{ color: "#666" }}>Date:</span>
                  <span>{tx?.createdAt ? formatDate(tx.createdAt) : "—"}</span>
                </div>
                {tx?.cashierName && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>Cashier:</span>
                    <span>{tx.cashierName}</span>
                  </div>
                )}
                {tx?.customerName && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>Customer:</span>
                    <span>{tx.customerName}</span>
                  </div>
                )}
                {tx?.customerPhone && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>Phone:</span>
                    <span>{tx.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* ── DASHED ── */}
              <div style={{ borderTop: "1px dashed #999", margin: "6px 16px" }} />

              {/* ── ITEMS ── */}
              <div className="px-5">
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1.5px", color: "#555", marginBottom: "4px", textTransform: "uppercase" }}>
                  Items Purchased
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#777", borderBottom: "1px solid #e0e0e0", paddingBottom: "2px", marginBottom: "4px" }}>
                  <span>Description</span><span>Amount</span>
                </div>
                {items.map((item: any, i: number) => {
                  const lineTotal = item.total ?? (parseFloat(item.price) * item.quantity);
                  return (
                    <div key={i} style={{ marginBottom: "5px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 600, lineHeight: "1.3" }}>{item.name}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#555" }}>
                        <span>{item.quantity} × {formatCurrency(item.price)}</span>
                        <span style={{ color: "#000", fontWeight: 500 }}>{formatCurrency(lineTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── SOLID DIVIDER ── */}
              <div style={{ borderTop: "1px solid #ccc", margin: "4px 16px" }} />

              {/* ── TOTALS ── */}
              <div className="px-5" style={{ fontSize: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span style={{ color: "#666" }}>Subtotal</span>
                  <span>{formatCurrency(tx?.subtotal ?? 0)}</span>
                </div>
                {taxBreakdown ? (
                  <>
                    {taxBreakdown.vat    && <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}><span style={{ color: "#666" }}>VAT</span><span>{formatCurrency(taxBreakdown.vat)}</span></div>}
                    {taxBreakdown.nhil   && <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}><span style={{ color: "#666" }}>NHIL</span><span>{formatCurrency(taxBreakdown.nhil)}</span></div>}
                    {taxBreakdown.getFund && <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}><span style={{ color: "#666" }}>GETFund</span><span>{formatCurrency(taxBreakdown.getFund)}</span></div>}
                    {taxBreakdown.covid  && <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}><span style={{ color: "#666" }}>COVID</span><span>{formatCurrency(taxBreakdown.covid)}</span></div>}
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>VAT</span>
                    <span>{formatCurrency(tx?.taxAmount ?? 0)}</span>
                  </div>
                )}
              </div>

              {/* ── DOUBLE RULE ── */}
              <div style={{ borderTop: "3px double #000", margin: "5px 16px 4px" }} />

              {/* ── GRAND TOTAL ── */}
              <div className="px-5 pb-1">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px" }}>TOTAL</span>
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>{formatCurrency(tx?.total ?? 0)}</span>
                </div>
              </div>

              {/* ── DOUBLE RULE ── */}
              <div style={{ borderTop: "3px double #000", margin: "4px 16px 6px" }} />

              {/* ── PAYMENT ── */}
              <div className="px-5" style={{ fontSize: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                  <span style={{ color: "#666" }}>Payment Method</span>
                  <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{tx?.paymentMethod}</span>
                </div>
                {tx?.momoPhone && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>MoMo Phone</span><span>{tx.momoPhone}</span>
                  </div>
                )}
                {tx?.momoNetwork && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>Network</span><span>{tx.momoNetwork}</span>
                  </div>
                )}
                {tx?.momoReference && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span style={{ color: "#666" }}>Ref</span>
                    <span style={{ fontSize: "9px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.momoReference}</span>
                  </div>
                )}
                {cashInfo?.cashReceived && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                      <span style={{ color: "#666" }}>Cash Received</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cashInfo.cashReceived)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ccc", marginTop: "3px", paddingTop: "3px" }}>
                      <span style={{ fontWeight: 600 }}>Change Given</span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cashInfo.changeDue ?? 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* ── DASHED ── */}
              <div style={{ borderTop: "1px dashed #999", margin: "8px 16px 6px" }} />

              {/* ── FOOTER ── */}
              <div className="px-5 pb-5 text-center">
                <p style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>{receiptFooter}</p>
                <p style={{ fontSize: "9px", color: "#666", marginBottom: "4px" }}>{receiptReturnPolicy}</p>

                {(tx as any)?.isVoided && (
                  <p style={{ fontSize: "9px", fontWeight: 700, border: "2px solid #000", display: "inline-block", padding: "1px 8px", letterSpacing: "2px", marginBottom: "4px" }}>
                    *** VOIDED ***
                  </p>
                )}

                <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "5px", marginTop: "4px" }}>
                  <p style={{ fontSize: "8px", color: "#888" }}>This is a computer generated receipt</p>
                  <p style={{ fontSize: "8px", color: "#888", fontWeight: 600, letterSpacing: "0.5px" }}>
                    {appName.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

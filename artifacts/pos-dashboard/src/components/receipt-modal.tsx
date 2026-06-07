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

  const logoUrl = settings?.logo_url || "/fremon-logo.png";
  const appName = settings?.app_name || "Fremon Creation";
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
          font-size: 13px;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 5mm 4mm 8mm;
          color: #000;
          background: #fff;
          line-height: 1.55;
        }
        img.logo { display: block; max-width: 70px; max-height: 70px; margin: 0 auto 5px; object-fit: contain; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 800; }
        .text-xl  { font-size: 16px; }
        .text-lg  { font-size: 14px; }
        .text-base{ font-size: 13px; }
        .text-sm  { font-size: 12px; }
        .text-xs  { font-size: 11px; }
        .text-tiny{ font-size: 10px; }
        .muted { color: #333; }
        .row { display: flex; justify-content: space-between; align-items: baseline; margin: 2.5px 0; }
        .divider-dashed { border: none; border-top: 1px dashed #555; margin: 6px 0; }
        .divider-solid  { border: none; border-top: 1.5px solid #000; margin: 6px 0; }
        .divider-double { border: none; border-top: 3px double #000; margin: 6px 0; }
        .gra-box { border: 2px solid #000; text-align: center; padding: 3px 4px; margin: 6px 0; }
        .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; padding: 3px 0; }
        .item-name   { font-weight: 700; font-size: 13px; }
        .item-detail { color: #333; font-size: 12px; display: flex; justify-content: space-between; }
        .section-label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #000; text-transform: uppercase; }
        .void-stamp { border: 2.5px solid #000; display: inline-block; padding: 2px 8px; font-weight: 800; font-size: 12px; letter-spacing: 2px; }
        .info-label { color: #333; font-weight: 600; }
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

  /* ── shared inline styles ── */
  const S = {
    label:   { color: "#333", fontWeight: 600 } as React.CSSProperties,
    value:   { fontWeight: 700, color: "#000" } as React.CSSProperties,
    row:     { display: "flex", justifyContent: "space-between", margin: "3px 0" } as React.CSSProperties,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-gray-100">
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
                width: "300px",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "13px",
                lineHeight: "1.55",
                color: "#000",
              }}
            >
              {/* ── HEADER ── */}
              <div className="px-5 pt-5 pb-3 text-center">
                {showLogo && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="logo mx-auto mb-2"
                    style={{ maxWidth: "80px", maxHeight: "80px", objectFit: "contain", display: "block" }}
                  />
                )}
                <p style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                  {businessName}
                </p>
                {receiptTagline && (
                  <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "2px", color: "#333", textTransform: "uppercase", marginTop: "2px" }}>
                    {receiptTagline}
                  </p>
                )}
                {displayAddress && (
                  <p style={{ fontSize: "11px", color: "#222", marginTop: "4px", fontWeight: 500 }}>{displayAddress}</p>
                )}
                {displayPhone && (
                  <p style={{ fontSize: "11px", color: "#222", fontWeight: 500 }}>Tel: {displayPhone}</p>
                )}
                {receiptEmail && (
                  <p style={{ fontSize: "11px", color: "#222", fontWeight: 500 }}>{receiptEmail}</p>
                )}
                {receiptWebsite && (
                  <p style={{ fontSize: "11px", color: "#222", fontWeight: 500 }}>{receiptWebsite}</p>
                )}
                {receiptTin && (
                  <p style={{ fontSize: "11px", color: "#222", fontWeight: 600 }}>TIN: {receiptTin}</p>
                )}
              </div>

              {/* ── GRA STAMP ── */}
              <div className="mx-4 mb-2" style={{ border: "2px solid #000", textAlign: "center", padding: "4px 6px" }}>
                <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "1.5px" }}>GHANA REVENUE AUTHORITY</p>
                <p style={{ fontSize: "12px", fontWeight: 800 }}>E-VAT OFFICIAL RECEIPT</p>
              </div>

              {/* ── DASHED DIVIDER ── */}
              <div style={{ borderTop: "1px dashed #666", margin: "5px 16px" }} />

              {/* ── TRANSACTION INFO ── */}
              <div className="px-5" style={{ fontSize: "12px" }}>
                <div style={S.row}>
                  <span style={S.label}>Receipt No:</span>
                  <span style={S.value}>{tx?.receiptNumber}</span>
                </div>
                <div style={S.row}>
                  <span style={S.label}>GRA Ref:</span>
                  <span style={{ fontWeight: 700 }}>{receipt?.graReceiptNumber}</span>
                </div>
                <div style={S.row}>
                  <span style={S.label}>Date:</span>
                  <span style={{ fontWeight: 600 }}>{tx?.createdAt ? formatDate(tx.createdAt) : "—"}</span>
                </div>
                {tx?.cashierName && (
                  <div style={S.row}>
                    <span style={S.label}>Cashier:</span>
                    <span style={{ fontWeight: 600 }}>{tx.cashierName}</span>
                  </div>
                )}
                {tx?.customerName && (
                  <div style={S.row}>
                    <span style={S.label}>Customer:</span>
                    <span style={{ fontWeight: 600 }}>{tx.customerName}</span>
                  </div>
                )}
                {tx?.customerPhone && (
                  <div style={S.row}>
                    <span style={S.label}>Phone:</span>
                    <span style={{ fontWeight: 600 }}>{tx.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* ── DASHED ── */}
              <div style={{ borderTop: "1px dashed #666", margin: "7px 16px" }} />

              {/* ── ITEMS ── */}
              <div className="px-5">
                <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px", color: "#000", marginBottom: "5px", textTransform: "uppercase" }}>
                  Items Purchased
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#333", fontWeight: 600, borderBottom: "1.5px solid #000", paddingBottom: "3px", marginBottom: "5px" }}>
                  <span>Description</span><span>Amount</span>
                </div>
                {items.map((item: any, i: number) => {
                  const lineTotal = item.total ?? (parseFloat(item.price) * item.quantity);
                  return (
                    <div key={i} style={{ marginBottom: "7px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, lineHeight: "1.4" }}>{item.name}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#333", fontWeight: 600 }}>
                        <span>{item.quantity} × {formatCurrency(item.price)}</span>
                        <span style={{ color: "#000", fontWeight: 700 }}>{formatCurrency(lineTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── SOLID DIVIDER ── */}
              <div style={{ borderTop: "1.5px solid #000", margin: "5px 16px" }} />

              {/* ── TOTALS ── */}
              <div className="px-5" style={{ fontSize: "12px" }}>
                <div style={S.row}>
                  <span style={S.label}>Subtotal</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(tx?.subtotal ?? 0)}</span>
                </div>
                {taxBreakdown ? (
                  <>
                    {taxBreakdown.vat    && <div style={S.row}><span style={S.label}>VAT</span><span style={{ fontWeight: 700 }}>{formatCurrency(taxBreakdown.vat)}</span></div>}
                    {taxBreakdown.nhil   && <div style={S.row}><span style={S.label}>NHIL</span><span style={{ fontWeight: 700 }}>{formatCurrency(taxBreakdown.nhil)}</span></div>}
                    {taxBreakdown.getFund && <div style={S.row}><span style={S.label}>GETFund</span><span style={{ fontWeight: 700 }}>{formatCurrency(taxBreakdown.getFund)}</span></div>}
                    {taxBreakdown.covid  && <div style={S.row}><span style={S.label}>COVID</span><span style={{ fontWeight: 700 }}>{formatCurrency(taxBreakdown.covid)}</span></div>}
                  </>
                ) : (
                  <div style={S.row}>
                    <span style={S.label}>VAT</span>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(tx?.taxAmount ?? 0)}</span>
                  </div>
                )}
              </div>

              {/* ── DOUBLE RULE ── */}
              <div style={{ borderTop: "3px double #000", margin: "6px 16px 5px" }} />

              {/* ── GRAND TOTAL ── */}
              <div className="px-5 pb-1">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.5px" }}>TOTAL</span>
                  <span style={{ fontSize: "16px", fontWeight: 800 }}>{formatCurrency(tx?.total ?? 0)}</span>
                </div>
              </div>

              {/* ── DOUBLE RULE ── */}
              <div style={{ borderTop: "3px double #000", margin: "5px 16px 7px" }} />

              {/* ── PAYMENT ── */}
              <div className="px-5" style={{ fontSize: "12px" }}>
                <div style={S.row}>
                  <span style={S.label}>Payment Method</span>
                  <span style={{ fontWeight: 800, textTransform: "uppercase" }}>{tx?.paymentMethod}</span>
                </div>
                {tx?.momoPhone && (
                  <div style={S.row}>
                    <span style={S.label}>MoMo Phone</span>
                    <span style={{ fontWeight: 600 }}>{tx.momoPhone}</span>
                  </div>
                )}
                {tx?.momoNetwork && (
                  <div style={S.row}>
                    <span style={S.label}>Network</span>
                    <span style={{ fontWeight: 600 }}>{tx.momoNetwork}</span>
                  </div>
                )}
                {tx?.momoReference && (
                  <div style={S.row}>
                    <span style={S.label}>Ref</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.momoReference}</span>
                  </div>
                )}
                {cashInfo?.cashReceived && (
                  <>
                    <div style={S.row}>
                      <span style={S.label}>Cash Received</span>
                      <span style={{ fontWeight: 700 }}>{formatCurrency(cashInfo.cashReceived)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #666", marginTop: "4px", paddingTop: "4px" }}>
                      <span style={{ fontWeight: 800, fontSize: "13px" }}>Change Given</span>
                      <span style={{ fontWeight: 800, fontSize: "13px" }}>{formatCurrency(cashInfo.changeDue ?? 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* ── DASHED ── */}
              <div style={{ borderTop: "1px dashed #666", margin: "9px 16px 7px" }} />

              {/* ── FOOTER ── */}
              <div className="px-5 pb-5 text-center">
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "3px" }}>{receiptFooter}</p>
                <p style={{ fontSize: "11px", color: "#333", fontWeight: 600, marginBottom: "5px" }}>{receiptReturnPolicy}</p>

                {(tx as any)?.isVoided && (
                  <p style={{ fontSize: "12px", fontWeight: 800, border: "2.5px solid #000", display: "inline-block", padding: "2px 10px", letterSpacing: "2px", marginBottom: "5px" }}>
                    *** VOIDED ***
                  </p>
                )}

                <div style={{ borderTop: "1px solid #ccc", paddingTop: "6px", marginTop: "5px" }}>
                  <p style={{ fontSize: "10px", color: "#555", fontWeight: 500 }}>This is a computer generated receipt</p>
                  <p style={{ fontSize: "10px", color: "#555", fontWeight: 700, letterSpacing: "0.5px" }}>
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

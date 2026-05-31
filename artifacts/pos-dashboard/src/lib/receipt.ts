/**
 * Formats a transaction into a clean 80mm thermal receipt structure.
 * Call this with the finalized transaction data, then send the returned
 * string to an ESC/POS or WebUSB receipt printer.
 */
export function formatThermalReceipt(tx: {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  cashierName?: string;
  receiptNumber: string;
  graReceiptNumber?: string;
  items: { name: string; quantity: number; price: string; total?: string }[];
  subtotal: string;
  taxAmount: string;
  total: string;
  paymentMethod: string;
  momoPhone?: string;
  momoNetwork?: string;
  momoReference?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt?: string;
}): string {
  const w = 32; // characters per line for 80mm thermal
  const center = (s: string) => s.padStart((w + s.length) / 2, " ").padEnd(w, " ");
  const line = "-".repeat(w);
  const dashed = "=".repeat(w);

  const lines = [
    center(tx.storeName?.toUpperCase() ?? "MIRRORTECH"),
    tx.storeAddress ? center(tx.storeAddress) : "",
    tx.storePhone ? center(`Tel: ${tx.storePhone}`) : "",
    "",
    center("GHANA REVENUE AUTHORITY"),
    center("E-VAT RECEIPT"),
    line,
    `Receipt #: ${tx.receiptNumber}`.slice(0, w),
    tx.graReceiptNumber ? `GRA Ref: ${tx.graReceiptNumber}`.slice(0, w) : "",
    `Date: ${tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-GH") : "—"}`.slice(0, w),
    tx.cashierName ? `Cashier: ${tx.cashierName}`.slice(0, w) : "",
    tx.customerName ? `Customer: ${tx.customerName}`.slice(0, w) : "",
    line,
    "ITEMS",
    ...tx.items.map(item => {
      const nameLine = item.name.length > w ? item.name.slice(0, w - 3) + "..." : item.name;
      const total = parseFloat(item.total ?? "0") || (parseFloat(item.price) * item.quantity);
      const totalStr = total.toFixed(2);
      const spaces = Math.max(1, w - nameLine.length - totalStr.length);
      return `${nameLine}${" ".repeat(spaces)}${totalStr}`;
    }),
    line,
    `Subtotal${" ".repeat(w - "Subtotal".length - parseFloat(tx.subtotal).toFixed(2).length)}${parseFloat(tx.subtotal).toFixed(2)}`,
    `VAT${" ".repeat(w - 3 - parseFloat(tx.taxAmount).toFixed(2).length)}${parseFloat(tx.taxAmount).toFixed(2)}`,
    dashed,
    `TOTAL${" ".repeat(w - "TOTAL".length - parseFloat(tx.total).toFixed(2).length)}${parseFloat(tx.total).toFixed(2)}`,
    dashed,
    `Payment: ${tx.paymentMethod.toUpperCase()}`.slice(0, w),
    tx.momoPhone ? `MoMo: ${tx.momoPhone} (${tx.momoNetwork})`.slice(0, w) : "",
    tx.momoReference ? `Ref: ${tx.momoReference}`.slice(0, w) : "",
    "",
    center("Thank you for your purchase!"),
    center("Goods once sold are not returnable"),
    center("This is a computer generated receipt"),
    center("GRA QR CODE"),
    center("[SIGNATURE AREA]"),
    "",
  ];

  return lines.filter(Boolean).join("\n");
}

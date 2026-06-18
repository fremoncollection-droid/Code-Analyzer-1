export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function fireStockNotification(
  itemName: string,
  quantity: number,
  inventoryUrl: string
): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const title = quantity <= 0 ? "Out of Stock!" : "Low Stock Alert!";
  const body =
    quantity <= 0
      ? `${itemName} is completely out of stock.`
      : `${itemName} is running low — only ${quantity} left.`;

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: `stock-${itemName}`,
        renotify: true,
        data: { url: inventoryUrl },
      } as any);
      return;
    } catch {
      // fallthrough to basic Notification
    }
  }

  new Notification(title, { body, icon: "/favicon.svg" });
}

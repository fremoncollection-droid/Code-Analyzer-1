/* ─── BroadcastChannel for Secondary Monitor ─── */

export type DisplayEvent =
  | { type: "scan"; name: string; price: string }
  | { type: "total"; total: string; itemCount: number }
  | { type: "idle"; message: string; subMessage: string }
  | { type: "theme"; theme: MonitorTheme }
  | { type: "clear" };

export interface MonitorTheme {
  bgColor: string;
  textColor: string;
  fontSize: string;
  logoUrl?: string;
  marketingText?: string;
  marketingScroll?: boolean;
}

const CHANNEL_NAME = "mirrortech-display";

let _channel: BroadcastChannel | null = null;

function ensureChannel() {
  if (!_channel && typeof window !== "undefined") {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

export function broadcast(event: DisplayEvent) {
  const ch = ensureChannel();
  if (ch) ch.postMessage(event);
}

export function onDisplayMessage(handler: (e: DisplayEvent) => void) {
  const ch = ensureChannel();
  if (!ch) return () => {};
  const cb = (e: MessageEvent) => handler(e.data as DisplayEvent);
  ch.addEventListener("message", cb);
  return () => ch.removeEventListener("message", cb);
}

export function openCustomerWindow() {
  const base = window.location.origin;
  const path = `${base}/customer-display.html`;
  window.open(
    path,
    "customer-display",
    "width=800,height=600,menubar=no,toolbar=no,location=no,status=no,scrollbars=no"
  );
}

export const DEFAULT_THEME: MonitorTheme = {
  bgColor: "#1a1a2e",
  textColor: "#ffffff",
  fontSize: "32",
  logoUrl: "",
  marketingText: "Thank you for shopping at MirrorTech!",
  marketingScroll: true,
};

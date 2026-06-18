import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { requestNotificationPermission } from "./lib/notifications";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  requestNotificationPermission().catch(() => {});
}, 3000);

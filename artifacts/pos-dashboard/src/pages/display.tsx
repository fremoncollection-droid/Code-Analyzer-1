import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  connectDisplay,
  disconnectDisplay,
  isConnected,
  writeToDisplay,
  writeIdleMessage,
  testDisplay,
  padLine,
  type Protocol,
} from "@/lib/display-service";
import {
  broadcast,
  openCustomerWindow,
  DEFAULT_THEME,
  type MonitorTheme,
  type DisplayEvent,
} from "@/lib/broadcast-service";
import { Monitor, Settings, ShoppingBag, ShoppingCart, ExternalLink, Check, Unplug } from "lucide-react";

function interpolate(line: string, vars: Record<string, string>) {
  return line.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function buildPoleLines(
  templateL1: string,
  templateL2: string,
  vars: Record<string, string>
) {
  return {
    line1: padLine(interpolate(templateL1, vars)),
    line2: padLine(interpolate(templateL2, vars)),
  };
}

/* ─── Live Preview Panel (simulated customer screen) ─── */
function LivePreview({ theme, item, total }: { theme: MonitorTheme; item: string; total: string }) {
  return (
    <div
      className="rounded-xl border-4 border-white/20 shadow-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: theme.bgColor, color: theme.textColor, fontSize: `${theme.fontSize}px` }}
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        {theme.logoUrl && (
          <img src={theme.logoUrl} alt="Logo" className="h-16 object-contain rounded" />
        )}
        <div className="font-bold tracking-tight">{item || "Ready to scan"}</div>
        <div className="font-mono opacity-80">{total}</div>
      </div>
      {theme.marketingText && (
        <div className="bg-black/20 px-4 py-2 text-center text-base">
          {theme.marketingScroll ? (
            <div className="overflow-hidden whitespace-nowrap">
              <span className="inline-block animate-[marquee_8s_linear_infinite] text-sm">
                {theme.marketingText}             {theme.marketingText}
              </span>
            </div>
          ) : (
            <span className="text-sm">{theme.marketingText}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Pole Display Preview (simulated VFD) ─── */
function PolePreview({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div className="bg-black rounded-lg p-3 border border-gray-700 shadow-inner font-mono text-sm">
      <div className="text-green-400 whitespace-pre">{line1 || " ".repeat(20)}</div>
      <div className="text-green-400 whitespace-pre mt-0.5">{line2 || " ".repeat(20)}</div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function DisplayPage() {
  const { toast } = useToast();
  const [serialConnected, setSerialConnected] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>("escpos");
  const [poleL1, setPoleL1] = useState("{{name}}");
  const [poleL2, setPoleL2] = useState("{{price}}");
  const [idleL1, setIdleL1] = useState("Welcome!");
  const [idleL2, setIdleL2] = useState("Thanks for shopping");
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [theme, setTheme] = useState<MonitorTheme>({ ...DEFAULT_THEME });
  const [item, setItem] = useState("");
  const [total, setTotal] = useState("");
  const [currentItem, setCurrentItem] = useState("Ready to scan");
  const [currentTotal, setCurrentTotal] = useState("Total: ₵0.00");
  const [savedIdle, setSavedIdle] = useState({ l1: "Welcome!", l2: "Thanks for shopping" });
  const [lastEvent, setLastEvent] = useState<DisplayEvent | null>(null);

  const handleConnect = async () => {
    const ok = await connectDisplay(protocol);
    setSerialConnected(ok);
    if (ok) toast({ title: "Pole display connected" });
    else toast({ title: "Connection failed", variant: "destructive" });
  };

  const handleDisconnect = async () => {
    await disconnectDisplay();
    setSerialConnected(false);
    toast({ title: "Pole display disconnected" });
  };

  const handleTest = async () => {
    if (!isConnected()) {
      toast({ title: "Connect display first", variant: "destructive" });
      return;
    }
    await testDisplay();
    toast({ title: "Test message sent" });
  };

  const sendToPole = async (l1: string, l2: string) => {
    if (isConnected()) {
      await writeToDisplay(l1, l2);
    }
  };

  const sendIdle = async () => {
    setSavedIdle({ l1: idleL1, l2: idleL2 });
    await sendToPole(idleL1, idleL2);
    broadcast({ type: "idle", message: idleL1, subMessage: idleL2 });
    setCurrentItem(idleL1);
    setCurrentTotal(idleL2);
    toast({ title: "Idle message sent" });
  };

  const mockScan = (name: string, price: string) => {
    const vars = { name, price };
    const { line1, line2 } = buildPoleLines(poleL1, poleL2, vars);
    sendToPole(line1, line2);
    const displayText = `${name} – ₵${price}`;
    setCurrentItem(displayText);
    setCurrentTotal(`Total: ₵${price}`);
    setLastEvent({ type: "scan", name, price });
    broadcast({ type: "scan", name, price });
  };

  const mockTotal = () => {
    const items = [
      { name: "Apple", price: "1.99" },
      { name: "Bread", price: "3.50" },
      { name: "Milk", price: "4.00" },
      { name: "Soap", price: "6.01" },
    ];
    const totalVal = items.reduce((s, i) => s + parseFloat(i.price), 0).toFixed(2);
    const vars = { name: "TOTAL", price: totalVal };
    const { line1, line2 } = buildPoleLines(poleL1, poleL2, vars);
    sendToPole(line1, line2);
    setCurrentItem("TOTAL");
    setCurrentTotal(`Total: ₵${totalVal}`);
    setLastEvent({ type: "total", total: totalVal, itemCount: items.length });
    broadcast({ type: "total", total: totalVal, itemCount: items.length });
  };

  const openMonitor = () => {
    setMonitorOpen(true);
    openCustomerWindow();
    broadcast({ type: "theme", theme });
    toast({ title: "Customer display opened" });
  };

  const updateTheme = (patch: Partial<MonitorTheme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    broadcast({ type: "theme", theme: next });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastEvent?.type === "scan" || lastEvent?.type === "total") {
        // auto-idle after 5s if no new activity
        // handled by user pressing idle button instead
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastEvent]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6" /> Display Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure pole display and customer monitor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={serialConnected ? "outline" : "default"}
            onClick={serialConnected ? handleDisconnect : handleConnect}
            className={cn("gap-2", serialConnected && "border-emerald-500 text-emerald-600")}
          >
            {serialConnected ? <Check className="w-4 h-4" /> : <Unplug className="w-4 h-4" />}
            {serialConnected ? "Connected" : "Connect Pole Display"}
          </Button>
          <Button variant="outline" onClick={openMonitor} className="gap-2">
            <ExternalLink className="w-4 h-4" /> Open Customer Display
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Section A: Pole Display Settings ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" /> Pole Display Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Protocol</Label>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as Protocol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escpos">Epson ESC/POS</SelectItem>
                  <SelectItem value="cd5220">CD5220</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Line 1 Template (max 20 chars)</Label>
              <Input value={poleL1} onChange={(e) => setPoleL1(e.target.value)} placeholder="{{name}}" />
              <p className="text-xs text-muted-foreground">Use {"{{name}}, {{price}}, {{total}}"}</p>
            </div>
            <div className="space-y-1">
              <Label>Line 2 Template (max 20 chars)</Label>
              <Input value={poleL2} onChange={(e) => setPoleL2(e.target.value)} placeholder="{{price}}" />
            </div>

            <div className="pt-2 border-t">
              <Label className="mb-1 block">Idle / Welcome Message</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={idleL1} onChange={(e) => setIdleL1(e.target.value)} placeholder="Line 1" />
                <Input value={idleL2} onChange={(e) => setIdleL2(e.target.value)} placeholder="Line 2" />
              </div>
              <Button onClick={sendIdle} className="mt-2 w-full gap-2" size="sm">
                <ShoppingBag className="w-3 h-3" /> Set Idle Message
              </Button>
            </div>

            <div className="pt-2">
              <Button onClick={handleTest} variant="outline" className="w-full gap-2" size="sm">
                Test Display
              </Button>
            </div>

            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Pole Preview</Label>
              <div className="mt-1">
                <PolePreview line1={buildPoleLines(poleL1, poleL2, { name: currentItem, price: currentTotal }).line1} line2={buildPoleLines(poleL1, poleL2, { name: currentItem, price: currentTotal }).line2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Section B: Secondary Monitor Settings ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="w-4 h-4" /> Monitor Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.bgColor}
                  onChange={(e) => updateTheme({ bgColor: e.target.value })}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input value={theme.bgColor} onChange={(e) => updateTheme({ bgColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.textColor}
                  onChange={(e) => updateTheme({ textColor: e.target.value })}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input value={theme.textColor} onChange={(e) => updateTheme({ textColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Font Size (px)</Label>
              <Input type="number" value={theme.fontSize} onChange={(e) => updateTheme({ fontSize: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Logo URL</Label>
              <Input value={theme.logoUrl ?? ""} onChange={(e) => updateTheme({ logoUrl: e.target.value || undefined })} placeholder="https://example.com/logo.png" />
            </div>
            <div className="space-y-1">
              <Label>Marketing Message</Label>
              <Textarea
                value={theme.marketingText ?? ""}
                onChange={(e) => updateTheme({ marketingText: e.target.value })}
                placeholder="Thank you for shopping..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="scroll"
                checked={theme.marketingScroll}
                onChange={(e) => updateTheme({ marketingScroll: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="scroll" className="text-sm font-normal">Scroll message</Label>
            </div>
          </CardContent>
        </Card>

        {/* ─── Section C: Live Preview + Simulator ─── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LivePreview theme={theme} item={currentItem} total={currentTotal} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Mock POS Simulator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => mockScan("Apple", "1.99")} className="w-full gap-2" variant="outline">
                <ShoppingBag className="w-3 h-3" /> Mock Scan Apple (₵1.99)
              </Button>
              <Button onClick={() => mockScan("Bread", "3.50")} className="w-full gap-2" variant="outline">
                <ShoppingBag className="w-3 h-3" /> Mock Scan Bread (₵3.50)
              </Button>
              <Button onClick={() => mockScan("Milk", "4.00")} className="w-full gap-2" variant="outline">
                <ShoppingBag className="w-3 h-3" /> Mock Scan Milk (₵4.00)
              </Button>
              <Button onClick={mockTotal} className="w-full gap-2" variant="default">
                <ShoppingCart className="w-3 h-3" /> Mock Total (₵15.50)
              </Button>
              <Button onClick={sendIdle} className="w-full gap-2" variant="secondary">
                <ShoppingBag className="w-3 h-3" /> Send Idle Message
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

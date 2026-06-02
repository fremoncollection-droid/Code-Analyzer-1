/* ─── Web Serial API Pole Display Service ─── */

export type Protocol = "escpos" | "cd5220" | "utc";

const CMDS = {
  escpos: {
    reset: new Uint8Array([0x1b, 0x40]),
    clear: new Uint8Array([0x0c]),
  },
  cd5220: {
    reset: new Uint8Array([0x1b, 0x53]),
    clear: new Uint8Array([0x0c]),
  },
  utc: {
    reset: new Uint8Array([0x0c]),
    clear: new Uint8Array([0x0c]),
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _port: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _writer: any = null;
let _protocol: Protocol = "escpos";

export async function connectDisplay(protocol: Protocol = "escpos"): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (!nav.serial) {
      console.warn("Web Serial API not supported in this browser");
      return false;
    }
    _port = await nav.serial.requestPort({
      filters: [{ usbVendorId: 0x04b8 }, { usbVendorId: 0x067b }], // Epson, Prolific
    });
    await _port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" });
    _writer = _port.writable!.getWriter();
    _protocol = protocol;
    return true;
  } catch (err) {
    console.error("Serial connect failed:", err);
    return false;
  }
}

export async function disconnectDisplay(): Promise<void> {
  if (_writer) {
    try { await _writer.release(); } catch { /* ignore */ }
    _writer = null;
  }
  if (_port) {
    try { await _port.close(); } catch { /* ignore */ }
    _port = null;
  }
}

export function isConnected(): boolean {
  return _port !== null && _writer !== null;
}

/** Pad a string to exactly 20 chars; truncates if over, pads with spaces if under. */
export function padLine(text: string): string {
  const t = text.slice(0, 20);
  return t + " ".repeat(20 - t.length);
}

export async function writeToDisplay(line1: string, line2: string): Promise<void> {
  if (!_writer) return;
  const cmd = CMDS[_protocol];
  await _writer.write(cmd.reset);
  await _writer.write(cmd.clear);
  const encoder = new TextEncoder();
  await _writer.write(encoder.encode(padLine(line1)));
  await _writer.write(encoder.encode("\r"));
  await _writer.write(encoder.encode(padLine(line2)));
}

export async function writeIdleMessage(line1: string, line2: string): Promise<void> {
  await writeToDisplay(line1, line2);
}

export async function testDisplay(): Promise<void> {
  await writeToDisplay("Welcome!", "MirrorTech POS");
}

// QR encoding for My pass. `qrcode-generator` is loaded on demand as its own chunk (DECISIONS E-05).
export interface QrMatrix {
  size: number;
  path: string; // SVG path of dark modules, one unit per module
}

export async function encodeQr(text: string): Promise<QrMatrix> {
  const mod = await import("qrcode-generator");
  const qrcode = (mod as unknown as { default: typeof import("qrcode-generator") }).default ?? mod;
  const qr = (qrcode as unknown as (t: number, e: string) => {
    addData(d: string): void; make(): void; getModuleCount(): number; isDark(r: number, c: number): boolean;
  })(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let path = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { size: n, path };
}

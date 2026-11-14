// Camera QR decoding. Native BarcodeDetector where the browser has it; otherwise `jsqr`, loaded on demand
// as its own chunk (allowed dependency: "a small QR decoder, lazy chunk").
type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

export async function createDecoder(): Promise<(video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (BD) {
    try {
      const det = new BD({ formats: ["qr_code"] });
      return async (video) => (await det.detect(video))[0]?.rawValue ?? null;
    } catch {
      /* fall through to jsQR */
    }
  }
  const { default: jsQR } = await import("jsqr");
  return async (video, canvas) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

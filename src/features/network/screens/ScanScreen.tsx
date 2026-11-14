// Scan a pass (K-77, PRD 5.1): camera QR scan and 6-character code entry. Both open the same tap screen as NFC.
import { useEffect, useRef, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { createDecoder } from "../lib/qrDecode";
import { isValidRef, normaliseRef, refFromScan } from "../lib/ref";
import { ui } from "../lib/tokens";
import { to } from "../paths";
import { BackBar, Button, Card, inputClass } from "../components/ui";

export default function ScanScreen() {
  const { adapter } = useNetwork();
  useRequireAuth(to.scan());
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "denied" | "unsupported">("off");
  const [hint, setHint] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const go = (ref: string) => adapter.navigate(to.tap(normaliseRef(ref), "scan"));

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (camera !== "on") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      const decode = await createDecoder();
      const loop = async () => {
        if (!alive || !video.current || !canvas.current) return;
        try {
          const text = await decode(video.current, canvas.current);
          if (text) {
            const ref = refFromScan(text);
            if (ref) {
              stream.current?.getTracks().forEach((t) => t.stop());
              go(ref);
              return;
            }
            setHint("That QR isn't a Pan-IIM pass.");
          }
        } catch {
          /* keep trying */
        }
        timer = setTimeout(loop, 250);
      };
      loop();
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go is stable enough; restarting the loop is wasteful
  }, [camera]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
    setCamera("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setCamera("on");
    } catch {
      setCamera("denied");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidRef(code)) go(code);
    else setHint("Codes are 6 characters, for example K7QX2M.");
  };

  return (
    <main className={ui.page}>
      <BackBar onBack={adapter.back} label="Network" />
      <h1 className={`${ui.h1} mt-2`}>Scan a pass</h1>
      <p className="mt-1 text-muted-foreground">For phones that don't read the card by tapping.</p>

      <Card className="mt-4 overflow-hidden">
        <div className="relative aspect-square bg-muted">
          <video ref={video} playsInline muted aria-label="Camera preview" className={`h-full w-full object-cover ${camera === "on" ? "" : "hidden"}`} />
          <canvas ref={canvas} className="hidden" />
          {camera !== "on" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {camera === "denied" && <p>Camera access was blocked. Allow it in your browser settings, or type the code below.</p>}
              {camera === "unsupported" && <p>This browser can't use the camera here. Type the code below, or use your phone's camera app on the QR.</p>}
              {(camera === "off" || camera === "starting") && <Button onClick={start} disabled={camera === "starting"}>Start camera</Button>}
            </div>
          )}
          {camera === "on" && <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" />}
        </div>
      </Card>

      <form onSubmit={submit} className="mt-6 space-y-2">
        <label htmlFor="net-scan-code" className="font-semibold">Or type the 6-character code</label>
        <div className="flex gap-2">
          <input
            id="net-scan-code"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 16)); setHint(null); }}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="K7QX2M"
            className={`${inputClass} font-mono text-xl tracking-[0.3em]`}
          />
          <Button type="submit" disabled={code.length < 6}>Open</Button>
        </div>
        {hint && <p role="alert" className="text-sm text-destructive">{hint}</p>}
      </form>
      <p className="mt-6 text-sm text-muted-foreground">Scanning shows the person and records that you met, exactly like a tap.</p>
    </main>
  );
}

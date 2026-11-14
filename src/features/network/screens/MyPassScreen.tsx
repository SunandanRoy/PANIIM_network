// My pass (K-25, K-27, PRD 5.1 item 1): card state, printed code, a QR for the same /t/ URL, share link.
import { useEffect, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { encodeQr, type QrMatrix } from "../lib/qr";
import { passUrl } from "../lib/ref";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import { Activation } from "./TapScreen";
import { BackBar, Button, Card, ErrorNote, Eyebrow, Sheet, Skeleton, Tag } from "../components/ui";

export function QrCode({ text, label, size = 168 }: { text: string; label: string; size?: number }) {
  const [m, setM] = useState<QrMatrix | null>(null);
  useEffect(() => {
    let alive = true;
    encodeQr(text).then((x) => alive && setM(x), () => {});
    return () => {
      alive = false;
    };
  }, [text]);
  if (!m) return <Skeleton className="aspect-square" />;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`-2 -2 ${m.size + 4} ${m.size + 4}`} shapeRendering="crispEdges" className="rounded-xl bg-white">
      <rect x={-2} y={-2} width={m.size + 4} height={m.size + 4} fill="#fff" />
      <path d={m.path} fill="#000" />
    </svg>
  );
}

export default function MyPassScreen() {
  const { api, adapter } = useNetwork();
  const ready = useRequireAuth(to.pass());
  const q = useAsync(() => api.myPass(), [], ready);
  const [lostOpen, setLostOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [busy, setBusy] = useState(false);

  if (activating) return <Activation onDone={() => { setActivating(false); q.reload(); }} />;

  const card = q.data?.card;
  const url = card?.status === "active" && card.printed_code ? passUrl(adapter.hostOrigin, card.printed_code) : null;

  const share = async () => {
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ title: "My Pan-IIM pass", url });
      else {
        await navigator.clipboard.writeText(url);
        adapter.toast("Link copied.", { tone: "success" });
      }
    } catch {
      /* user cancelled */
    }
  };
  const issue = async () => {
    setBusy(true);
    const r = await api.issueDigitalPass().catch(() => ({ error: "x" }) as { error: string });
    setBusy(false);
    if ("error" in r && r.error) adapter.toast("Couldn't create a digital pass right now.", { tone: "error" });
    else q.reload();
  };
  const lost = async () => {
    const r = await api.reportLostCard().catch(() => ({ error: "x" }));
    setLostOpen(false);
    if (r.error) adapter.toast("Couldn't deactivate the card. Ask the desk.", { tone: "error" });
    else {
      adapter.toast("Card deactivated. Taps on it no longer show you. Get a spare at the desk.", { tone: "success" });
      q.reload();
    }
  };

  return (
    <main className={ui.page}>
      <BackBar onBack={adapter.back} label="Network" />
      <h1 className={`${ui.h1} mt-2`}>My pass</h1>
      {!ready || q.loading ? (
        <Skeleton className="mt-4 h-64" />
      ) : q.error ? (
        <div className="mt-4"><ErrorNote message="We couldn't load your pass." onRetry={q.reload} /></div>
      ) : (
        <div className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Pan-IIM WMC 2026</Eyebrow>
              <Tag tone={card?.status === "active" ? tag.green : card?.status === "revoked" ? tag.tan : "bg-muted text-muted-foreground"}>
                {card?.status === "active" ? (card.virtual ? "Digital pass · active" : "Card · active") : card?.status === "revoked" ? "Replaced" : "No pass yet"}
              </Tag>
            </div>
            {url ? (
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <QrCode text={url} label={`QR code for your pass, code ${card!.printed_code}`} />
                <div className="text-center sm:text-left">
                  <p className="font-semibold">Show this to connect in person</p>
                  <p className="text-sm text-muted-foreground">{card!.virtual ? "Anyone who scans it sees your profile." : "Also printed on your card."}</p>
                  <p className="mt-3 font-mono text-3xl font-bold tracking-[0.3em]" aria-label={`Code ${card!.printed_code!.split("").join(" ")}`}>{card!.printed_code}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Button onClick={share}>Share link</Button>
                    <Button variant="outline" onClick={() => adapter.navigate(to.scan())}>Scan someone</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p>{card?.status === "revoked" ? "Your card was replaced or reported lost. Ask the desk for a spare, or use a digital pass." : "You don't have a pass linked yet."}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => setActivating(true)}>I have a card: enter its code</Button>
                  {q.data?.digital_pass_allowed && <Button variant="outline" disabled={busy} onClick={issue}>Use a digital pass</Button>}
                </div>
              </div>
            )}
          </Card>
          {card?.status === "active" && !card.virtual && (
            <Button variant="outline" className="w-full" onClick={() => setLostOpen(true)}>Lost your card?</Button>
          )}
          <p className="text-sm text-muted-foreground">
            A tap or scan shows your profile and records that you met. Contact details stay hidden until you accept.{" "}
            <button type="button" className={ui.link} onClick={() => adapter.navigate(to.visibility())}>Who can see me</button>
          </p>
        </div>
      )}
      <Sheet open={lostOpen} onClose={() => setLostOpen(false)} title="Deactivate your card?">
        <p>Taps on the old card will stop showing your profile straight away. Your connections stay. The desk can link a spare card in under a minute.</p>
        <Button variant="danger" className="mt-4 w-full" onClick={lost}>Deactivate my card</Button>
      </Sheet>
    </main>
  );
}

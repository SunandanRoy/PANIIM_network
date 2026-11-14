// Network home additions (K-47, PRD 5.1): placed by the integrator on the host's existing Network page.
// None of these load the graph library; the preview is a static SVG.
import { useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { bannerCopy, plural } from "../lib/format";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import type { NetworkSummary } from "../types/rpc";
import { VisibilitySettings } from "../screens/VisibilityScreen";
import { Button, Card, Sheet, Skeleton } from "./ui";

/** 1. The QR icon at the top right of Network home opens My pass. */
export function MyPassButton({ className = "" }: { className?: string }) {
  const { adapter } = useNetwork();
  return (
    <button type="button" aria-label="My pass" onClick={() => adapter.navigate(to.pass())} className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-card ${ui.focus} ${className}`}>
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
      </svg>
    </button>
  );
}

/** 2. Visibility banner: wireframe copy, follows the scope; Edit opens the settings sheet. */
export function VisibilityBanner() {
  const { api, user } = useNetwork();
  const q = useAsync(() => api.mySettings(), [user?.id], !!user);
  const [open, setOpen] = useState(false);
  const scope = q.data?.visibility_scope ?? "presenters";
  return (
    <>
      <div className={`flex items-center gap-3 rounded-2xl p-4 ${tag.green}`} data-testid="visibility-banner">
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
        <p className="flex-1">{bannerCopy(scope)}</p>
        {user && <button type="button" onClick={() => setOpen(true)} className={`min-h-11 px-2 font-semibold underline underline-offset-4 ${ui.focus}`}>Edit</button>}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Who can see you">
        <VisibilitySettings onSaved={(s) => q.setData(s)} />
      </Sheet>
    </>
  );
}

function Preview({ s }: { s: NetworkSummary }) {
  const W = 300;
  const H = 150;
  const cx = W / 2;
  const cy = H / 2;
  const firsts = s.preview.filter((n) => n.depth === 1);
  const pos = new Map<string, { x: number; y: number }>();
  firsts.forEach((n, i) => {
    const a = (i / Math.max(1, firsts.length)) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + Math.cos(a) * 85, y: cy + Math.sin(a) * 45 });
  });
  const seconds = s.preview.filter((n) => n.depth === 2);
  seconds.forEach((n, i) => {
    const p = pos.get(n.parent) ?? { x: cx, y: cy };
    const a = Math.atan2(p.y - cy, p.x - cx) + ((i % 3) - 1) * 0.5;
    pos.set(n.id, { x: Math.min(W - 6, Math.max(6, p.x + Math.cos(a) * 40)), y: Math.min(H - 6, Math.max(6, p.y + Math.sin(a) * 26)) });
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label={`Preview of your network: ${plural(s.direct, "connection")}, ${s.within_two} people within two steps`}>
      {s.preview.map((n) => {
        const p = pos.get(n.id)!;
        const q = n.depth === 1 ? { x: cx, y: cy } : pos.get(n.parent) ?? { x: cx, y: cy };
        return <line key={`l${n.id}`} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1.5} />;
      })}
      {s.preview.map((n) => {
        const p = pos.get(n.id)!;
        return <circle key={n.id} cx={p.x} cy={p.y} r={n.depth === 1 ? 10 : 5} fill={n.colour ?? "#9AA39E"} fillOpacity={n.depth === 1 ? 1 : 0.6} />;
      })}
      <circle cx={cx} cy={cy} r={14} className="fill-foreground" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-background" fontSize={10} fontWeight={700}>You</text>
    </svg>
  );
}

/** 3. "Your network map" preview card after the quick actions. Empty state when there are no connections. */
export function NetworkMapCard() {
  const { api, adapter, user } = useNetwork();
  const q = useAsync(() => api.networkSummary(), [user?.id], !!user);
  if (!user) return null;
  if (q.loading) return <Skeleton className="h-64" />;
  const s = q.data;
  if (!s || s.direct === 0) {
    return (
      <Card className="p-5" data-testid="map-card-empty">
        <h2 className={ui.h2}>Your network map</h2>
        <p className="mt-1 text-muted-foreground">Tap someone's pass or scan their QR. Each person you meet appears here, with the people they know.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => adapter.navigate(to.scan())}>Scan a pass</Button>
          <Button variant="outline" onClick={() => adapter.navigate(to.pass())}>Show my pass</Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5" data-testid="map-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className={ui.h2}>Your network map</h2>
        <button type="button" className={`${ui.link} min-h-11`} onClick={() => adapter.navigate(to.map())}>Open full map</button>
      </div>
      <p className="text-muted-foreground">{plural(s.direct, "connection")} · {plural(s.within_two, "person", "people")} within two steps</p>
      <button type="button" className={`mt-2 block w-full rounded-xl ${ui.focus}`} onClick={() => adapter.navigate(to.map())} aria-label="Open full map">
        <Preview s={s} />
      </button>
      {s.legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Theme colours">
          {s.legend.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.colour }} />{t.label}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** 4. Map button for the wireframed "My connections" row. The row itself still opens the list. */
export function MapButton({ className = "" }: { className?: string }) {
  const { adapter } = useNetwork();
  return (
    <Button variant="outline" className={className} onClick={(e) => { e.stopPropagation(); adapter.navigate(to.map()); }}>
      Map
    </Button>
  );
}

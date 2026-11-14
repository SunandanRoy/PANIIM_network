// Overlap mode (K-52, PRD 5.5): up to three themes, seven regions, My network or Event scope.
// Counts come from the server and include only people the viewer may see.
import { useEffect, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { regionLabel, regionsFor, regionSum } from "../lib/graphMath";
import { ui } from "../lib/tokens";
import type { OverlapScope, Region, Theme } from "../types/rpc";
import { PersonRow } from "../components/person";
import { Button, Card, Chip, Segmented, Skeleton } from "../components/ui";

const GEOM: Record<number, { circles: { x: number; y: number }[]; labels: Partial<Record<Region, { x: number; y: number }>> }> = {
  1: { circles: [{ x: 150, y: 130 }], labels: { A: { x: 150, y: 130 } } },
  2: { circles: [{ x: 115, y: 130 }, { x: 185, y: 130 }], labels: { A: { x: 78, y: 130 }, B: { x: 222, y: 130 }, AB: { x: 150, y: 130 } } },
  3: {
    circles: [{ x: 112, y: 100 }, { x: 188, y: 100 }, { x: 150, y: 166 }],
    labels: { A: { x: 78, y: 82 }, B: { x: 222, y: 82 }, C: { x: 150, y: 214 }, AB: { x: 150, y: 70 }, AC: { x: 110, y: 148 }, BC: { x: 190, y: 148 }, ABC: { x: 150, y: 122 } },
  },
};

export function Overlap({ themes, selected, onSelectedChange, onOpen }: {
  themes: Theme[]; selected: number[]; onSelectedChange: (ids: number[]) => void; onOpen: (id: string) => void;
}) {
  const { api, adapter } = useNetwork();
  const [scope, setScope] = useState<OverlapScope>("network");
  const [region, setRegion] = useState<Region | null>(null);
  const ids = selected.slice(0, 3);
  const counts = useAsync(() => api.vennCounts(ids, scope), [ids.join(","), scope], ids.length > 0);
  const list = useAsync(() => api.listRegion(ids, region!, scope), [ids.join(","), scope, region], ids.length > 0 && !!region);
  useEffect(() => setRegion(null), [ids.join(","), scope]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.logEvent("overlap_open").catch(() => {}); }, [api]);

  const pick = (t: Theme) => {
    if (selected.includes(t.id)) onSelectedChange(selected.filter((x) => x !== t.id));
    else if (selected.length >= 3) adapter.toast("Three themes is the maximum.");
    else onSelectedChange([...selected, t.id]);
  };
  const chosen = ids.map((id) => themes.find((t) => t.id === id)).filter(Boolean) as Theme[];
  const labels = chosen.map((t) => t.label);
  const c = counts.data;
  const geom = GEOM[chosen.length];

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">Pick up to 3 themes</p>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {themes.map((t) => <Chip key={t.id} active={selected.includes(t.id)} colour={t.colour} onClick={() => pick(t)}>{t.label}</Chip>)}
        </div>
      </div>
      {chosen.length > 0 && (
        <Segmented<OverlapScope>
          label="Count people in"
          value={scope}
          onChange={setScope}
          options={[
            { value: "network", label: `My network${c?.totals ? ` · ${c.totals.network}` : ""}` },
            { value: "event", label: `Event${c?.totals ? ` · ${c.totals.event}` : ""}` },
          ]}
        />
      )}
      {chosen.length === 0 ? (
        <Card className="p-5"><p>Choose a theme above to see how your network splits by subject.</p></Card>
      ) : counts.loading ? (
        <Skeleton className="aspect-[300/260]" />
      ) : c?.paused ? (
        <Card className="p-5"><p>Overlap is paused for a moment. Try again shortly.</p></Card>
      ) : !c || c.error ? (
        <Card className="p-5"><p>We couldn't load the counts.</p><Button variant="outline" className="mt-2" onClick={counts.reload}>Try again</Button></Card>
      ) : geom ? (
        <>
          <div className="relative mx-auto aspect-[300/260] w-full max-w-md">
            <svg viewBox="0 0 300 260" className="absolute inset-0 h-full w-full" aria-hidden>
              {geom.circles.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={chosen.length === 1 ? 100 : 82} fill={chosen[i]!.colour} fillOpacity={0.22} stroke={chosen[i]!.colour} strokeOpacity={0.6} />
                </g>
              ))}
            </svg>
            {regionsFor(chosen.length).map((r) => {
              const p = geom.labels[r]!;
              const n = c.regions[r] ?? 0;
              const single = r.length === 1;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={region === r}
                  aria-label={`${regionLabel(r, labels)}: ${n} ${n === 1 ? "person" : "people"}`}
                  onClick={() => setRegion(r)}
                  className={`absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full px-1 ${region === r ? "ring-2 ring-foreground" : ""} ${ui.focus}`}
                  style={{ left: `${(p.x / 300) * 100}%`, top: `${(p.y / 260) * 100}%` }}
                >
                  <span className="text-2xl font-bold leading-none">{n}</span>
                  {single && <span className="max-w-24 truncate text-xs font-semibold">{labels["ABC".indexOf(r)]}</span>}
                </button>
              );
            })}
          </div>
          {region && (
            <Card className="p-4" aria-live="polite">
              <p className={ui.eyebrow}>{regionLabel(region, labels)} · {c.regions[region] ?? 0} {(c.regions[region] ?? 0) === 1 ? "person" : "people"}</p>
              {list.loading ? <Skeleton className="mt-3 h-16" /> : (list.data?.people.length ?? 0) === 0 ? (
                <p className="mt-3 text-muted-foreground">No one here.</p>
              ) : (
                <ul className="-mx-4 mt-2">
                  {list.data!.people.map((p) => <PersonRow key={p.id} item={p} onOpen={() => onOpen(p.id)} trailing={<Button variant="ghost" onClick={() => onOpen(p.id)}>View</Button>} />)}
                </ul>
              )}
            </Card>
          )}
          <p className="text-sm text-muted-foreground" data-testid="overlap-note">
            Counts include only people whose visibility scope lets you see them. Region counts add up to {regionSum(c.regions)},
            {scope === "network" ? " everyone in your network" : " every discoverable delegate"} with at least one selected theme.
          </p>
        </>
      ) : null}
    </div>
  );
}

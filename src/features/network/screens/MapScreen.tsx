// /network/map: Constellation and Overlap share one page and one filter state (mockups m2, m3).
// This screen is lazy-loaded with the graph code (K-47); d3 never reaches the host's main bundle.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync, usePrefersReducedMotion } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { byCloseness, emptyFilters, matches, type GraphFilters } from "../lib/graphMath";
import { plural, roleLine } from "../lib/format";
import { ui } from "../lib/tokens";
import { to } from "../paths";
import type { EgoGraph, GraphNode, Theme } from "../types/rpc";
import Constellation, { type ConstellationHandle } from "../graph/Constellation";
import { Overlap } from "../graph/Overlap";
import ProfileScreen from "./ProfileScreen";
import { Avatar, Button, Card, Chip, ErrorNote, Eyebrow, Segmented, Skeleton, inputClass } from "../components/ui";

export interface MapScreenProps {
  focusId?: string | null;
  initialView?: "constellation" | "overlap" | "list";
}

export default function MapScreen({ focusId, initialView = "constellation" }: MapScreenProps) {
  const { api, adapter } = useNetwork();
  const ready = useRequireAuth(to.map());
  const [view, setView] = useState<"constellation" | "overlap">(initialView === "overlap" ? "overlap" : "constellation");
  const [asList, setAsList] = useState(initialView === "list");
  const [filters, setFilters] = useState<GraphFilters>(emptyFilters);
  const [selected, setSelected] = useState<string | null>(focusId ?? null);
  const [panel, setPanel] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const graphRef = useRef<ConstellationHandle>(null);

  const graph = useAsync(() => api.egoGraph(2), [], ready);
  const themes = useAsync(() => api.themes(), [], ready);
  const themeMap = useMemo(() => new Map((themes.data ?? []).map((t) => [t.id, t])), [themes.data]);
  useEffect(() => { if (ready) api.logEvent("map_open").catch(() => {}); }, [ready, api]);
  useEffect(() => { if (focusId && graph.data) setTimeout(() => graphRef.current?.flyTo(focusId), 50); }, [focusId, graph.data]);

  // Esc closes the peek and returns focus to the node (K-43).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || panel) return;
      if (selected) {
        const id = selected;
        setSelected(null);
        setTimeout(() => (document.querySelector(`[data-node="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, panel]);

  const open = (id: string) => {
    if (window.matchMedia?.("(min-width: 1024px)").matches) setPanel(id);
    else adapter.navigate(to.person(id));
  };

  const g = graph.data;
  const people = useMemo(() => (g ? g.nodes.filter((n) => n.depth > 0) : []), [g]);
  const visible = people.filter((n) => matches(n, filters));
  const direct = people.filter((n) => n.depth === 1).length;
  const sel = g?.nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="lg:flex lg:gap-6">
      <main className={`${ui.page} lg:max-w-3xl lg:flex-1`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>Network</Eyebrow>
            <h1 className={ui.h1}>Your map</h1>
          </div>
          <Button variant="outline" onClick={() => adapter.navigate(adapter.networkHomePath)}>Close</Button>
        </div>
        <div className="mt-4">
          <Segmented<"constellation" | "overlap"> label="Map view" value={view} onChange={setView} options={[{ value: "constellation", label: "Constellation" }, { value: "overlap", label: "Overlap" }]} />
        </div>

        {!ready || graph.loading || themes.loading ? (
          <Skeleton className="mt-4 h-[460px]" />
        ) : graph.error ? (
          <div className="mt-4"><ErrorNote message="We couldn't load your map." onRetry={graph.reload} /></div>
        ) : g?.paused ? (
          <Card className="mt-4 p-5"><p>The map is paused for a moment. Your connections are safe; try again shortly.</p></Card>
        ) : view === "overlap" ? (
          <div className="mt-4">
            <Overlap themes={themes.data ?? []} selected={filters.themeIds} onSelectedChange={(ids) => setFilters({ ...filters, themeIds: ids })} onOpen={open} />
          </div>
        ) : g && direct === 0 ? (
          <EmptyMap />
        ) : g ? (
          <>
            <ThemeChips themes={themes.data ?? []} filters={filters} setFilters={setFilters} />
            <MoreFilters people={people} filters={filters} setFilters={setFilters} onFly={(id) => { setSelected(id); graphRef.current?.flyTo(id); }} />
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" aria-pressed={asList} onClick={() => setAsList(!asList)}>{asList ? "Show map" : "Show as list"}</Button>
            </div>
            {direct <= 2 && <p className="mt-1 text-sm text-muted-foreground">{direct === 1 ? "One connection so far. Each new tap adds them and the people they know." : "Two connections so far. Your map fills in as you meet people."}</p>}
            {asList ? (
              <ListView nodes={visible} themes={themeMap} onOpen={open} />
            ) : (
              <Card className="relative mt-2 overflow-hidden">
                <div className="absolute left-3 top-3 z-10 flex gap-2">
                  <Chip active={filters.depth === 2} onClick={() => setFilters({ ...filters, depth: 2 })}>2 steps</Chip>
                  <Chip active={filters.depth === 1} onClick={() => setFilters({ ...filters, depth: 1 })}>1 step</Chip>
                </div>
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
                  <Button variant="outline" aria-label="Zoom in" className="h-11 w-11 rounded-full p-0" onClick={() => graphRef.current?.zoomBy(1.25)}>+</Button>
                  <Button variant="outline" aria-label="Zoom out" className="h-11 w-11 rounded-full p-0" onClick={() => graphRef.current?.zoomBy(0.8)}>−</Button>
                </div>
                <Constellation ref={graphRef} graph={g} themes={themeMap} filters={filters} selectedId={selected} onSelect={setSelected} onOpen={open} reducedMotion={reduced} />
                <p className="absolute bottom-2 left-3 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">Size = connections · Line = similarity</p>
                {visible.length === 0 && (
                  <p role="status" className="absolute inset-x-0 top-1/2 text-center font-semibold">No one in your map matches these filters.</p>
                )}
              </Card>
            )}
            {g.truncated && <p className="mt-2 text-sm text-muted-foreground">Showing the 300 people closest to you out of {g.total}.</p>}
            {sel && !asList && <Peek node={sel} themes={themeMap} onOpen={() => open(sel.id)} />}
            <Legend themes={themes.data ?? []} used={people} />
          </>
        ) : null}
      </main>
      {panel && (
        <aside className="hidden border-l bg-background lg:block lg:w-[420px]" aria-label="Profile">
          <ProfileScreen personId={panel} onClose={() => setPanel(null)} />
        </aside>
      )}
    </div>
  );
}

function ThemeChips({ themes, filters, setFilters }: { themes: Theme[]; filters: GraphFilters; setFilters: (f: GraphFilters) => void }) {
  return (
    <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by theme">
      <Chip active={filters.themeIds.length === 0} onClick={() => setFilters({ ...filters, themeIds: [] })}>All themes</Chip>
      {themes.map((t) => (
        <Chip key={t.id} colour={t.colour} active={filters.themeIds.includes(t.id)}
          onClick={() => setFilters({ ...filters, themeIds: filters.themeIds.includes(t.id) ? filters.themeIds.filter((x) => x !== t.id) : [...filters.themeIds, t.id] })}>
          {t.label}
        </Chip>
      ))}
    </div>
  );
}

function MoreFilters({ people, filters, setFilters, onFly }: { people: GraphNode[]; filters: GraphFilters; setFilters: (f: GraphFilters) => void; onFly: (id: string) => void }) {
  const [q, setQ] = useState("");
  const institutes = [...new Set(people.map((p) => p.institute).filter(Boolean) as string[])].sort();
  const roles = [...new Set(people.map((p) => p.role_kind).filter(Boolean) as string[])].sort();
  const sessions = [...new Set(people.map((p) => p.session_id).filter(Boolean) as string[])].sort();
  const hits = q.trim().length >= 2 ? people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : [];
  return (
    <details className="mt-3 rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Search and filters</summary>
      <div className="mt-2 space-y-3">
        <div>
          <input type="search" aria-label="Find someone on your map" placeholder="Find someone on your map" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
          {hits.length > 0 && (
            <ul className="mt-1">
              {hits.map((h) => <li key={h.id}><button type="button" className={`min-h-11 w-full rounded-lg px-2 text-left hover:bg-accent ${ui.focus}`} onClick={() => { onFly(h.id); setQ(""); }}>{h.name} <span className="text-sm text-muted-foreground">{h.institute}</span></button></li>)}
            </ul>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Institute" className={inputClass} value={filters.institute ?? ""} onChange={(e) => setFilters({ ...filters, institute: e.target.value || null })}>
            <option value="">All institutes</option>{institutes.map((i) => <option key={i}>{i}</option>)}
          </select>
          <select aria-label="Role" className={inputClass} value={filters.roleKind ?? ""} onChange={(e) => setFilters({ ...filters, roleKind: e.target.value || null })}>
            <option value="">All roles</option>{roles.map((r) => <option key={r} value={r}>{r === "phd" ? "PhD scholar" : r[0]!.toUpperCase() + r.slice(1)}</option>)}
          </select>
          <select aria-label="Met at session" className={inputClass} value={filters.sessionId ?? ""} onChange={(e) => setFilters({ ...filters, sessionId: e.target.value || null })}>
            <option value="">Any session</option>{sessions.map((s) => <option key={s} value={s}>Session {s}</option>)}
          </select>
        </div>
      </div>
    </details>
  );
}

function ListView({ nodes, themes, onOpen }: { nodes: GraphNode[]; themes: Map<number, Theme>; onOpen: (id: string) => void }) {
  const sorted = [...nodes].sort(byCloseness);
  if (!sorted.length) return <p role="status" className="mt-4 font-semibold">No one in your map matches these filters.</p>;
  return (
    <Card className="mt-2 overflow-hidden">
      <ul aria-label="People on your map, closest first">
        {sorted.map((n) => (
          <li key={n.id} className="border-b last:border-b-0">
            <button type="button" onClick={() => onOpen(n.id)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent ${ui.focus}`}>
              <Avatar name={n.name} photo={n.photo_url} id={n.id} size={40} />
              <span className="flex-1">
                <span className="block font-bold">{n.name}</span>
                <span className="block text-sm text-muted-foreground">{[roleLine(n.role_label, n.institute), n.depth === 1 ? "Connected" : "Two steps", n.mutual ? plural(n.mutual, "mutual", "mutual") : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex gap-1" aria-label={n.theme_ids.map((t) => themes.get(t)?.label).join(", ")}>
                {n.theme_ids.map((t) => <span key={t} aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: themes.get(t)?.colour }} />)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Peek({ node, themes, onOpen }: { node: GraphNode; themes: Map<number, Theme>; onOpen: () => void }) {
  return (
    <Card className="mt-4 flex items-center gap-4 p-4" aria-live="polite" data-testid="peek">
      <Avatar name={node.name} photo={node.photo_url} id={node.id} size={56} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{node.name}</p>
        <p className="text-sm text-muted-foreground">{[roleLine(node.role_label, node.institute), plural(node.mutual, "mutual", "mutual")].filter(Boolean).join(" · ")}</p>
        <p className="text-xs text-muted-foreground">{node.theme_ids.map((t) => themes.get(t)?.label).filter(Boolean).join(" · ")}</p>
        {(node.ask_text || node.offer_text) && <p className="mt-1 truncate text-xs">{node.ask_text ? `Ask: ${node.ask_text}` : `Offer: ${node.offer_text}`}</p>}
      </div>
      <Button onClick={onOpen}>Open</Button>
    </Card>
  );
}

function Legend({ themes, used }: { themes: Theme[]; used: GraphNode[] }) {
  const ids = new Set(used.flatMap((n) => n.theme_ids.slice(0, 1)));
  const list = themes.filter((t) => ids.has(t.id));
  if (!list.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Colour key: a person's first theme">
      {list.map((t) => <li key={t.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.colour }} />{t.label}</li>)}
      <li className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-foreground" />You</li>
    </ul>
  );
}

function EmptyMap() {
  const { adapter } = useNetwork();
  return (
    <Card className="mt-4 p-6 text-center" data-testid="map-empty">
      <svg aria-hidden viewBox="0 0 120 60" className="mx-auto h-20 w-40"><circle cx="60" cy="30" r="12" className="fill-foreground" /><circle cx="20" cy="18" r="6" className="fill-muted" /><circle cx="100" cy="42" r="6" className="fill-muted" /></svg>
      <h2 className={`${ui.h2} mt-3`}>Your map starts with one tap</h2>
      <p className="mt-1 text-muted-foreground">Tap someone's pass or scan their QR. They appear here, with the people they know who are happy to be seen.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => adapter.navigate(to.scan())}>Scan a pass</Button>
        <Button variant="outline" onClick={() => adapter.navigate(to.pass())}>Show my pass</Button>
      </div>
    </Card>
  );
}

export type { EgoGraph };

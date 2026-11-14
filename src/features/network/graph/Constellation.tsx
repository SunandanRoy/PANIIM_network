// Constellation canvas (K-42, K-43, K-51). Canvas draws; a transparent 44 px button over each node carries
// focus, keyboard, screen-reader label and tap target, so every map action works without a mouse.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { EgoGraph, Theme } from "../types/rpc";
import { adjacency, matches, shortestPath, type GraphFilters } from "../lib/graphMath";
import { initials, roleLine } from "../lib/format";
import { buildLayout, themeHulls, type SimNode } from "./layout";

export interface ConstellationHandle {
  zoomBy(f: number): void;
  flyTo(id: string): void;
  reset(): void;
}

export interface ConstellationProps {
  graph: EgoGraph;
  themes: Map<number, Theme>;
  filters: GraphFilters;
  selectedId: string | null;
  onSelect(id: string | null): void;
  onOpen(id: string): void;
  reducedMotion: boolean;
  height?: number;
}

const ME_COLOUR = "#16191A";
const NEUTRAL = "#9AA39E";

const Constellation = forwardRef<ConstellationHandle, ConstellationProps>(function Constellation(
  { graph, themes, filters, selectedId, onSelect, onOpen, reducedMotion, height = 460 },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(360);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [, setFrame] = useState(0);
  const drag = useRef<{ id?: string; px: number; py: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef(new Map<number, { x: number; y: number }>());
  const justDragged = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => buildLayout(graph, Math.min(width, height) * 1.6), [graph, width, height]);
  const adj = useMemo(() => adjacency(graph), [graph]);
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const topIds = useMemo(
    () => new Set([...layout.nodes].filter((n) => n.depth === 1).sort((a, b) => b.degree - a.degree).slice(0, 5).map((n) => n.id)),
    [layout],
  );
  const path = useMemo(() => (selectedId ? shortestPath(adj, graph.me, selectedId) : null), [adj, graph.me, selectedId]);
  const pathEdges = useMemo(() => {
    const s = new Set<string>();
    path?.forEach((id, i) => i > 0 && s.add([path[i - 1], id].sort().join("|")));
    return s;
  }, [path]);
  const neighbours = useMemo(() => (selectedId ? adj.get(selectedId) ?? new Set<string>() : null), [adj, selectedId]);

  const colourOf = useCallback((n: SimNode, i = 0) => (n.depth === 0 ? ME_COLOUR : themes.get(n.theme_ids[i]!)?.colour ?? NEUTRAL), [themes]);

  // Fit to view once per layout.
  useEffect(() => {
    const xs = layout.nodes.map((n) => n.x ?? 0);
    const ys = layout.nodes.map((n) => n.y ?? 0);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    const k = Math.min(1.6, Math.max(0.4, (Math.min(width, height) - 60) / span));
    const cxm = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cym = (Math.max(...ys) + Math.min(...ys)) / 2;
    setView({ k, x: -cxm * k, y: -cym * k });
  }, [layout, width, height]);

  const toScreen = useCallback((n: SimNode) => ({ x: width / 2 + view.x + (n.x ?? 0) * view.k, y: height / 2 + view.y + (n.y ?? 0) * view.k }), [width, height, view]);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== width * dpr) { c.width = width * dpr; c.height = height * dpr; }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2 + view.x, height / 2 + view.y);
    ctx.scale(view.k, view.k);

    for (const h of themeHulls(layout.nodes)) {
      const col = themes.get(h.themeId)?.colour ?? NEUTRAL;
      const active = !filters.themeIds.length || filters.themeIds.includes(h.themeId);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fillStyle = col + (active ? "1F" : "0A");
      ctx.fill();
    }
    for (const l of layout.links) {
      const s = l.source as SimNode, t = l.target as SimNode;
      const on = matches(s, filters) && matches(t, filters);
      const key = [s.id, t.id].sort().join("|");
      const hl = pathEdges.has(key) || (selectedId && (s.id === selectedId || t.id === selectedId));
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.strokeStyle = pathEdges.has(key) ? ME_COLOUR : `rgba(120,128,124,${!on ? 0.08 : l.direct ? 0.55 : 0.3})`;
      ctx.lineWidth = (hl ? 2.5 : 1) * (1 + (l.sim ?? 0.3) * 1.5) / Math.max(0.6, view.k);
      ctx.stroke();
    }
    for (const n of layout.nodes) {
      const on = matches(n, filters);
      const dim = !on || (neighbours && n.id !== selectedId && !neighbours.has(n.id) && !path?.includes(n.id));
      ctx.globalAlpha = dim ? 0.18 : n.depth === 2 ? 0.75 : 1;
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, n.r, 0, Math.PI * 2);
      ctx.fillStyle = colourOf(n);
      ctx.fill();
      if (n.theme_ids.length > 1 && n.depth > 0) {
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, Math.max(2, n.r * 0.38), 0, Math.PI * 2);
        ctx.fillStyle = colourOf(n, 1);
        ctx.fill();
      }
      if (n.id === selectedId) {
        ctx.lineWidth = 3 / view.k;
        ctx.strokeStyle = ME_COLOUR;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, n.r + 4 / view.k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (n.depth === 0 || n.id === selectedId || topIds.has(n.id)) {
        ctx.font = `${n.depth === 0 ? 700 : 600} ${12 / view.k}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = n.depth === 0 ? "#fff" : ME_COLOUR;
        if (n.depth === 0) ctx.fillText("You", n.x ?? 0, (n.y ?? 0) + 4 / view.k);
        else ctx.fillText(n.id === selectedId ? n.name.split(" ").slice(-1)[0]! : initials(n.name), n.x ?? 0, (n.y ?? 0) + n.r + 14 / view.k);
      }
    }
    ctx.restore();
  }, [width, height, view, layout, themes, filters, pathEdges, selectedId, neighbours, path, colourOf, topIds]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  // Live simulation only while dragging a node, and never under reduced motion.
  useEffect(() => {
    const sim = layout.sim;
    sim.on("tick", () => setFrame((f) => f + 1));
    return () => { sim.stop(); sim.on("tick", null); };
  }, [layout]);

  useImperativeHandle(ref, () => ({
    zoomBy: (f) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * f)) })),
    flyTo: (id) => {
      const n = byId.get(id);
      if (n) setView((v) => ({ k: Math.max(v.k, 1.2), x: -(n.x ?? 0) * Math.max(v.k, 1.2), y: -(n.y ?? 0) * Math.max(v.k, 1.2) }));
    },
    reset: () => setView((v) => ({ ...v, x: 0, y: 0 })),
  }), [byId]);

  const onBgPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 1) drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pinch.current.get(e.pointerId);
    if (pinch.current.size === 2 && prev) {
      const [a, b] = [...pinch.current.values()];
      const before = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pinch.current.values()];
      const after = Math.hypot(c!.x - d!.x, c!.y - d!.y);
      if (before > 0) setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * (after / before))) }));
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (prev) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.id) {
      const n = byId.get(d.id);
      if (n && n.depth > 0 && d.moved) {
        n.fx = (n.x ?? 0) + dx / view.k;
        n.fy = (n.y ?? 0) + dy / view.k;
        d.px = e.clientX; d.py = e.clientY;
        if (reducedMotion) { n.x = n.fx; n.y = n.fy; setFrame((f) => f + 1); }
        else layout.sim.alphaTarget(0.2).restart();
      }
    } else {
      setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId);
    const d = drag.current;
    if (d && !d.moved && !d.id && pinch.current.size === 0) onSelect(null);
    justDragged.current = !!d?.moved;
    setTimeout(() => { justDragged.current = false; }, 0);
    layout.sim.alphaTarget(0);
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    setView((v) => ({ ...v, k: Math.min(4, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }));
  };

  const ordered = useMemo(() => [...layout.nodes].sort((a, b) => a.depth - b.depth || b.mutual - a.mutual), [layout]);

  return (
    <div
      ref={wrap}
      className="relative touch-none select-none overflow-hidden"
      style={{ height }}
      onPointerDown={onBgPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <canvas ref={canvas} aria-hidden style={{ width, height }} className="absolute inset-0" />
      <div role="group" aria-label="People on your map. Use Tab to move between people, Enter to select, Enter again to open.">
        {ordered.map((n) => {
          const p = toScreen(n);
          if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30) return null;
          const hidden = !matches(n, filters);
          const themeNames = n.theme_ids.map((t) => themes.get(t)?.label).filter(Boolean).join(", ");
          const label = n.depth === 0 ? "You" : `${n.name}${roleLine(n.role_label, n.institute) ? `, ${roleLine(n.role_label, n.institute)}` : ""}${themeNames ? `, ${themeNames}` : ""}, ${n.depth === 1 ? "connected" : "two steps away"}, ${n.mutual} mutual`;
          return (
            <button
              key={n.id}
              type="button"
              data-node={n.id}
              aria-label={label}
              aria-pressed={selectedId === n.id}
              tabIndex={hidden ? -1 : 0}
              aria-hidden={hidden || undefined}
              title={n.depth === 0 ? undefined : [n.name, n.ask_text && `Ask: ${n.ask_text}`, n.offer_text && `Offer: ${n.offer_text}`].filter(Boolean).join("\n")}
              className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: p.x, top: p.y }}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = { id: n.id, px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
              }}
              onClick={() => {
                if (justDragged.current) return;
                if (n.depth === 0) return onSelect(null);
                if (selectedId === n.id) onOpen(n.id);
                else onSelect(n.id);
              }}
            />
          );
        })}
      </div>
    </div>
  );
});

export default Constellation;

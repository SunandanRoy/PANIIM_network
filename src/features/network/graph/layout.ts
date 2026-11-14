// d3-force layout for the constellation (K-40, K-42, K-51). This file and Constellation.tsx form the lazy
// graph chunk; nothing else imports d3.
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { EgoGraph, GraphNode } from "../types/rpc";
import { linkDistance } from "../lib/graphMath";

export interface SimNode extends SimulationNodeDatum, GraphNode {
  r: number;
}
export interface SimLink extends SimulationLinkDatum<SimNode> {
  sim: number | null;
  direct: boolean;
}

export function nodeRadius(n: GraphNode, maxDegree: number): number {
  if (n.depth === 0) return 16;
  const base = n.depth === 1 ? 9 : 5;
  return base + (maxDegree > 0 ? (n.degree / maxDegree) * (n.depth === 1 ? 7 : 4) : 0);
}

/** Theme anchors on a circle, in theme id order, so a theme always sits in the same place. */
export function themeAnchors(themeIds: number[], radius: number): Map<number, { x: number; y: number }> {
  const ids = [...new Set(themeIds)].sort((a, b) => a - b);
  const m = new Map<number, { x: number; y: number }>();
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2 - Math.PI / 2;
    m.set(id, { x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  });
  return m;
}

/** Pulls each node toward the mean of its themes' anchors, so a two-theme person sits between both hulls. */
function forceThemes(anchors: Map<number, { x: number; y: number }>, strength: number) {
  let nodes: SimNode[] = [];
  const f = (alpha: number) => {
    for (const n of nodes) {
      if (n.depth === 0 || !n.theme_ids.length) continue;
      let tx = 0, ty = 0, k = 0;
      for (const t of n.theme_ids.slice(0, 3)) {
        const a = anchors.get(t);
        if (a) { tx += a.x; ty += a.y; k++; }
      }
      if (!k) continue;
      n.vx = (n.vx ?? 0) + ((tx / k) - (n.x ?? 0)) * strength * alpha;
      n.vy = (n.vy ?? 0) + ((ty / k) - (n.y ?? 0)) * strength * alpha;
    }
  };
  f.initialize = (ns: SimNode[]) => { nodes = ns; };
  return f;
}

export interface Layout {
  nodes: SimNode[];
  links: SimLink[];
  sim: Simulation<SimNode, SimLink>;
  anchors: Map<number, { x: number; y: number }>;
}

/** Builds and pre-settles the layout before first paint (PRD 5.4: the user never sees it scramble). */
export function buildLayout(g: EgoGraph, size: number, presettleTicks = 300): Layout {
  const maxDegree = Math.max(1, ...g.nodes.map((n) => n.degree));
  const nodes: SimNode[] = g.nodes.map((n, i) => {
    const a = (i / Math.max(1, g.nodes.length)) * Math.PI * 2;
    const rr = n.depth * size * 0.18;
    return { ...n, r: nodeRadius(n, maxDegree), x: n.depth === 0 ? 0 : Math.cos(a) * rr, y: n.depth === 0 ? 0 : Math.sin(a) * rr, fx: n.depth === 0 ? 0 : undefined, fy: n.depth === 0 ? 0 : undefined };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const links: SimLink[] = g.edges.filter((e) => ids.has(e.a) && ids.has(e.b)).map((e) => ({ source: e.a, target: e.b, sim: e.sim, direct: e.direct }));
  const anchors = themeAnchors(nodes.flatMap((n) => n.theme_ids.slice(0, 1)), size * 0.3);
  const sim = forceSimulation<SimNode, SimLink>(nodes)
    .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance((l) => linkDistance(l.sim)).strength(0.5))
    .force("charge", forceManyBody<SimNode>().strength((d) => (d.depth === 2 ? -40 : -110)))
    .force("collide", forceCollide<SimNode>().radius((d) => d.r + 4))
    .force("radial", forceRadial<SimNode>((d) => d.depth * size * 0.2, 0, 0).strength(0.25))
    .force("themes", forceThemes(anchors, 0.08))
    .stop();
  for (let i = 0; i < presettleTicks; i++) sim.tick();
  return { nodes, links, sim, anchors };
}

/** Translucent theme hull around the people whose FIRST theme it is (mockup m2). Radius covers ~80% of
 *  members so one outlier does not swallow the map; two-theme people still sit where hulls overlap. */
export function themeHulls(nodes: SimNode[]): { themeId: number; x: number; y: number; r: number }[] {
  const groups = new Map<number, SimNode[]>();
  for (const n of nodes) {
    const t = n.theme_ids[0];
    if (n.depth === 0 || t === undefined) continue;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(n);
  }
  const out: { themeId: number; x: number; y: number; r: number }[] = [];
  for (const [themeId, ns] of groups) {
    if (ns.length < 3) continue;
    const x = ns.reduce((s, n) => s + (n.x ?? 0), 0) / ns.length;
    const y = ns.reduce((s, n) => s + (n.y ?? 0), 0) / ns.length;
    const d = ns.map((n) => Math.hypot((n.x ?? 0) - x, (n.y ?? 0) - y) + n.r).sort((a, b) => a - b);
    const r = (d[Math.min(d.length - 1, Math.floor(d.length * 0.8))] ?? 0) + 16;
    out.push({ themeId, x, y, r });
  }
  return out;
}

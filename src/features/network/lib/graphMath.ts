import type { EgoGraph, GraphNode, Region } from "../types/rpc";

export function adjacency(g: Pick<EgoGraph, "edges">): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of g.edges) {
    if (!adj.has(e.a)) adj.set(e.a, new Set());
    if (!adj.has(e.b)) adj.set(e.b, new Set());
    adj.get(e.a)!.add(e.b);
    adj.get(e.b)!.add(e.a);
  }
  return adj;
}

/** Shortest path from `from` to `to` over the visible graph (BFS). Only visible people are on it by construction. */
export function shortestPath(adj: Map<string, Set<string>>, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      if (n === to) {
        const path = [to];
        let x = to;
        while (prev.has(x)) {
          x = prev.get(x)!;
          path.unshift(x);
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

export interface GraphFilters {
  themeIds: number[];
  depth: 1 | 2;
  institute: string | null;
  roleKind: string | null;
  sessionId: string | null;
}

export const emptyFilters: GraphFilters = { themeIds: [], depth: 2, institute: null, roleKind: null, sessionId: null };

export function matches(n: GraphNode, f: GraphFilters): boolean {
  if (n.depth === 0) return true;
  if (n.depth > f.depth) return false;
  if (f.themeIds.length && !n.theme_ids.some((t) => f.themeIds.includes(t))) return false;
  if (f.institute && n.institute !== f.institute) return false;
  if (f.roleKind && n.role_kind !== f.roleKind) return false;
  if (f.sessionId && n.session_id !== f.sessionId) return false;
  return true;
}

/** List-view order: direct first, then by mutual count, then name (K-45 "closeness order"). */
export function byCloseness(a: GraphNode, b: GraphNode): number {
  return a.depth - b.depth || b.mutual - a.mutual || a.name.localeCompare(b.name);
}

/** Target link distance from PRD 5.4: 40 + 120 x (1 - S). */
export function linkDistance(sim: number | null | undefined): number {
  const s = typeof sim === "number" ? Math.max(0, Math.min(1, sim)) : 0.3;
  return 40 + 120 * (1 - s);
}

export const REGIONS: Region[] = ["A", "B", "C", "AB", "AC", "BC", "ABC"];

export function regionsFor(n: number): Region[] {
  if (n <= 1) return ["A"];
  if (n === 2) return ["A", "B", "AB"];
  return REGIONS;
}

export function regionLabel(r: Region, labels: string[]): string {
  const names = r.split("").map((ch) => labels["ABC".indexOf(ch)] ?? ch);
  if (names.length === 1) return `Only ${names[0]}`;
  if (names.length === 3) return "All three";
  return `${names[0]} and ${names[1]}`;
}

export function regionSum(regions: Partial<Record<Region, number>>): number {
  return REGIONS.reduce((s, r) => s + (regions[r] ?? 0), 0);
}

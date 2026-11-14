import { describe, expect, it } from "vitest";
import { normaliseRef, isToken, isCode, refFromScan, passUrl } from "./ref";
import { bannerCopy, firstName, initials, privacyLine } from "./format";
import { acceptedOnly, toCsv, toVcard } from "./export";
import { adjacency, byCloseness, linkDistance, matches, emptyFilters, regionLabel, regionSum, regionsFor, shortestPath } from "./graphMath";
import { enqueueConnect, flushConnects, pendingConnects } from "./retryQueue";
import { call, NetError } from "./api";
import type { ConnectionRow, GraphNode } from "../types/rpc";

describe("card references (E-08)", () => {
  it("normalises Crockford tokens and codes", () => {
    expect(normaliseRef(" meera000dem0000l ")).toBe("MEERA000DEM00001");
    expect(isToken("MEERA000DEM00001")).toBe(true);
    expect(isToken("ARJUN000DEM00002")).toBe(false); // U is not Crockford
    expect(isCode("k7qx2m")).toBe(true);
    expect(isCode("K7QX0M")).toBe(false); // 0 is excluded from printed codes
  });
  it("extracts a ref from a scanned pass URL", () => {
    expect(refFromScan("https://paniim.planos.in/t/K7QX2M")).toBe("K7QX2M");
    expect(refFromScan("https://paniim.planos.in/t/MEERA000DEM00001?x=1")).toBe("MEERA000DEM00001");
    expect(refFromScan("https://evil.example/hello")).toBeNull();
    expect(passUrl("https://paniim.planos.in/", "k7qx2m")).toBe("https://paniim.planos.in/t/K7QX2M");
  });
});

describe("copy (wireframe)", () => {
  it("banner follows scope", () => {
    expect(bannerCopy("presenters")).toBe("You're visible to other presenters. Contact details stay hidden until you accept.");
    expect(bannerCopy("all")).toMatch(/^You're visible to all delegates\./);
    expect(bannerCopy("met")).toMatch(/^You're visible only to people you've met\./);
  });
  it("privacy footer uses the first name without title", () => {
    expect(privacyLine("Dr. Meera Iyer", false)).toBe("Email and phone are shared only after Meera accepts a request.");
    expect(firstName("Prof. Rahul Bhattacharya")).toBe("Rahul");
    expect(initials("Dr. Meera Iyer")).toBe("MI");
  });
});

const row = (name: string, granted: boolean, extra: Partial<ConnectionRow["person"]> = {}): ConnectionRow => ({
  person: { id: name, name, institute: "IIM X", role_label: "Faculty", role_kind: "faculty", photo_url: null, headline: null, key_finding: null,
    themes: [], ask_text: null, offer_text: null, is_presenter: true, ...(granted ? { contact: { email: `${name}@x.in` } } : {}), ...extra },
  source: "tap", context: null, session_id: null, created_at: "2026-11-28T06:00:00Z", initiator_is_me: true, note: null,
  contact_granted_to_me: granted, i_shared_contact: false,
});

describe("export (K-83, E1)", () => {
  it("includes only accepted connections", () => {
    const rows = [row("Meera", true), row("Arjun", false)];
    expect(acceptedOnly(rows).map((r) => r.person.name)).toEqual(["Meera"]);
    const csv = toCsv(rows);
    expect(csv).toContain("Meera@x.in");
    expect(csv).not.toContain("Arjun");
    expect(toVcard(rows)).toContain("FN:Meera");
    expect(toVcard(rows)).not.toContain("Arjun");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([row("=HYPERLINK(1)", true)])).toContain(`"'=HYPERLINK(1)"`);
  });
});

const node = (id: string, depth: 0 | 1 | 2, extra: Partial<GraphNode> = {}): GraphNode => ({
  id, depth, name: id, institute: "IIM A", role_label: null, role_kind: "faculty", photo_url: null, theme_ids: [1],
  session_id: null, degree: 1, mutual: 0, ask_text: null, offer_text: null, ...extra,
});

describe("graph maths", () => {
  const g = { edges: [{ a: "me", b: "x", source: "tap" as const, sim: 0.5, direct: true }, { a: "x", b: "y", source: "tap" as const, sim: null, direct: false }] };
  it("finds the path to me", () => {
    expect(shortestPath(adjacency(g), "me", "y")).toEqual(["me", "x", "y"]);
    expect(shortestPath(adjacency(g), "me", "z")).toBeNull();
  });
  it("link distance follows PRD 5.4", () => {
    expect(linkDistance(1)).toBe(40);
    expect(linkDistance(0)).toBe(160);
  });
  it("filters and orders", () => {
    expect(matches(node("a", 2), { ...emptyFilters, depth: 1 })).toBe(false);
    expect(matches(node("a", 1, { theme_ids: [2] }), { ...emptyFilters, themeIds: [1] })).toBe(false);
    expect(matches(node("me", 0), { ...emptyFilters, themeIds: [9] })).toBe(true);
    const sorted = [node("b", 2), node("a", 1, { mutual: 1 }), node("c", 1, { mutual: 3 })].sort(byCloseness).map((n) => n.id);
    expect(sorted).toEqual(["c", "a", "b"]);
  });
  it("venn regions: 3 themes give 7 regions and labels", () => {
    expect(regionsFor(3)).toHaveLength(7);
    expect(regionsFor(2)).toEqual(["A", "B", "AB"]);
    expect(regionLabel("ABC", ["S", "F", "T"])).toBe("All three");
    expect(regionLabel("AC", ["S", "F", "T"])).toBe("S and T");
    expect(regionSum({ A: 6, AB: 2, ABC: 1 })).toBe(9);
  });
});

describe("offline retry queue (R8)", () => {
  it("keeps entries that still fail offline and drops sent ones", async () => {
    localStorage.clear();
    enqueueConnect({ token: "T1", source: "tap", sessionId: null }, 1000);
    enqueueConnect({ token: "T2", source: "scan", sessionId: "3B" }, 1000);
    expect(pendingConnects(2000)).toHaveLength(2);
    const res = await flushConnects(async (p) => { if (p.token === "T2") throw new TypeError("Failed to fetch"); }, (e) => e instanceof TypeError, 2000);
    expect(res).toEqual({ sent: 1, kept: 1 });
    expect(pendingConnects(2000).map((p) => p.token)).toEqual(["T2"]);
    expect(pendingConnects(1000 + 7 * 3600 * 1000)).toHaveLength(0); // expires after 6 h
  });
});

describe("rpc errors", () => {
  it("classifies auth, forbidden and offline", async () => {
    const client = (message: string, code?: string) => ({ rpc: async () => ({ data: null, error: { message, code } }) });
    await expect(call(client("net:auth"), "x")).rejects.toMatchObject({ kind: "auth" });
    await expect(call(client("net:forbidden"), "x")).rejects.toMatchObject({ kind: "forbidden" });
    await expect(call(client("permission denied", "42501"), "x")).rejects.toMatchObject({ kind: "forbidden" });
    await expect(call({ rpc: async () => { throw new TypeError("Failed to fetch"); } }, "x")).rejects.toBeInstanceOf(NetError);
  });
});

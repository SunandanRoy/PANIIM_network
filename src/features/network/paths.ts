/** Routes the module needs (integration-contract section 4). Route bindings register these. */
export const NETWORK_PATHS = {
  tap: "/t/:token",
  map: "/network/map",
  pass: "/network/pass",
  scan: "/network/scan",
  connections: "/network/connections",
  person: "/network/people/:id",
  visibility: "/network/settings/visibility",
  profile: "/network/settings/profile",
  desk: "/network/desk",
} as const;

export const to = {
  tap: (ref: string, source?: "scan") => `/t/${encodeURIComponent(ref)}${source ? "?src=scan" : ""}`,
  map: (opts: { focus?: string; view?: "constellation" | "overlap" | "list" } = {}) => {
    const q = new URLSearchParams();
    if (opts.focus) q.set("focus", opts.focus);
    if (opts.view) q.set("view", opts.view);
    const s = q.toString();
    return `/network/map${s ? `?${s}` : ""}`;
  },
  pass: () => "/network/pass",
  scan: () => "/network/scan",
  connections: () => "/network/connections",
  person: (id: string) => `/network/people/${encodeURIComponent(id)}`,
  visibility: () => "/network/settings/visibility",
  profile: () => "/network/settings/profile",
  desk: () => "/network/desk",
};

// HARNESS adapter: same shape as integration/vite-react-router/src/network.adapter.ts, but signs in with a dev
// token against the local API (harness/api/server.mjs). Uses the real supabase-js client.
import { createClient } from "@supabase/supabase-js";
import type { NetworkHostAdapter, SupabaseClientLike } from "@/features/network";

export const API_URL = (import.meta.env.VITE_NET_API_URL as string | undefined) ?? "http://127.0.0.1:54321";
const KEY = "harness:token";

export const devAuth = {
  token(): string | null {
    try { return localStorage.getItem(KEY); } catch { return null; }
  },
  userId(): string | null {
    const t = devAuth.token();
    if (!t) return null;
    try { return JSON.parse(atob(t.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))).sub ?? null; } catch { return null; }
  },
  async signIn(userId: string) {
    const r = await fetch(`${API_URL}/harness/token`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
    const { access_token } = await r.json();
    localStorage.setItem(KEY, access_token);
    listeners.forEach((l) => l());
  },
  signOut() {
    localStorage.removeItem(KEY);
    listeners.forEach((l) => l());
  },
};
const listeners = new Set<() => void>();

export const supabase = createClient(API_URL, "local-anon", { accessToken: async () => devAuth.token() ?? "" });

export function buildNetworkAdapter(router: Pick<NetworkHostAdapter, "navigate" | "back">): Partial<NetworkHostAdapter> {
  return {
    supabase: supabase as unknown as SupabaseClientLike,
    getUser: async () => (devAuth.userId() ? { id: devAuth.userId()! } : null),
    onAuthChange: (cb) => {
      const l = () => cb(devAuth.userId() ? { id: devAuth.userId()! } : null);
      listeners.add(l);
      return () => listeners.delete(l);
    },
    requireAuth: (returnTo) => router.navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`),
    navigate: router.navigate,
    back: router.back,
    hostOrigin: window.location.origin,
    networkHomePath: "/network",
    getLiveSession: async () => ({ id: "3B", title: "Sustainability · Session 3B" }),
  };
}

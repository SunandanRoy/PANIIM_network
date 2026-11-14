import type { NetworkHostAdapter, SupabaseClientLike, ToastTone } from "./types";

type Listener = (t: { id: number; message: string; tone: ToastTone }) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** The module's own toast bus, used when the host does not provide `toast`. */
export const toastBus = {
  emit(message: string, tone: ToastTone = "info") {
    const t = { id: nextId++, message, tone };
    listeners.forEach((l) => l(t));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

const noClient: SupabaseClientLike = {
  rpc: async () => ({ data: null, error: { message: "Network module: no Supabase client in the adapter", code: "no_client" } }),
};

function browserNavigate(to: string, opts?: { replace?: boolean }) {
  if (typeof window === "undefined") return;
  if (opts?.replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Fills every optional member with a safe default, so the module works with an empty or partial adapter.
 * Host-module actions fall back to a short toast ("... come from the host app").
 */
export function withDefaults(partial: Partial<NetworkHostAdapter>): Required<
  Pick<NetworkHostAdapter, "supabase" | "getUser" | "requireAuth" | "navigate" | "back" | "hostOrigin" | "networkHomePath" |
    "getLiveSession" | "openCoffeeRequest" | "openAskThread" | "onFollow" | "onSave" | "toast" | "analytics" | "onConnectionCreated">
> & NetworkHostAdapter {
  const toast = partial.toast ?? ((m: string, o?: { tone?: ToastTone }) => toastBus.emit(m, o?.tone));
  const navigate = partial.navigate ?? browserNavigate;
  const home = partial.networkHomePath ?? "/network";
  return {
    ...partial,
    supabase: partial.supabase ?? noClient,
    getUser: partial.getUser ?? (async () => null),
    requireAuth:
      partial.requireAuth ??
      ((returnTo: string) => {
        try {
          sessionStorage.setItem("net:returnTo", returnTo);
        } catch {
          /* storage blocked: the URL parameter still carries it */
        }
        navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`);
      }),
    navigate,
    back: partial.back ?? (() => (typeof window !== "undefined" && window.history.length > 1 ? window.history.back() : navigate(home))),
    hostOrigin: partial.hostOrigin ?? (typeof window !== "undefined" ? window.location.origin : ""),
    networkHomePath: home,
    getLiveSession: partial.getLiveSession ?? (async () => null),
    openCoffeeRequest: partial.openCoffeeRequest ?? (() => toast("Coffee requests come from the host app.")),
    openAskThread: partial.openAskThread ?? (() => toast("Questions come from the host app.")),
    onFollow: partial.onFollow ?? (() => toast("Follow comes from the host app.")),
    onSave: partial.onSave ?? (() => toast("Saved people come from the host app.")),
    toast,
    analytics: partial.analytics ?? (() => {}),
    onConnectionCreated: partial.onConnectionCreated ?? (() => {}),
  };
}

export type ResolvedAdapter = ReturnType<typeof withDefaults>;

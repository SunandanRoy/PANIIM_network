import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createNetworkApi, isOffline, type NetworkApi } from "../lib/api";
import { flushConnects } from "../lib/retryQueue";
import type { NetworkHostAdapter, NetworkUser } from "./types";
import { toastBus, withDefaults, type ResolvedAdapter } from "./defaultAdapter";

interface NetworkContextValue {
  adapter: ResolvedAdapter;
  api: NetworkApi;
  user: NetworkUser | null;
  userLoaded: boolean;
}

const Ctx = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ adapter: partial, children }: { adapter: Partial<NetworkHostAdapter>; children: ReactNode }) {
  const adapter = useMemo(() => withDefaults(partial), [partial]);
  const api = useMemo(() => createNetworkApi(adapter.supabase), [adapter]);
  const [user, setUser] = useState<NetworkUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    adapter.getUser().then((u) => {
      if (alive) {
        setUser(u);
        setUserLoaded(true);
      }
    }, () => alive && setUserLoaded(true));
    const off = adapter.onAuthChange?.((u) => {
      setUser(u);
      setUserLoaded(true);
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [adapter]);

  // Flush connects queued while offline (PRD 8, connectivity).
  useEffect(() => {
    if (!user) return;
    const flush = () =>
      flushConnects(async (p) => {
        const r = await api.connectViaCard(p.token, p.source, p.sessionId);
        if (r.created && r.other_id) adapter.onConnectionCreated(r.other_id, p.source);
      }, isOffline).then(({ sent }) => {
        if (sent > 0) adapter.toast(sent === 1 ? "Back online: your connection was saved." : `Back online: ${sent} connections saved.`, { tone: "success" });
      });
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [user, api, adapter]);

  const value = useMemo(() => ({ adapter, api, user, userLoaded }), [adapter, api, user, userLoaded]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {!partial.toast && <NetworkToaster />}
    </Ctx.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("Network module: wrap screens in <NetworkProvider adapter={...}>");
  return v;
}

/** Minimal polite live region used when the host gives no toast function. */
function NetworkToaster() {
  const [items, setItems] = useState<{ id: number; message: string; tone: string }[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  useEffect(() => {
    const map = timers.current;
    const off = toastBus.subscribe((t) => {
      setItems((xs) => [...xs.slice(-2), t]);
      map.set(t.id, setTimeout(() => remove(t.id), 4000));
    });
    return () => {
      off();
      map.forEach(clearTimeout);
    };
  }, [remove]);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${
            t.tone === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

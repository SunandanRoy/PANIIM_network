import { useCallback, useEffect, useRef, useState } from "react";
import { NetError } from "../lib/api";

export interface AsyncState<T> {
  data: T | undefined;
  error: NetError | null;
  loading: boolean;
  reload: () => void;
  setData: (d: T | undefined) => void;
}

/** Runs `fn` when `deps` change (and when `enabled`). Small on purpose: no cache, no host query library. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<NetError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      },
      (e) => {
        if (alive) {
          setError(e instanceof NetError ? e : new NetError("server", String(e)));
          setLoading(false);
        }
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  }, [...deps, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

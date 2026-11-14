// pan-iim-network: HOST EDIT 3 (TanStack Start). Create src/network.adapter.ts from this template and adjust the
// lines marked ADJUST after reading docs/HOST_RECON.md. This is the only file that knows about the host.
import type { NetworkHostAdapter, SupabaseClientLike } from "@/features/network";
import { supabase } from "@/integrations/supabase/client"; // ADJUST if the host's client lives elsewhere (never edit that file)

export function buildNetworkAdapter(router: Pick<NetworkHostAdapter, "navigate" | "back">): Partial<NetworkHostAdapter> {
  return {
    supabase: supabase as unknown as SupabaseClientLike,
    getUser: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ? { id: data.session.user.id } : null;
    },
    onAuthChange: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ? { id: session.user.id } : null));
      return () => data.subscription.unsubscribe();
    },
    requireAuth: (returnTo) => router.navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`), // ADJUST
    navigate: router.navigate,
    back: router.back,
    hostOrigin: typeof window !== "undefined" ? window.location.origin : "https://paniim.planos.in",
    networkHomePath: "/network", // ADJUST
  };
}

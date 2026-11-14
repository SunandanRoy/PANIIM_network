// pan-iim-network: HOST EDIT 3. The integrator creates src/network.adapter.ts from this template and adjusts the
// lines marked ADJUST after reading docs/HOST_RECON.md. This is the only file that knows about the host.
import type { NetworkHostAdapter, SupabaseClientLike } from "@/features/network";
import { supabase } from "@/integrations/supabase/client"; // ADJUST if the host's client lives elsewhere (never edit that file)

export function buildNetworkAdapter(router: Pick<NetworkHostAdapter, "navigate" | "back">): Partial<NetworkHostAdapter> {
  return {
    // The host's typed client is passed as the minimal shape the module needs (rpc only).
    supabase: supabase as unknown as SupabaseClientLike,
    getUser: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ? { id: data.session.user.id } : null;
    },
    onAuthChange: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ? { id: session.user.id } : null));
      return () => data.subscription.unsubscribe();
    },
    // ADJUST: the host's sign-in route and its return parameter.
    requireAuth: (returnTo) => router.navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`),
    navigate: router.navigate,
    back: router.back,
    hostOrigin: typeof window !== "undefined" ? window.location.origin : "https://paniim.planos.in",
    networkHomePath: "/network", // ADJUST if the host's Network page lives elsewhere
    // Optional hooks into host modules. Leave undefined to show a short "comes from the host app" toast.
    // openCoffeeRequest: (personId, name) => router.navigate(`/coffee/new?with=${personId}`),
    // openAskThread: (personId) => ...,
    // getLiveSession: async () => ({ id: "3B", title: "Sustainability · Session 3B" }),
    // toast: (message, opts) => (opts?.tone === "error" ? toast.error(message) : toast(message)),  // sonner
  };
}

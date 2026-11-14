// pan-iim-network: TanStack Start binding. Copied into the host as src/network.root.tsx (a new file).
// Host edit 2 (src/routes/__root.tsx): wrap the <Outlet /> in <NetworkRoot>.
import { useMemo, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { NetworkProvider } from "@/features/network";
import { buildNetworkAdapter } from "@/network.adapter";

export function NetworkRoot({ children }: { children: ReactNode }) {
  const router = useRouter();
  const adapter = useMemo(
    () =>
      buildNetworkAdapter({
        // history.push keeps the module free of the host's typed route tree.
        navigate: (to, opts) => (opts?.replace ? router.history.replace(to) : router.history.push(to)),
        back: () => router.history.back(),
      }),
    [router],
  );
  return <NetworkProvider adapter={adapter}>{children}</NetworkProvider>;
}

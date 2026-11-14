// Public API of the Network module. Hosts import only from here.
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { NetworkProvider } from "./adapter/context";
import type { NetworkHostAdapter } from "./adapter/types";
import { Skeleton } from "./components/ui";

export { NetworkProvider, useNetwork } from "./adapter/context";
export type { NetworkHostAdapter, SupabaseClientLike, NetworkUser, LiveSession } from "./adapter/types";
export { NETWORK_PATHS, to as networkPaths } from "./paths";
export { MyPassButton, VisibilityBanner, NetworkMapCard, MapButton } from "./components/home";
export { ProfileEditor } from "./screens/ProfileEditorScreen";
export type * from "./types/rpc";

// Eager: small screens on the tap path (first paint after a tap must be fast).
export { default as TapScreen } from "./screens/TapScreen";
export { default as ProfileScreen } from "./screens/ProfileScreen";
export { default as VisibilityScreen } from "./screens/VisibilityScreen"; // also used by the banner sheet

// Returns a plain function component (TanStack's RouteComponent rejects class components).
function withSuspense<P extends object>(C: ComponentType<P>) {
  const Wrapped = (props: P) => (
    <Suspense fallback={<div className="mx-auto max-w-xl p-4"><Skeleton className="h-64" /></div>}>
      <C {...props} />
    </Suspense>
  );
  Wrapped.displayName = `Lazy(${C.displayName ?? "Screen"})`;
  return Wrapped;
}

// Lazy: each becomes its own chunk. MapScreen carries d3-force (the graph chunk).
export const MapScreen = withSuspense(lazy(() => import("./screens/MapScreen")));
export const MyPassScreen = withSuspense(lazy(() => import("./screens/MyPassScreen")));
export const ScanScreen = withSuspense(lazy(() => import("./screens/ScanScreen")));
export const ConnectionsScreen = withSuspense(lazy(() => import("./screens/ConnectionsScreen")));
export const ProfileEditorScreen = withSuspense(lazy(() => import("./screens/ProfileEditorScreen")));
export const DeskScreen = withSuspense(lazy(() => import("./screens/DeskScreen")));

/** Convenience: one call returns the provider and every screen bound to the adapter. */
export function createNetworkModule(adapter: Partial<NetworkHostAdapter>) {
  const Provider = ({ children }: { children: ReactNode }) => <NetworkProvider adapter={adapter}>{children}</NetworkProvider>;
  return { Provider, adapter };
}

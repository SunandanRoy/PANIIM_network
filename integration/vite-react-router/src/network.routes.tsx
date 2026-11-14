// pan-iim-network: React Router (v6) binding. Copied into the host as src/network.routes.tsx (a new file).
// Host edit 2 (src/App.tsx): wrap <Routes> in <NetworkRoot> and put {networkRoutes()} inside <Routes>.
import { useMemo, useRef, type ReactNode } from "react";
import { Route, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ConnectionsScreen, DeskScreen, MapScreen, MyPassScreen, NetworkProvider, ProfileEditorScreen, ProfileScreen,
  ScanScreen, TapScreen, VisibilityScreen,
} from "@/features/network";
import { buildNetworkAdapter } from "@/network.adapter";

/** Provides the module to every route (and to the components on the host's Network page). */
export function NetworkRoot({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const nav = useRef(navigate);
  nav.current = navigate; // useNavigate changes identity on every navigation; keep the adapter stable
  const adapter = useMemo(
    () => buildNetworkAdapter({ navigate: (to, opts) => nav.current(to, { replace: opts?.replace }), back: () => nav.current(-1) }),
    [],
  );
  return <NetworkProvider adapter={adapter}>{children}</NetworkProvider>;
}

function Tap() {
  const { token = "" } = useParams();
  const [sp] = useSearchParams();
  return <TapScreen token={token} source={sp.get("src") === "scan" ? "scan" : "tap"} />;
}
function Person() {
  const { id = "" } = useParams();
  return <ProfileScreen personId={id} />;
}
function Map() {
  const [sp] = useSearchParams();
  const v = sp.get("view");
  return <MapScreen focusId={sp.get("focus")} initialView={v === "overlap" || v === "list" ? v : "constellation"} />;
}

/** The module's routes, as a fragment to place inside the host's <Routes>. */
export function networkRoutes() {
  return (
    <>
      <Route path="/t/:token" element={<Tap />} />
      <Route path="/network/map" element={<Map />} />
      <Route path="/network/pass" element={<MyPassScreen />} />
      <Route path="/network/scan" element={<ScanScreen />} />
      <Route path="/network/connections" element={<ConnectionsScreen />} />
      <Route path="/network/people/:id" element={<Person />} />
      <Route path="/network/settings/visibility" element={<VisibilityScreen />} />
      <Route path="/network/settings/profile" element={<ProfileEditorScreen />} />
      <Route path="/network/desk" element={<DeskScreen />} />
    </>
  );
}

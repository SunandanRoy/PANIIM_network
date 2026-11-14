# The three host edits

Every other file the module needs is new and is copied by `scripts/install-into-host.mjs`. If you find
yourself editing any other host file, treat it as a bug in this kit and report it.

## Edit 1: the host's Network page (both stacks)

```diff
+import { MyPassButton, VisibilityBanner, NetworkMapCard, MapButton } from "@/features/network";

 export default function Network() {
   return (
     <main>
-      <header>PAN-IIM WMC 2026 <button aria-label="QR">…</button></header>
+      <header>PAN-IIM WMC 2026 <MyPassButton /></header>
       <h1>Network</h1>
       <p>Meet the people behind the papers. 27–29 Nov, IIM Shillong.</p>
-      <div className="banner">You're visible to other presenters. … <a>Edit</a></div>
+      <VisibilityBanner />
       {/* search, theme chips: unchanged */}
-      <QuickAction label="Scan a pass" onClick={…} />
+      <QuickAction label="Scan a pass" onClick={() => navigate("/network/scan")} />
       {/* Post an ask, Join a table: unchanged */}
+      <NetworkMapCard />
       {/* session-mates, asks and offers, office hours, tables and outings: unchanged */}
       <section>
         <h2>My connections</h2>
-        <ConnectionsRow onClick={…} />
+        <ConnectionsRow onClick={() => navigate("/network/connections")} trailing={<MapButton />} />
       </section>
     </main>
   );
 }
```

The wireframed sections keep their order (K-47). `NetworkMapCard` and `VisibilityBanner` render nothing harmful
when nobody is signed in.

## Edit 2a: React + Vite: `src/App.tsx`

```diff
+import { NetworkRoot, networkRoutes } from "./network.routes";
 …
     <BrowserRouter>
+      <NetworkRoot>
       <Routes>
         <Route path="/" element={<Index />} />
         <Route path="/network" element={<Network />} />
+        {networkRoutes()}
         {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
         <Route path="*" element={<NotFound />} />
       </Routes>
+      </NetworkRoot>
     </BrowserRouter>
```

`<NetworkRoot>` must be inside `<BrowserRouter>`, because it uses `useNavigate`.

## Edit 2b: TanStack Start: `src/routes/__root.tsx`

```diff
+import { NetworkRoot } from "../network.root";
 …
 function RootComponent() {
-  return <Outlet />;
+  return (
+    <NetworkRoot>
+      <Outlet />
+    </NetworkRoot>
+  );
 }
```

The route files are copied into `src/routes/` as `t.$token.tsx` and `network_.*.tsx`. The trailing underscore
keeps them from nesting under the host's own `network.tsx` route. The router plugin regenerates
`routeTree.gen.ts` on the next build.

## Edit 3: `src/network.adapter.ts` (new file, created from the template)

Review the lines marked `ADJUST`:

```ts
import { supabase } from "@/integrations/supabase/client";                         // host client, never edited
requireAuth: (returnTo) => router.navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`), // host sign-in + return param
networkHomePath: "/network",                                                       // host Network page
```

Optional hooks, when the host has these modules:

```ts
openCoffeeRequest: (personId, name) => router.navigate(`/coffee/new?with=${personId}`),
toast: (message, opts) => (opts?.tone === "error" ? toast.error(message) : toast(message)), // sonner
getLiveSession: async () => currentSessionForUser(),          // tags new connections with the live session
renderProfileExtras: (personId) => <OfficeHours personId={personId} />,
renderConnectionsExtras: () => <CoffeeRequestsWaiting />,
```

When the host accepts a coffee request, also call
`supabase.rpc("net_grant_contact", { p_viewer: requesterId, p_source: "coffee" })` as the accepting user. That
is what reveals contact details and records the meeting.

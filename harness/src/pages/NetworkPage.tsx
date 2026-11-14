// HARNESS stand-in for the host's existing Network page (wireframe page 1). Host edit 1 is shown here:
// the four module components placed into the wireframed layout. Everything else is static host content.
import { Link } from "react-router-dom";
import { MapButton, MyPassButton, NetworkMapCard, VisibilityBanner, networkPaths } from "@/features/network";
import { devAuth } from "../network.adapter";

const chips = ["All themes", "Strategy & Innovation", "Sustainability", "Finance"];

export default function NetworkPage() {
  const signedIn = !!devAuth.userId();
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-16 pt-4">
      <div className="flex items-start justify-between">
        <p className="pt-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">PAN-IIM WMC 2026</p>
        <MyPassButton />
      </div>
      <div>
        <h1 className="text-[34px] font-bold leading-tight">Network</h1>
        <p className="text-muted-foreground">Meet the people behind the papers. 27–29 Nov, IIM Shillong.</p>
        {!signedIn && <Link className="mt-2 inline-block font-semibold text-primary underline" to="/auth?redirect=/network">Sign in (dev)</Link>}
      </div>
      <VisibilityBanner />
      <div>
        <label className="text-sm font-semibold" htmlFor="host-search">Search delegates</label>
        <input id="host-search" placeholder="Name, institute, topic or method" className="mt-1 min-h-12 w-full rounded-xl border bg-card px-4" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" tabIndex={0} role="group" aria-label="Themes (host)">
        {chips.map((c, i) => <span key={c} className={`whitespace-nowrap rounded-full border px-4 py-2 ${i === 0 ? "bg-foreground text-background" : "bg-card"}`}>{c}</span>)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Link to={networkPaths.scan()} className="flex min-h-20 flex-col items-center justify-center rounded-2xl border bg-card font-medium">Scan a pass</Link>
        <span className="flex min-h-20 items-center justify-center rounded-2xl border bg-card font-medium">Post an ask</span>
        <span className="flex min-h-20 items-center justify-center rounded-2xl border bg-card font-medium">Join a table</span>
      </div>
      <NetworkMapCard />
      <p className="border-y border-dashed py-3 text-center text-sm text-muted-foreground">… Session-mates, Asks &amp; offers, Office hours, Tables &amp; outings (host, unchanged) …</p>
      <section>
        <h2 className="text-xl font-bold">My connections</h2>
        <Link to={networkPaths.connections()} className="mt-2 flex items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="flex-1"><span className="block font-bold">Your connections</span><span className="text-sm text-muted-foreground">Coffee requests come from the host</span></span>
          <MapButton />
        </Link>
      </section>
      <p className="text-sm"><Link className="underline" to={networkPaths.desk()}>Desk console</Link> · <Link className="underline" to={networkPaths.profile()}>Edit network profile</Link></p>
    </main>
  );
}

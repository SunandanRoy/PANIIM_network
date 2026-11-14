// My connections (K-26, K-83, wireframe page 6). Coffee requests are the host's module: the host can render
// them through adapter.renderConnectionsExtras.
import { useMemo, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { acceptedOnly, download, toCsv, toVcard } from "../lib/export";
import { sourceLabel } from "../lib/format";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import { Avatar, BackBar, Button, Card, ErrorNote, Skeleton, inputClass } from "../components/ui";

export default function ConnectionsScreen() {
  const { api, adapter } = useNetwork();
  const ready = useRequireAuth(to.connections());
  const rows = useAsync(() => api.listConnections(), [], ready);
  const settings = useAsync(() => api.mySettings(), [], ready);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows.data ?? []).filter((r) => !t || [r.person.name, r.person.institute, r.note, r.context].some((x) => x?.toLowerCase().includes(t)));
  }, [rows.data, q]);
  const accepted = acceptedOnly(rows.data ?? []);

  const remove = async (id: string, name: string) => {
    const r = await api.removeConnection(id).catch(() => ({ error: "x" }));
    if (r.error) adapter.toast("Couldn't remove. Try again.", { tone: "error" });
    else {
      adapter.toast(`Removed ${name}. They are not told.`, { tone: "success" });
      rows.reload();
    }
  };
  const exportAs = (kind: "csv" | "vcf") => {
    const data = rows.data ?? [];
    if (kind === "csv") download("pan-iim-contacts.csv", toCsv(data), "text/csv;charset=utf-8");
    else download("pan-iim-contacts.vcf", toVcard(data), "text/vcard;charset=utf-8");
    api.logEvent("export").catch(() => {});
  };
  const reminder = async (on: boolean) => {
    const r = await api.setConsent("followup_reminder", on).catch(() => null);
    if (!r || r.error) adapter.toast("Not saved. Try again.", { tone: "error" });
    else {
      settings.setData(r);
      adapter.toast(on ? "We'll email you a reminder on 30 Nov to follow up." : "Reminder cancelled.", { tone: "success" });
    }
  };

  return (
    <main className={ui.page}>
      <BackBar onBack={adapter.back} label="Network" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className={ui.h1}>My connections</h1>
        <Button variant="outline" onClick={() => adapter.navigate(to.map())}>Map</Button>
      </div>

      <Card className="mt-4 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">Show this to connect in person</p>
          <p className="text-sm text-muted-foreground">Also printed on your pass.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => adapter.navigate(to.pass())}>My pass</Button>
          <Button onClick={() => adapter.navigate(to.scan())}>Scan someone</Button>
        </div>
      </Card>

      {adapter.renderConnectionsExtras && <div className="mt-6">{adapter.renderConnectionsExtras()}</div>}

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className={ui.h2}>People you've met</h2>
          <span className="text-muted-foreground" aria-label={`${rows.data?.length ?? 0} people`}>{rows.data?.length ?? ""}</span>
        </div>
        <input type="search" aria-label="Search people you've met" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, institute or note" className={`${inputClass} mt-3`} />
        {!ready || rows.loading ? (
          <Skeleton className="mt-3 h-48" />
        ) : rows.error ? (
          <div className="mt-3"><ErrorNote message="We couldn't load your connections." onRetry={rows.reload} /></div>
        ) : list.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{rows.data?.length ? "No one matches that search." : "No connections yet. Tap someone's pass or scan their QR to connect."}</p>
        ) : (
          <Card className="mt-3 overflow-hidden">
            <ul>
              {list.map((r) => (
                <li key={r.person.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
                  <Avatar name={r.person.name} photo={r.person.photo_url} id={r.person.id} />
                  <button type="button" className={`min-h-11 flex-1 rounded-lg text-left ${ui.focus}`} onClick={() => adapter.navigate(to.person(r.person.id))}>
                    <span className="block font-bold">{r.person.name}</span>
                    <span className="block text-sm text-muted-foreground">{sourceLabel(r.source, r.context, r.created_at)}</span>
                    {r.note && <span className="block text-sm">Note: {r.note}</span>}
                    {r.contact_granted_to_me && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${tag.green}`}>Contact shared</span>}
                  </button>
                  <Button variant="ghost" aria-label={`Remove ${r.person.name}`} onClick={() => remove(r.person.id, r.person.name)}>Remove</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className={`mt-8 rounded-2xl p-5 ${tag.green}`}>
        <h2 className="text-xl font-bold">After the conference</h2>
        <p className="mt-1">Take your contacts with you, and get a reminder to follow up.</p>
        <p className="mt-1 text-sm">Export includes only the {accepted.length === 1 ? "1 person" : `${accepted.length} people`} who shared contact details with you.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={accepted.length === 0} onClick={() => exportAs("csv")}>Export contacts (CSV)</Button>
          <Button variant="outline" disabled={accepted.length === 0} onClick={() => exportAs("vcf")}>Export to phone (vCard)</Button>
        </div>
        <Button variant={settings.data?.followup_reminder ? "dark" : "outline"} className="mt-2 w-full" aria-pressed={!!settings.data?.followup_reminder} onClick={() => reminder(!settings.data?.followup_reminder)}>
          {settings.data?.followup_reminder ? "✓ Reminder on 30 Nov" : "Email me a reminder"}
        </Button>
      </section>
    </main>
  );
}

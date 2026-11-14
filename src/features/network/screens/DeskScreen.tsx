// Staff console (K-60, K-61, K-27, K-62, K-81 queue). Every action is checked server-side by net_is_staff()
// and written to net_audit; this screen only hides itself for non-staff.
import { useEffect, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { download } from "../lib/export";
import { ui } from "../lib/tokens";
import { to } from "../paths";
import type { AdminDelegate, FeatureFlags } from "../types/rpc";
import { Button, Card, ErrorNote, Field, Segmented, Skeleton, Toggle, inputClass } from "../components/ui";

type Tab = "bind" | "cards" | "reports" | "metrics";

export default function DeskScreen() {
  const { api } = useNetwork();
  const ready = useRequireAuth(to.desk());
  const who = useAsync(() => api.admin.whoami(), [], ready);
  const [tab, setTab] = useState<Tab>("bind");
  if (!ready || who.loading) return <main className={ui.page}><Skeleton className="h-64" /></main>;
  if (!who.data?.staff) {
    return <main className={ui.page}><h1 className={ui.h1}>Desk console</h1><p className="mt-2">This page is for desk volunteers and organisers.</p></main>;
  }
  return (
    <main className={`${ui.page} max-w-3xl`}>
      <h1 className={ui.h1}>Desk console</h1>
      <div className="mt-4">
        <Segmented<Tab> label="Desk sections" value={tab} onChange={setTab} options={[
          { value: "bind", label: "Bind" }, { value: "cards", label: "Cards" }, { value: "reports", label: "Reports" }, { value: "metrics", label: "Metrics" },
        ]} />
      </div>
      <div className="mt-4">
        {tab === "bind" && <BindPanel />}
        {tab === "cards" && <CardsPanel />}
        {tab === "reports" && <ReportsPanel />}
        {tab === "metrics" && <MetricsPanel admin={who.data.role === "admin"} />}
      </div>
    </main>
  );
}

const err = (e?: string) =>
  ({ bad_code: "No card with that code.", card_active: "That card is already linked to someone.", card_revoked: "That card was revoked. Use a spare.",
     already_active: "This delegate already has an active card. Use Lost card swap.", not_registered: "Not a registered delegate.",
     not_active: "Card is not active.", already_revoked: "Already revoked." } as Record<string, string>)[e ?? ""] ?? "That didn't work.";

function BindPanel() {
  const { api, adapter } = useNetwork();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<AdminDelegate[]>([]);
  const [who, setWho] = useState<AdminDelegate | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setPeople([]);
    const t = setTimeout(() => api.admin.findDelegate(q).then((r) => setPeople(r.people), () => {}), 200);
    return () => clearTimeout(t);
  }, [q, api]);
  const run = async (fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    const r = await fn().catch(() => ({ error: "x" }));
    setBusy(false);
    if (r.error) adapter.toast(err(r.error), { tone: "error" });
    else {
      adapter.toast(ok, { tone: "success" });
      setCode("");
      const fresh = await api.admin.findDelegate(q).catch(() => ({ people: [] as AdminDelegate[] }));
      setPeople(fresh.people);
      setWho(fresh.people.find((p) => p.id === who?.id) ?? null);
    }
  };
  return (
    <div className="space-y-4">
      <Field label="Find delegate" hint="Name, email or institute">{(id) => <input id={id} type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />}</Field>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setWho(p)} className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 text-left ${who?.id === p.id ? "border-primary" : ""} ${ui.focus}`}>
              <span><span className="font-semibold">{p.name}</span> <span className="text-sm text-muted-foreground">{p.institute} · {p.email}</span></span>
              <span className="text-sm">{p.card ? `Card ${p.card.printed_code}` : "No card"}</span>
            </button>
          </li>
        ))}
      </ul>
      {who && (
        <Card className="space-y-3 p-4">
          <p className="font-bold">{who.name}</p>
          <p className="text-sm">Ask: "Who should see you: other presenters, all delegates, or only people you meet?" Default is presenters.</p>
          <Field label="Code on back of card">{(id) => <input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6))} className={`${inputClass} font-mono text-xl tracking-[0.3em]`} />}</Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {!who.card || who.card.chip === "virtual" ? (
              <Button disabled={busy || code.length !== 6} onClick={() => run(() => api.admin.bindCard(who.id, code), `Card ${code} linked to ${who.name}.`)}>Bind card</Button>
            ) : (
              <Button disabled={busy || code.length !== 6} onClick={() => run(() => api.admin.swapLostCard(who.id, code), `Old card revoked, ${code} linked.`)}>Lost card: swap to this spare</Button>
            )}
            {who.card && who.card.chip !== "virtual" && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => run(() => api.admin.unbindCard(who.card!.id), "Card unbound.")}>Unbind card</Button>
                <Button variant="danger" disabled={busy} onClick={() => run(() => api.admin.revokeCard(who.card!.id), "Card revoked.")}>Revoke card</Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function csv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}

function CardsPanel() {
  const { api, adapter } = useNetwork();
  const [status, setStatus] = useState("");
  const q = useAsync(() => api.admin.listCards(status || undefined), [status]);
  const importFile = async (f: File) => {
    try {
      const rows = JSON.parse(await f.text());
      const r = await api.admin.importCards(rows);
      adapter.toast(`Imported ${r.inserted} cards, skipped ${r.skipped}.`, { tone: "success" });
      q.reload();
    } catch {
      adapter.toast("That file isn't an import.json from the card-manifest tool.", { tone: "error" });
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="">All cards</option><option value="unbound">Unbound</option><option value="active">Active</option><option value="revoked">Revoked</option>
        </select>
        <Button variant="outline" disabled={!q.data} onClick={() => download("cards.csv", csv([["code", "status", "chip", "batch", "delegate", "bound_at"], ...(q.data?.cards ?? []).map((c) => [c.printed_code, c.status, c.chip, c.batch, c.user_name, c.bound_at])]), "text/csv")}>Export CSV</Button>
        <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 font-semibold ${ui.focus}`}>
          Import cards (import.json)
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      </div>
      {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorNote message="Couldn't load cards." onRetry={q.reload} /> : (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">Batches</caption>
            <thead><tr className="text-left"><th>Batch</th><th>Unbound</th><th>Active</th><th>Revoked</th></tr></thead>
            <tbody>{q.data!.batches.map((b) => <tr key={b.batch ?? "none"} className="border-t"><td>{b.batch ?? "—"}</td><td>{b.unbound}</td><td>{b.active}</td><td>{b.revoked}</td></tr>)}</tbody>
          </table>
          <p className="text-sm text-muted-foreground">{q.data!.cards.length} cards listed.</p>
        </>
      )}
    </div>
  );
}

function ReportsPanel() {
  const { api, adapter } = useNetwork();
  const q = useAsync(() => api.admin.listReports("open"), []);
  const resolve = async (id: string, resolution: string) => {
    const r = await api.admin.resolveReport(id, resolution).catch(() => ({ error: "x" }));
    if (r.error) adapter.toast("Couldn't resolve.", { tone: "error" });
    else q.reload();
  };
  if (q.loading) return <Skeleton className="h-40" />;
  if (q.error) return <ErrorNote message="Couldn't load reports." onRetry={q.reload} />;
  if (!q.data!.reports.length) return <p>No open reports.</p>;
  return (
    <ul className="space-y-3">
      {q.data!.reports.map((r) => (
        <li key={r.id}><Card className="p-4">
          <p className="font-semibold">{r.reported.name} <span className="text-sm font-normal text-muted-foreground">reported by {r.reporter.name} · {new Date(r.created_at).toLocaleString("en-IN")}</span></p>
          <p className="text-sm">Reason: {r.reason}{r.reports_against > 1 ? ` · ${r.reports_against} reports in total` : ""}</p>
          {r.note && <p className="mt-1 text-sm">"{r.note}"</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => resolve(r.id, "no action")}>No action</Button>
            <Button variant="outline" onClick={() => resolve(r.id, "spoke to delegate")}>Spoke to them</Button>
            <Button variant="danger" onClick={() => resolve(r.id, "escalated")}>Escalate</Button>
          </div>
        </Card></li>
      ))}
    </ul>
  );
}

function MetricsPanel({ admin }: { admin: boolean }) {
  const { api, adapter } = useNetwork();
  const q = useAsync(() => api.admin.metrics(), []);
  useEffect(() => {
    const t = setInterval(q.reload, 30000); // K-61: tile updates within 60 s of a tap
    return () => clearInterval(t);
  }, [q.reload]);
  const setFlag = async (k: keyof FeatureFlags, v: boolean) => {
    const r = await api.admin.setFlag(k, v).catch(() => null);
    if (!r) adapter.toast("Flag not changed.", { tone: "error" });
    else q.reload();
  };
  const reminders = async () => {
    const r = await api.admin.exportReminders();
    download("followup-reminders.csv", csv([["name", "email", "connections"], ...r.people.map((p) => [p.name, p.email, p.connections])]), "text/csv");
  };
  if (q.loading && !q.data) return <Skeleton className="h-40" />;
  if (q.error || !q.data) return <ErrorNote message="Couldn't load metrics." onRetry={q.reload} />;
  const m = q.data;
  const tiles: [string, string | number][] = [
    ["Taps (last hour)", m.taps_last_hour], ["Taps total", m.taps_total], ["Connections", m.connections], ["Today", m.connections_today],
    ["Cards activated", m.activations], ["Digital passes", m.digital_passes], ["Profiles complete", `${Math.round(m.completion_rate * 100)}%`],
    ["Map opens", m.map_opens], ["Overlap opens", m.overlap_opens], ["Errors", m.client_errors], ["Rate-limited", m.rate_limited], ["Open reports", m.reports_open],
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([k, v]) => <Card key={k} className="p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-2xl font-bold">{v}</dd></Card>)}
      </dl>
      <p className="text-xs text-muted-foreground">Updated {new Date(m.as_of).toLocaleTimeString("en-IN")}. Refreshes every 30 seconds.</p>
      <Card className="p-4">
        <h2 className="font-bold">Kill switch</h2>
        <p className="text-sm text-muted-foreground">Turns features off for everyone at once, without a deploy. Nothing is deleted.</p>
        <div className="divide-y">
          <Toggle label="Taps and scans" checked={m.flags.tap} disabled={!admin} onChange={(v) => setFlag("tap", v)} />
          <Toggle label="Network map" checked={m.flags.map} disabled={!admin} onChange={(v) => setFlag("map", v)} />
          <Toggle label="Overlap view" checked={m.flags.overlap} disabled={!admin} onChange={(v) => setFlag("overlap", v)} />
          <Toggle label="Digital passes" checked={m.flags.digital_pass} disabled={!admin} onChange={(v) => setFlag("digital_pass", v)} />
        </div>
        {!admin && <p className="text-sm">Only organisers (admin role) can change these.</p>}
      </Card>
      <Button variant="outline" onClick={reminders}>Export follow-up reminder list</Button>
    </div>
  );
}

// Visibility (K-32, PRD 6.3 settings): scope, share-on-tap, friends of friends, discoverable, contact fields.
// Every change appends a consent row server-side and takes effect on the next request. One-tap withdraw.
import { useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { bannerCopy, SCOPE_OPTIONS } from "../lib/format";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import type { ContactField, Settings } from "../types/rpc";
import { BackBar, Button, Card, ErrorNote, Sheet, Skeleton, Toggle } from "../components/ui";

const FIELDS: { key: ContactField; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

export function VisibilitySettings({ onSaved }: { onSaved?: (s: Settings) => void }) {
  const { api, adapter } = useNetwork();
  const q = useAsync(() => api.mySettings(), []);
  const [busy, setBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  if (q.loading) return <Skeleton className="h-80" />;
  if (q.error || !q.data) return <ErrorNote message="We couldn't load your settings." onRetry={q.reload} />;
  const s = q.data;

  const set = async (key: Parameters<typeof api.setConsent>[0], value: Parameters<typeof api.setConsent>[1]) => {
    setBusy(true);
    const before = s;
    q.setData({ ...s, [key]: value } as Settings); // optimistic; reverted below if the server refuses
    try {
      const r = await api.setConsent(key, value);
      if (r.error) {
        q.setData(before);
        adapter.toast("That setting wasn't saved.", { tone: "error" });
      } else {
        q.setData(r);
        onSaved?.(r);
      }
    } catch {
      q.setData(before);
      adapter.toast("That setting wasn't saved. Check your signal.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const toggleField = (f: ContactField) => {
    const next = s.contact_fields.includes(f) ? s.contact_fields.filter((x) => x !== f) : [...s.contact_fields, f];
    set("contact_fields", next);
  };
  const withdraw = async () => {
    const r = await api.withdrawAll().catch(() => ({ error: "x" }));
    setWithdrawOpen(false);
    if (r.error) adapter.toast("Couldn't withdraw. Try again.", { tone: "error" });
    else {
      adapter.toast("Done. Your card link, connections, notes and network profile are removed.", { tone: "success" });
      q.reload();
    }
  };

  return (
    <div className="space-y-6" aria-busy={busy}>
      <p className={`rounded-2xl p-4 ${tag.green}`} data-testid="banner-preview">{bannerCopy(s.visibility_scope)}</p>

      <fieldset>
        <legend className="mb-2 text-lg font-bold">Who can see you</legend>
        <div className="space-y-2">
          {SCOPE_OPTIONS.map((o) => (
            <label key={o.value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${s.visibility_scope === o.value ? "border-primary" : ""}`}>
              <input type="radio" name="net-scope" className="mt-1 h-5 w-5" checked={s.visibility_scope === o.value} onChange={() => set("visibility_scope", o.value)} />
              <span><span className="font-semibold">{o.label}</span><span className="block text-sm text-muted-foreground">{o.help}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Someone you hand your card to always sees your profile, whatever you choose here. Blocking always wins.</p>
      </fieldset>

      <section>
        <h2 className="text-lg font-bold">Optional</h2>
        <div className="divide-y">
          <Toggle label="Share contact on tap" help="Skip the accept step: people who tap your card see the contact fields below." checked={s.share_on_tap} disabled={busy} onChange={(v) => set("share_on_tap", v)} />
          <Toggle label="Show me to friends of friends" help="People two steps away can see you as a dot on their map." checked={s.second_degree} disabled={busy} onChange={(v) => set("second_degree", v)} />
          <Toggle label="Discoverable" help="Count me in Event overlap numbers and suggestions." checked={s.discoverable} disabled={busy} onChange={(v) => set("discoverable", v)} />
        </div>
      </section>

      <fieldset>
        <legend className="text-lg font-bold">Contact details people see after you accept</legend>
        <p className="text-sm text-muted-foreground">This is what you choose to make available. Nobody sees it until you accept a request, or turn on share-on-tap.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={`flex min-h-11 items-center gap-2 rounded-full border px-4 ${s.has_contact?.[f.key] ? "" : "opacity-60"}`}>
              <input type="checkbox" className="h-5 w-5" checked={s.contact_fields.includes(f.key)} disabled={busy} onChange={() => toggleField(f.key)} />
              {f.label}{!s.has_contact?.[f.key] && <span className="text-xs text-muted-foreground">(not on your profile)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <Card className="p-4">
        <h2 className="font-bold">Withdraw from the network</h2>
        <p className="text-sm text-muted-foreground">Removes your card link, connections, notes and network profile for everyone, now. Your conference registration is not affected.</p>
        <Button variant="danger" className="mt-3" onClick={() => setWithdrawOpen(true)}>Withdraw all</Button>
      </Card>
      <p className="text-xs text-muted-foreground">Consent text version {s.consent_version}. Every change is logged with the time. Network data is deleted on 29 Dec 2026.</p>

      <Sheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw all?">
        <p>This removes your card link, every connection, your notes and your network profile. It can't be undone.</p>
        <Button variant="danger" className="mt-4 w-full" onClick={withdraw}>Yes, withdraw everything</Button>
      </Sheet>
    </div>
  );
}

export default function VisibilityScreen() {
  const { adapter } = useNetwork();
  const ready = useRequireAuth(to.visibility());
  return (
    <main className={ui.page}>
      <BackBar onBack={adapter.back} label="Network" />
      <h1 className={`${ui.h1} mt-2`}>Who can see you</h1>
      <div className="mt-4">{ready ? <VisibilitySettings /> : <Skeleton className="h-80" />}</div>
      <p className="mt-6"><button type="button" className={ui.link} onClick={() => adapter.navigate(to.profile())}>Edit your network profile</button></p>
    </main>
  );
}

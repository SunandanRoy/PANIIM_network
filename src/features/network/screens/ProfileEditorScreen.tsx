// Network profile editor (K-30, K-31). Hosts can also embed <ProfileEditor/> in onboarding step 2.
// Name, institute, role, photo and contact values stay in the host profile; this edits the network extension.
import { useEffect, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { OPEN_TO_OPTIONS } from "../lib/format";
import { ui } from "../lib/tokens";
import { to } from "../paths";
import type { Settings, Theme } from "../types/rpc";
import { BackBar, Button, Chip, ErrorNote, Field, Skeleton, inputClass } from "../components/ui";

function TagInput({ id, value, onChange, max, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t) && value.length < max) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-2">
        {value.map((t) => (
          <li key={t}>
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className={`min-h-11 rounded-full border px-3 text-sm ${ui.focus}`} aria-label={`Remove ${t}`}>
              {t} <span aria-hidden>✕</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input id={id} value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} placeholder={placeholder} className={inputClass} disabled={value.length >= max} />
        <Button variant="outline" onClick={add} disabled={!draft.trim() || value.length >= max}>Add</Button>
      </div>
    </div>
  );
}

function completion(s: Draft): number {
  const parts = [!!s.headline, s.theme_ids.length > 0, s.interests.length > 0, s.ask_me_about.length > 0, s.open_to.length > 0, !!(s.ask_text || s.offer_text)];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

interface Draft {
  headline: string; bio: string; ask_text: string; offer_text: string;
  interests: string[]; ask_me_about: string[]; open_to: string[]; theme_ids: number[];
}

const fromSettings = (s: Settings): Draft => ({
  headline: s.headline ?? "", bio: s.bio ?? "", ask_text: s.ask_text ?? "", offer_text: s.offer_text ?? "",
  interests: s.interests, ask_me_about: s.ask_me_about, open_to: s.open_to, theme_ids: s.themes.map((t) => t.id),
});

export function ProfileEditor({ onSaved }: { onSaved?: () => void }) {
  const { api, adapter } = useNetwork();
  const settings = useAsync(() => api.mySettings(), []);
  const themes = useAsync(() => api.themes(), []);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings.data && !d) setD(fromSettings(settings.data));
  }, [settings.data, d]);

  if (settings.loading || themes.loading || !d) return settings.error ? <ErrorNote message="We couldn't load your profile." onRetry={settings.reload} /> : <Skeleton className="h-96" />;
  if (!settings.data?.registered) return <p>Your conference registration isn't linked yet, so there's nothing to edit here. Ask the desk.</p>;

  const pct = completion(d);
  const toggleTheme = (t: Theme) => {
    if (d.theme_ids.includes(t.id)) setD({ ...d, theme_ids: d.theme_ids.filter((x) => x !== t.id) });
    else if (d.theme_ids.length < 3) setD({ ...d, theme_ids: [...d.theme_ids, t.id] });
    else adapter.toast("Three themes is the maximum.");
  };
  const save = async () => {
    setBusy(true);
    const r = await api.updateProfileExt({ ...d, headline: d.headline || null, bio: d.bio || null, ask_text: d.ask_text || null, offer_text: d.offer_text || null }).catch(() => ({ error: "x" }) as { error: string });
    setBusy(false);
    if ("error" in r && r.error) adapter.toast(r.error === "invalid" ? "Something is too long. Check the limits." : "Not saved. Try again.", { tone: "error" });
    else {
      adapter.toast("Profile saved.", { tone: "success" });
      onSaved?.();
    }
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div>
        <div className="flex justify-between text-sm"><span className="font-semibold">Profile completion</span><span>{pct}%</span></div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion" className="mt-1 h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Field label="Headline" hint={`${d.headline.length}/80. One line people see first.`}>
        {(id) => <input id={id} maxLength={80} value={d.headline} onChange={(e) => setD({ ...d, headline: e.target.value })} className={inputClass} />}
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold">Themes (up to 3, first is your colour on the map)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(themes.data ?? []).map((t) => {
            const idx = d.theme_ids.indexOf(t.id);
            return <Chip key={t.id} active={idx >= 0} colour={t.colour} onClick={() => toggleTheme(t)}>{idx >= 0 ? `${idx + 1}. ` : ""}{t.label}</Chip>;
          })}
        </div>
      </fieldset>
      <Field label="Interests" hint="Up to 12. Used for similarity on the map.">{(id) => <TagInput id={id} value={d.interests} max={12} onChange={(v) => setD({ ...d, interests: v })} placeholder="For example: field surveys" />}</Field>
      <Field label="Ask me about" hint="Up to 12.">{(id) => <TagInput id={id} value={d.ask_me_about} max={12} onChange={(v) => setD({ ...d, ask_me_about: v })} placeholder="For example: MSME operations" />}</Field>
      <fieldset>
        <legend className="text-sm font-semibold">Open to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPEN_TO_OPTIONS.map((o) => <Chip key={o} active={d.open_to.includes(o)} onClick={() => setD({ ...d, open_to: d.open_to.includes(o) ? d.open_to.filter((x) => x !== o) : [...d.open_to, o] })}>{o}</Chip>)}
        </div>
      </fieldset>
      <Field label="Short bio" hint={`${d.bio.length}/280`}>{(id) => <textarea id={id} maxLength={280} value={d.bio} onChange={(e) => setD({ ...d, bio: e.target.value })} className={`${inputClass} min-h-20 py-2`} />}</Field>
      <Field label="An ask" hint={`${d.ask_text.length}/140. Shown as a badge.`}>{(id) => <input id={id} maxLength={140} value={d.ask_text} onChange={(e) => setD({ ...d, ask_text: e.target.value })} className={inputClass} />}</Field>
      <Field label="An offer" hint={`${d.offer_text.length}/140. Shown as a badge.`}>{(id) => <input id={id} maxLength={140} value={d.offer_text} onChange={(e) => setD({ ...d, offer_text: e.target.value })} className={inputClass} />}</Field>
      <p className="text-sm text-muted-foreground">Name, institute, role and photo come from your conference profile.</p>
      <Button type="submit" className="w-full" disabled={busy}>Save profile</Button>
    </form>
  );
}

export default function ProfileEditorScreen() {
  const { adapter } = useNetwork();
  const ready = useRequireAuth(to.profile());
  return (
    <main className={ui.page}>
      <BackBar onBack={adapter.back} label="Network" />
      <h1 className={`${ui.h1} mt-2`}>Your network profile</h1>
      <div className="mt-4">{ready ? <ProfileEditor /> : <Skeleton className="h-96" />}</div>
    </main>
  );
}

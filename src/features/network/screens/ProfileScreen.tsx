// One profile screen for tap, search, session-mates, connections and the map (K-34, wireframe page 2).
// Constellation extras sit under the header: mutual connections, path to me, shared sessions, private note.
import { useEffect, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { firstName, OPEN_TO_OPTIONS, roleLine, sessionLine } from "../lib/format";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import type { ProfileDetail } from "../types/rpc";
import { PrivacyFooter, ReportBlockSheet, ThemeTags } from "../components/person";
import { Avatar, BackBar, Button, Card, ErrorNote, Eyebrow, Sheet, Skeleton, Tag, inputClass } from "../components/ui";

export interface ProfileScreenProps {
  personId: string;
  /** Side-panel mode beside the map on desktop: no back bar, a close button instead. */
  onClose?: () => void;
}

export default function ProfileScreen({ personId, onClose }: ProfileScreenProps) {
  const { api, adapter, user, userLoaded } = useNetwork();
  const q = useAsync(() => api.profileDetail(personId), [personId, user?.id], userLoaded && !!user);

  const needsAuth = userLoaded && !user;
  useEffect(() => {
    if (needsAuth) adapter.requireAuth(to.person(personId));
  }, [needsAuth, adapter, personId]);
  if (needsAuth) return null;
  const wrap = (children: React.ReactNode) => (
    <main className={onClose ? "px-4 pb-10 pt-2" : ui.page}>
      {onClose ? <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div> : <BackBar onBack={adapter.back} />}
      {children}
    </main>
  );
  if (!userLoaded || q.loading) {
    return wrap(
      <div className="mt-4 flex flex-col items-center gap-3" role="status" aria-label="Loading profile">
        <Skeleton className="h-28 w-28 rounded-full" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-12 w-full" />
      </div>,
    );
  }
  if (q.error) return wrap(<div className="mt-4"><ErrorNote message="We couldn't load this profile." onRetry={q.reload} /></div>);
  if (!q.data) {
    return wrap(
      <section className="mt-6">
        <h1 className={ui.h2}>This profile isn't available.</h1>
        <p className="mt-2 text-muted-foreground">The person may have limited who can see them.</p>
      </section>,
    );
  }
  return wrap(<ProfileBody detail={q.data} reload={q.reload} />);
}

function ProfileBody({ detail, reload }: { detail: ProfileDetail; reload: () => void }) {
  const { api, adapter } = useNetwork();
  const p = detail.person;
  const r = detail.relation;
  const self = !!r.self;
  const name = firstName(p.name);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [gone, setGone] = useState(false);
  const accepted = !!r.contact_granted_to_me;
  const connected = r.connection === "connected";

  if (gone) {
    return <p className="mt-6" role="status">{name} is hidden. You won't see each other in the network.</p>;
  }

  const act = async (fn: () => Promise<{ error?: string }>, ok: string) => {
    setMenu(false);
    const res = await fn().catch(() => ({ error: "x" }));
    if (res.error) adapter.toast("That didn't work. Try again.", { tone: "error" });
    else {
      adapter.toast(ok, { tone: "success" });
      reload();
    }
  };

  return (
    <article className="pb-6">
      <div className="flex justify-end">
        {!self && (
          <button type="button" aria-label="More actions" aria-haspopup="dialog" onClick={() => setMenu(true)} className={`-mt-11 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-accent ${ui.focus}`}>
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        )}
      </div>
      <header className="flex flex-col items-center text-center">
        <Avatar name={p.name} photo={p.photo_url} id={p.id} size={112} />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{p.name}</h1>
        <p className="mt-1 text-muted-foreground">{roleLine(p.role_label, p.institute)}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {detail.shared_sessions?.some((s) => s.startsWith("Same session")) && <Tag tone={tag.green}>In your session{p.session_id ? ` · ${p.session_id}` : ""}</Tag>}
          {connected && <Tag tone="bg-foreground text-background">✓ Connected</Tag>}
        </div>
      </header>

      {!self && (
        <div className="mt-5 space-y-3">
          <Button className="w-full" onClick={() => adapter.openCoffeeRequest(p.id, p.name)}>☕ Request a 15-min coffee</Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => adapter.onFollow(p.id)}>Follow</Button>
            <Button variant="outline" onClick={() => adapter.openAskThread(p.id, p.name)}>Ask a question</Button>
            <Button variant="outline" onClick={() => adapter.onSave(p.id)}>Save</Button>
          </div>
        </div>
      )}

      {!self && <NetworkExtras detail={detail} />}

      {p.paper_title && (
        <Card className="mt-6 p-5">
          <Eyebrow>Presenting</Eyebrow>
          <h2 className="mt-2 text-xl font-bold">{p.paper_title}</h2>
          {(p.session_start || p.session_title) && <p className="mt-2 text-sm">🕑 {sessionLine(p.session_start, p.session_title)}</p>}
          {p.room && (
            <p className="mt-1 text-sm">
              📍 Room {p.room}
              {adapter.openVenueMap && <> · <button type="button" className={ui.link} onClick={() => adapter.openVenueMap?.(p.room!)}>Show on map</button></>}
            </p>
          )}
          {p.key_finding && (
            <div className="mt-4 rounded-xl bg-muted p-3">
              <p className="text-sm font-semibold text-muted-foreground">Key finding, in one line</p>
              <p>{p.key_finding}</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {p.paper_url && <a className={ui.link} href={p.paper_url} target="_blank" rel="noreferrer noopener">Read abstract</a>}
            {p.slides_url && <a className={ui.link} href={p.slides_url} target="_blank" rel="noreferrer noopener">Download slides (PDF)</a>}
          </div>
        </Card>
      )}

      {!p.paper_title && p.headline && <p className="mt-6 text-center">{p.headline}</p>}
      {p.bio && <p className="mt-4">{p.bio}</p>}

      {(p.themes?.length ?? 0) > 0 && (
        <section className="mt-6"><h2 className="mb-2 text-lg font-bold">Themes</h2><ThemeTags themes={p.themes} /></section>
      )}

      {(p.ask_me_about?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Ask me about</h2>
          <ul className="flex flex-wrap gap-2">{p.ask_me_about!.map((t) => <li key={t} className="rounded-full border bg-card px-4 py-2">{t}</li>)}</ul>
        </section>
      )}

      {p.open_to && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Open to</h2>
          <ul className="grid grid-cols-2 gap-2">
            {[...OPEN_TO_OPTIONS, ...p.open_to.filter((x) => !OPEN_TO_OPTIONS.includes(x))].map((o) => {
              const yes = p.open_to!.includes(o);
              return (
                <li key={o} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 ${yes ? tag.green : "bg-card text-muted-foreground"}`}>
                  <span aria-hidden>{yes ? "✓" : "✕"}</span>
                  <span>{o}<span className="sr-only">{yes ? ": yes" : ": no"}</span></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(p.ask_text || p.offer_text) && (
        <section className="mt-6 space-y-2" aria-label="Asks and offers">
          {p.ask_text && <p><Tag tone={tag.tan}>Ask</Tag> <span className="ml-2">{p.ask_text}</span></p>}
          {p.offer_text && <p><Tag tone={tag.green}>Offer</Tag> <span className="ml-2">{p.offer_text}</span></p>}
        </section>
      )}

      {adapter.renderProfileExtras && <div className="mt-6">{adapter.renderProfileExtras(p.id)}</div>}

      {p.contact && (
        <Card className="mt-6 p-5">
          <Eyebrow>Contact</Eyebrow>
          <dl className="mt-2 space-y-2">
            {p.contact.email && <div><dt className="text-sm text-muted-foreground">Email</dt><dd><a className={ui.link} href={`mailto:${p.contact.email}`}>{p.contact.email}</a></dd></div>}
            {p.contact.phone && <div><dt className="text-sm text-muted-foreground">Phone</dt><dd><a className={ui.link} href={`tel:${p.contact.phone}`}>{p.contact.phone}</a></dd></div>}
            {p.contact.linkedin && <div><dt className="text-sm text-muted-foreground">LinkedIn</dt><dd><a className={ui.link} href={p.contact.linkedin} target="_blank" rel="noreferrer noopener">{p.contact.linkedin}</a></dd></div>}
          </dl>
        </Card>
      )}

      {self ? (
        <p className="mt-6 text-sm text-muted-foreground">This is how you appear to people you've met. <button type="button" className={ui.link} onClick={() => adapter.navigate(to.visibility())}>Who can see me</button></p>
      ) : (
        <PrivacyFooter name={p.name} accepted={accepted} onReport={() => setReport(true)} />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={p.name}>
        <div className="flex flex-col gap-2">
          {r.i_shared_contact ? (
            <Button variant="outline" onClick={() => act(() => api.revokeContact(p.id), `${name} can no longer see your contact details.`)}>Stop sharing my contact</Button>
          ) : (
            <Button variant="outline" onClick={() => act(() => api.grantContact(p.id, "manual"), `${name} can now see your contact details.`)}>Share my contact with {name}</Button>
          )}
          <Button variant="outline" onClick={() => { setMenu(false); adapter.navigate(to.map({ focus: p.id })); }}>Show on network map</Button>
          {connected && <Button variant="outline" onClick={() => act(() => api.removeConnection(p.id), `Removed. ${name} is not told.`)}>Remove connection</Button>}
          <Button variant="danger" onClick={() => { setMenu(false); setReport(true); }}>Report or block</Button>
        </div>
      </Sheet>
      <ReportBlockSheet open={report} onClose={() => setReport(false)} personId={p.id} name={name} onBlocked={() => setGone(true)} />
    </article>
  );
}

function NetworkExtras({ detail }: { detail: ProfileDetail }) {
  const { adapter } = useNetwork();
  const m = detail.mutual;
  const path = detail.path_to_me;
  const shared = (detail.shared_sessions ?? []).filter((s) => !s.startsWith("Same session"));
  return (
    <section className="mt-6 space-y-4" aria-label="How you're connected">
      {m && m.count > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Mutual connections</h2>
          {m.people?.length ? (
            <p className="mt-1">
              {m.people.map((x, i) => (
                <span key={x.id}>{i > 0 && ", "}<button type="button" className={ui.link} onClick={() => adapter.navigate(to.person(x.id))}>{x.name}</button></span>
              ))}
            </p>
          ) : (
            <p className="mt-1">{m.count === 1 ? "1 mutual connection" : `${m.count} mutual connections`}</p>
          )}
        </div>
      )}
      {path && path.length > 2 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Path to you</h2>
          <ol className="mt-1 flex flex-wrap items-center gap-1" aria-label="Path from you">
            {path.map((h, i) => (
              <li key={h.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
                {i === 0 ? <span className="font-semibold">You</span> : <button type="button" className={ui.link} onClick={() => adapter.navigate(to.person(h.id))}>{h.name}</button>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {shared.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Shared</h2>
          <ul className="mt-1 list-disc pl-5">{shared.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      <PrivateNote personId={detail.person.id} initial={detail.note ?? ""} />
    </section>
  );
}

function PrivateNote({ personId, initial }: { personId: string; initial: string }) {
  const { api, adapter } = useNetwork();
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await api.setNote(personId, body).catch(() => ({ error: "x" }));
    setBusy(false);
    if (r.error) adapter.toast("Note not saved.", { tone: "error" });
    else setSaved(body);
  };
  return (
    <div>
      <label htmlFor={`note-${personId}`} className="text-sm font-semibold text-muted-foreground">Private note (only you see this)</label>
      <textarea id={`note-${personId}`} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="For example: send her my questionnaire draft" className={`${inputClass} mt-1 min-h-16 py-2`} />
      {body !== saved && <Button variant="outline" className="mt-2" disabled={busy} onClick={save}>Save note</Button>}
    </div>
  );
}

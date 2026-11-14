// /t/:token (K-21, K-23, K-24, K-29). Opening the URL never writes to the graph: the connection is made by an
// authenticated call after the profile has rendered, with an 8-second undo (PRD 5.2).
import { useEffect, useRef, useState } from "react";
import { useNetwork } from "../adapter/context";
import { useAsync } from "../hooks/useAsync";
import { isOffline } from "../lib/api";
import { firstName, roleLine, sessionLine, SCOPE_OPTIONS } from "../lib/format";
import { normaliseRef } from "../lib/ref";
import { enqueueConnect } from "../lib/retryQueue";
import { tag, ui } from "../lib/tokens";
import { to } from "../paths";
import type { Scope, TapProfile } from "../types/rpc";
import { MutualTag, PrivacyFooter, ReportBlockSheet, UndoBar } from "../components/person";
import { Avatar, Button, Card, Eyebrow, Skeleton, Tag, inputClass } from "../components/ui";

export interface TapScreenProps {
  token: string;
  source?: "tap" | "scan";
}

export default function TapScreen({ token, source = "tap" }: TapScreenProps) {
  const { api, user, userLoaded } = useNetwork();
  const ref = normaliseRef(token);
  const signedOut = userLoaded && !user;

  const anon = useAsync(() => api.resolveToken(ref), [ref], signedOut);
  const prof = useAsync(() => api.profileByToken(ref), [ref, user?.id], userLoaded && !!user);

  if (!userLoaded || (signedOut ? anon.loading : prof.loading)) return <TapSkeleton />;
  if (signedOut) return <SignedOut state={anon.data?.state ?? "unknown"} returnTo={to.tap(ref, source === "scan" ? "scan" : undefined)} />;
  if (prof.error) {
    return (
      <Shell>
        <Message title="We couldn't load this pass." body={prof.error.kind === "offline" ? "You're offline. Check your signal and try again." : "Please try again."}>
          <Button onClick={prof.reload}>Try again</Button>
        </Message>
      </Shell>
    );
  }
  const data = prof.data ?? { state: "unknown" };
  switch (data.state) {
    case "active":
      return <ActiveCard token={ref} source={source} data={data} />;
    case "unbound":
      return <Activation token={ref} onDone={prof.reload} />;
    case "self":
      return <SelfTap />;
    default:
      return <StateMessage state={data.state} />;
  }
}

function Shell({ children, eyebrow = "PAN-IIM WMC 2026" }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <main className={ui.page}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-4 space-y-4">{children}</div>
    </main>
  );
}

function Message({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section aria-live="polite">
      <h1 className={ui.h1}>{title}</h1>
      {body && <p className="mt-2 text-muted-foreground">{body}</p>}
      {children && <div className="mt-6 flex flex-col gap-3">{children}</div>}
    </section>
  );
}

function TapSkeleton() {
  return (
    <Shell eyebrow="PAN-IIM WMC 2026 · YOU TAPPED A PASS">
      <span className="sr-only" role="status">Loading pass</span>
      <Card className="space-y-3 p-5">
        <div className="flex gap-4"><Skeleton className="h-20 w-20 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /></div></div>
        <Skeleton className="h-16" />
      </Card>
      <Skeleton className="h-12" />
    </Shell>
  );
}

export function StateMessage({ state }: { state: TapProfile["state"] }) {
  const { adapter } = useNetwork();
  if (state === "revoked") {
    return <Shell><Message title="This pass was replaced." body="Ask the desk." /></Shell>;
  }
  if (state === "paused") {
    return <Shell><Message title="Taps are paused for a moment." body="Nothing was recorded. Try again in a few minutes." /></Shell>;
  }
  if (state === "limited") {
    return <Shell><Message title="That's a lot of taps." body="Wait a minute, then try again." /></Shell>;
  }
  return (
    <Shell>
      <Message title="We couldn't read this pass." body="Try scanning the QR code on the card, or type the 6-character code.">
        <Button onClick={() => adapter.navigate(to.scan())}>Scan a pass</Button>
      </Message>
    </Shell>
  );
}

function SignedOut({ state, returnTo }: { state: TapProfile["state"]; returnTo: string }) {
  const { adapter } = useNetwork();
  if (state !== "active" && state !== "unbound") return <StateMessage state={state} />;
  return (
    <Shell eyebrow="PAN-IIM WMC 2026 · YOU TAPPED A PASS">
      <Message
        title={state === "unbound" ? "Activate your pass" : "Sign in to see who this is"}
        body={state === "unbound" ? "Sign in first, then link this card to you." : "You'll come straight back to this person after signing in."}
      >
        <Button onClick={() => adapter.requireAuth(returnTo)}>Sign in</Button>
      </Message>
      <p className="text-sm text-muted-foreground">Contact details are never shared by a tap alone.</p>
    </Shell>
  );
}

function SelfTap() {
  const { adapter } = useNetwork();
  return (
    <Shell>
      <Message title="This is your pass." body="When someone taps it, they see your profile and you're connected. Your contact details stay hidden until you accept.">
        <Button onClick={() => adapter.navigate(to.pass())}>Show my pass</Button>
        <Button variant="outline" onClick={() => adapter.navigate(to.visibility())}>Who can see me</Button>
      </Message>
    </Shell>
  );
}

type ConnState = "connecting" | "undo" | "connected" | "undone" | "queued" | "failed";

function ActiveCard({ token, source, data }: { token: string; source: "tap" | "scan"; data: TapProfile }) {
  const { api, adapter } = useNetwork();
  const p = data.person!;
  const already = data.connection?.state === "connected";
  const [conn, setConn] = useState<ConnState>(already ? "connected" : "connecting");
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const started = useRef(false);
  const name = firstName(p.name);

  // Connect after first render, once.
  useEffect(() => {
    if (already || started.current) return;
    started.current = true;
    (async () => {
      const live = await adapter.getLiveSession().catch(() => null);
      try {
        const r = await api.connectViaCard(token, source, live?.id ?? null, live?.title ?? null);
        if (r.created) {
          setConn("undo");
          adapter.onConnectionCreated(p.id, source);
          adapter.analytics("network_connect", { source });
        } else if (r.error) setConn("failed");
        else setConn("connected");
      } catch (e) {
        if (isOffline(e)) {
          enqueueConnect({ token, source, sessionId: live?.id ?? null });
          setConn("queued");
        } else setConn("failed");
      }
    })();
  }, [already, api, adapter, token, source, p.id]);

  const undo = async () => {
    const r = await api.undoConnection(p.id).catch(() => ({ error: "expired" }));
    if (r.error) adapter.toast("Too late to undo. You can remove the connection from their profile.", { tone: "error" });
    else setConn("undone");
  };

  if (blocked) return <StateMessage state="unknown" />;

  return (
    <Shell eyebrow={`PAN-IIM WMC 2026 · ${source === "scan" ? "YOU SCANNED A PASS" : "YOU TAPPED A PASS"}`}>
      <Card className="p-5" data-testid="tap-card">
        <div className="flex items-start gap-4">
          <Avatar name={p.name} photo={p.photo_url} id={p.id} size={76} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{p.name}</h1>
            <p className="text-muted-foreground">{roleLine(p.role_label, p.institute)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.in_your_session && <Tag tone={tag.green}>In your session{p.session_id ? ` · ${p.session_id}` : ""}</Tag>}
          <MutualTag count={data.mutual_count ?? 0} />
          {conn === "connected" && <Tag tone="bg-foreground text-background">✓ Connected</Tag>}
        </div>
        {p.paper_title && (
          <div className="mt-4">
            <p className="font-bold">Presenting</p>
            <p>{[p.paper_title, sessionLine(p.session_start, null), p.room && `Room ${p.room}`].filter(Boolean).join(" · ")}</p>
          </div>
        )}
        {!p.paper_title && p.headline && <p className="mt-4">{p.headline}</p>}
        {(p.ask_me_about?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">{p.ask_me_about!.slice(0, 4).map((t) => <Tag key={t} tone={tag.lavender}>{t}</Tag>)}</div>
        )}
        {p.contact && (
          <dl className="mt-4 space-y-1 rounded-xl bg-muted p-3 text-sm" aria-label="Contact details">
            {p.contact.email && <div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a className={ui.link} href={`mailto:${p.contact.email}`}>{p.contact.email}</a></dd></div>}
            {p.contact.phone && <div><dt className="inline font-semibold">Phone: </dt><dd className="inline"><a className={ui.link} href={`tel:${p.contact.phone}`}>{p.contact.phone}</a></dd></div>}
            {p.contact.linkedin && <div><dt className="inline font-semibold">LinkedIn: </dt><dd className="inline"><a className={ui.link} href={p.contact.linkedin} rel="noreferrer noopener" target="_blank">Profile</a></dd></div>}
          </dl>
        )}
      </Card>

      {conn === "undo" && <UndoBar name={name} onUndo={undo} onExpire={() => setConn("connected")} />}
      {conn === "undone" && <p role="status" className="rounded-xl border p-3 text-sm">Not connected. Nothing was shared.</p>}
      {conn === "queued" && <p role="status" className="rounded-xl border p-3 text-sm">You're offline. We'll connect you with {name} when you're back online.</p>}
      {conn === "failed" && <p role="status" className="rounded-xl border p-3 text-sm">We couldn't save the connection. You can still request a coffee.</p>}

      <Button className="w-full" onClick={() => adapter.openCoffeeRequest(p.id, p.name)}>Request a 15-min coffee</Button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => adapter.navigate(to.person(p.id))}>Full profile</Button>
        <Button variant="outline" onClick={() => adapter.navigate(to.map({ focus: p.id }))}>Show on map</Button>
      </div>
      <PrivacyFooter name={p.name} accepted={!!p.contact} onReport={() => setReportOpen(true)} />
      <ReportBlockSheet open={reportOpen} onClose={() => setReportOpen(false)} personId={p.id} name={name} onBlocked={() => setBlocked(true)} />
    </Shell>
  );
}

/** Unbound card: printed code + visibility choice, then link (K-24). */
export function Activation({ token, onDone }: { token?: string; onDone: () => void }) {
  const { api, adapter } = useNetwork();
  const [code, setCode] = useState("");
  const [scope, setScope] = useState<Scope>("presenters");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.activateCard(code, scope, token ?? null);
      if (r.ok) {
        adapter.toast("Your pass is linked. People who tap it will see your profile.", { tone: "success" });
        onDone();
      } else {
        setErr(
          r.error === "bad_code" ? "That code doesn't match this card. Check the back of the card." :
          r.error === "already_active" ? "You already have an active pass. Report it lost at the desk first." :
          r.error === "limited" ? "Too many tries. Wait an hour or ask the desk." : "Couldn't link the pass. Ask the desk.",
        );
      }
    } catch {
      setErr("Couldn't link the pass. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <h1 className={ui.h1}>Activate your pass</h1>
      <p className="text-muted-foreground">This card isn't linked to anyone yet. Enter the 6-character code printed on the back to link it to you.</p>
      <form onSubmit={submit} className="space-y-4">
        <Card className="p-5 text-center">
          <label htmlFor="net-code" className={ui.eyebrow}>Code on back of card</label>
          <input
            id="net-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6))}
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            placeholder="K7QX2M"
            aria-describedby={err ? "net-code-err" : undefined}
            className={`${inputClass} mt-2 text-center font-mono text-3xl tracking-[0.4em]`}
          />
          {err && <p id="net-code-err" role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
        </Card>
        <fieldset className={`rounded-2xl p-4 ${tag.green}`}>
          <legend className="sr-only">Who can see you</legend>
          <p className="font-bold">You choose who can see you</p>
          <p className="text-sm">Contact details stay hidden until you accept.</p>
          <div className="mt-3 space-y-1">
            {SCOPE_OPTIONS.map((o) => (
              <label key={o.value} className="flex min-h-11 items-center gap-3">
                <input type="radio" name="scope" value={o.value} checked={scope === o.value} onChange={() => setScope(o.value)} className="h-5 w-5" />
                <span><span className="font-semibold">{o.label}</span><span className="block text-xs">{o.help}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Link this pass to me</Button>
      </form>
    </Shell>
  );
}

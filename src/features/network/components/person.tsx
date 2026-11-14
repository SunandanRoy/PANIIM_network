import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNetwork } from "../adapter/context";
import { usePrefersReducedMotion } from "../hooks/useAsync";
import { privacyLine, roleLine } from "../lib/format";
import { tag, ui } from "../lib/tokens";
import type { ListItem, Theme } from "../types/rpc";
import { Avatar, Button, Sheet, Tag, inputClass } from "./ui";

/** The wireframe's footer line plus "Report or block". Appears on every profile state. */
export function PrivacyFooter({ name, accepted, onReport }: { name: string; accepted: boolean; onReport?: () => void }) {
  return (
    <p className="mt-6 text-sm text-muted-foreground" data-testid="privacy-footer">
      {privacyLine(name, accepted)}{" "}
      {onReport && (
        <button type="button" onClick={onReport} className={`${ui.link} text-muted-foreground`}>
          Report or block
        </button>
      )}
    </p>
  );
}

export function ThemeTags({ themes }: { themes: Theme[] }) {
  if (!themes.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Themes">
      {themes.map((t) => (
        <li key={t.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.colour }} />
          {t.label}
        </li>
      ))}
    </ul>
  );
}

/** 8-second undo bar after a tap connects (PRD 5.2). Reduced motion: countdown text, no animation. */
export function UndoBar({ name, seconds = 8, onUndo, onExpire }: { name: string; seconds?: number; onUndo: () => void; onExpire: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const remain = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain === 0) {
        clearInterval(t);
        expire.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [seconds]);
  return (
    <div role="status" className="overflow-hidden rounded-xl bg-foreground text-background" data-testid="undo-bar">
      <div className="flex min-h-12 items-center justify-between gap-3 px-4">
        <span className="font-medium">✓ Connected with {name}</span>
        <button type="button" onClick={onUndo} className={`min-h-11 px-2 font-semibold underline underline-offset-4 ${ui.focus}`}>
          Undo{reduced ? ` (${left}s)` : ""}
        </button>
      </div>
      {!reduced && (
        <div className="h-1 bg-background/20">
          <div className="h-1 bg-primary" style={{ width: `${(left / seconds) * 100}%`, transition: "width 250ms linear" }} />
        </div>
      )}
    </div>
  );
}

const REASONS = [
  { value: "spam", label: "Spam or unwanted contact" },
  { value: "inappropriate", label: "Inappropriate behaviour" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "other", label: "Something else" },
] as const;

/** Report or block (K-81). Blocking hides both people from each other everywhere; nobody is told. */
export function ReportBlockSheet({ open, onClose, personId, name, onBlocked }: {
  open: boolean; onClose: () => void; personId: string; name: string; onBlocked?: () => void;
}) {
  const { api, adapter } = useNetwork();
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const report = async (alsoBlock: boolean) => {
    setBusy(true);
    try {
      const r = await api.reportUser(personId, reason, note || undefined);
      if (r.error) adapter.toast(r.error === "limited" ? "Too many reports in an hour. Try later." : "Could not send the report.", { tone: "error" });
      else {
        if (alsoBlock) await api.blockUser(personId);
        adapter.toast(alsoBlock ? `Reported and blocked. ${name} can no longer see you.` : "Thanks. The organisers will review it.", { tone: "success" });
        onClose();
        if (alsoBlock) onBlocked?.();
      }
    } catch {
      adapter.toast("Could not send the report.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const block = async () => {
    setBusy(true);
    try {
      await api.blockUser(personId);
      adapter.toast(`Blocked. You and ${name} no longer see each other.`, { tone: "success" });
      onClose();
      onBlocked?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Report or block">
      <div className="space-y-5">
        <section>
          <h3 className="font-semibold">Block {name}</h3>
          <p className="text-sm text-muted-foreground">You disappear from each other's map, overlap, search and pass taps. Any connection is removed. {name} is not told.</p>
          <Button variant="danger" className="mt-3 w-full" disabled={busy} onClick={block}>Block {name}</Button>
        </section>
        <section className="space-y-3 border-t pt-5">
          <h3 className="font-semibold">Report to the organisers</h3>
          <fieldset className="space-y-1">
            <legend className="sr-only">Reason</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-accent">
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea aria-label="Optional note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps (optional)" className={`${inputClass} min-h-20 py-2`} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={busy} onClick={() => report(false)}>Send report</Button>
            <Button variant="danger" disabled={busy} onClick={() => report(true)}>Report and block</Button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

export function PersonRow({ item, onOpen, trailing }: { item: Pick<ListItem, "id" | "name" | "institute" | "role_label" | "photo_url" | "paper_title" | "headline">; onOpen: () => void; trailing?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <Avatar name={item.name} photo={item.photo_url} id={item.id} />
      <button type="button" onClick={onOpen} className={`min-h-11 flex-1 text-left ${ui.focus} rounded-lg`}>
        <span className="block font-bold">{item.name}</span>
        <span className="block text-sm text-muted-foreground">{roleLine(item.role_label, item.institute)}</span>
        {(item.paper_title || item.headline) && <span className="block text-sm">{item.paper_title ?? item.headline}</span>}
      </button>
      {trailing}
    </li>
  );
}

export function MutualTag({ count }: { count: number }) {
  if (!count) return null;
  return <Tag tone={tag.tan}>{count === 1 ? "1 mutual connection" : `${count} mutual connections`}</Tag>;
}

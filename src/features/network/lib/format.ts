import type { Scope } from "../types/rpc";

const TITLES = /^(dr|prof|professor|mr|mrs|ms|mx)\.?\s+/i;

export function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim().replace(TITLES, "");
  return n.split(/\s+/)[0] || "this person";
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().replace(TITLES, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Visibility banner copy, wireframe page 1 plus PRD 5.1 item 2. */
export function bannerCopy(scope: Scope): string {
  const who = scope === "presenters" ? "You're visible to other presenters." : scope === "all" ? "You're visible to all delegates." : "You're visible only to people you've met.";
  return `${who} Contact details stay hidden until you accept.`;
}

export const SCOPE_OPTIONS: { value: Scope; label: string; help: string }[] = [
  { value: "presenters", label: "Other presenters", help: "Delegates with a paper on the programme, and people you've met." },
  { value: "all", label: "All delegates", help: "Everyone registered for the conference." },
  { value: "met", label: "Only people I've met", help: "People you tapped, scanned or had coffee with." },
];

/** Wireframe privacy footer. Present on every profile state. */
export function privacyLine(name: string, accepted: boolean): string {
  const f = firstName(name);
  return accepted
    ? `${f} accepted, so their contact details are shown.`
    : `Email and phone are shared only after ${f} accepts a request.`;
}

export function roleLine(role: string | null | undefined, institute: string | null | undefined): string {
  return [role, institute].filter(Boolean).join(" · ");
}

export function sessionLine(start: string | null | undefined, title: string | null | undefined): string {
  if (!start) return title ?? "";
  const d = new Date(start);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  return [`${day}, ${time}`, title].filter(Boolean).join(" · ");
}

export function sourceLabel(source: string, context: string | null, at: string): string {
  const d = new Date(at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const what: Record<string, string> = {
    tap: "Tapped", scan: "Scanned", coffee: "Coffee", circle: "Research circle", office_hours: "Office hours", table: "Table",
  };
  return [what[source] ?? source, context, d].filter(Boolean).join(" · ");
}

export const OPEN_TO_OPTIONS = ["Co-authoring", "Mentoring PhDs", "Industry projects", "Reviewing drafts"];

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

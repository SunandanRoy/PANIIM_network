import type { ConnectionRow } from "../types/rpc";

/** Only accepted connections carry contact details; export includes only those (K-83, E1). */
export function acceptedOnly(rows: ConnectionRow[]): ConnectionRow[] {
  return rows.filter((r) => r.contact_granted_to_me && r.person.contact);
}

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: ConnectionRow[]): string {
  const head = ["Name", "Institute", "Role", "Email", "Phone", "LinkedIn", "Met", "Note"];
  const lines = acceptedOnly(rows).map((r) =>
    [r.person.name, r.person.institute, r.person.role_label, r.person.contact?.email, r.person.contact?.phone,
      r.person.contact?.linkedin, r.created_at.slice(0, 10), r.note].map(csvCell).join(","),
  );
  return [head.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}

function vEsc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function toVcard(rows: ConnectionRow[]): string {
  return acceptedOnly(rows)
    .map((r) => {
      const p = r.person;
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEsc(p.name)}`];
      if (p.institute) lines.push(`ORG:${vEsc(p.institute)}`);
      if (p.role_label) lines.push(`TITLE:${vEsc(p.role_label)}`);
      if (p.contact?.email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(p.contact.email)}`);
      if (p.contact?.phone) lines.push(`TEL;TYPE=CELL:${vEsc(p.contact.phone)}`);
      if (p.contact?.linkedin) lines.push(`URL:${vEsc(p.contact.linkedin)}`);
      lines.push(`NOTE:${vEsc(["Met at Pan-IIM WMC 2026", r.note].filter(Boolean).join(". "))}`, "END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n") + "\r\n";
}

export function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

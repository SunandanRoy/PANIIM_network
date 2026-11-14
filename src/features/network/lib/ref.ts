// Card references: 16-char Crockford token or 6-char printed code (DECISIONS E-08).
const TOKEN_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const CODE_RE = /^[2-9A-HJKMNP-Z]{6}$/;

export function normaliseRef(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return s.length === 16 ? s.replace(/[IL]/g, "1").replace(/O/g, "0") : s;
}

export function isToken(ref: string): boolean {
  return TOKEN_RE.test(normaliseRef(ref));
}

export function isCode(ref: string): boolean {
  return CODE_RE.test(normaliseRef(ref));
}

export function isValidRef(ref: string): boolean {
  return isToken(ref) || isCode(ref);
}

/** Pulls a card reference out of a scanned QR payload (a full /t/<ref> URL, or a bare ref). */
export function refFromScan(payload: string): string | null {
  const text = payload.trim();
  const m = text.match(/\/t\/([0-9A-Za-z-]{6,20})(?:[/?#]|$)/);
  const candidate = m?.[1] ?? text;
  return isValidRef(candidate) ? normaliseRef(candidate) : null;
}

export function passUrl(origin: string, ref: string): string {
  return `${origin.replace(/\/$/, "")}/t/${normaliseRef(ref)}`;
}

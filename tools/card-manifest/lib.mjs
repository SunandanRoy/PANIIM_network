// Card manifest primitives (K-12, PRD 6.1). Pure functions, unit-tested in manifest.test.mjs.
import { randomBytes, createHash } from "node:crypto";

export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // printed codes: no 0, 1, O, I, L

/** 80-bit random token as 16 Crockford base32 characters. */
export function newToken(rand = randomBytes) {
  const bytes = rand(10);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let s = "";
  for (let i = 0; i < 16; i++) {
    s = CROCKFORD[Number(bits & 31n)] + s;
    bits >>= 5n;
  }
  return s;
}

/** 6-character printed code; rejection sampling keeps the distribution uniform. */
export function newCode(rand = randomBytes) {
  let s = "";
  while (s.length < 6) {
    for (const b of rand(12)) {
      if (b < 248 && s.length < 6) s += CODE_ALPHABET[b % 31]; // 248 = 8 * 31
    }
  }
  return s;
}

/** Must match public.net__hash_token in SQL: sha256 of the upper-case token, UTF-8. */
export function hashToken(token) {
  return createHash("sha256").update(token.toUpperCase(), "utf8").digest("hex");
}

export function quantity(n, sparePct = 10) {
  return Math.ceil(n * (1 + sparePct / 100));
}

/** NDEF URI record size for NTAG21x (prefix 0x04 = "https://"), with TLV framing. */
export function ndefBytes(url) {
  const body = url.replace(/^https:\/\//, "");
  const payload = 1 + Buffer.byteLength(body, "utf8"); // URI identifier code + rest
  const record = 3 + 1 + payload; // header, type length, payload length (short record), type "U"
  return record + 2 + 1; // TLV tag + length, terminator
}

export function generate({ count, sparePct = 10, origin, batch, chip = "ntag213", roster = [], rand = randomBytes }) {
  const total = quantity(count, sparePct);
  const tokens = new Set();
  const codes = new Set();
  const rows = [];
  while (rows.length < total) {
    const token = newToken(rand);
    const code = newCode(rand);
    if (tokens.has(token) || codes.has(code)) continue;
    tokens.add(token);
    codes.add(code);
    const i = rows.length;
    rows.push({
      serial: `${batch}-${String(i + 1).padStart(5, "0")}`,
      token,
      code,
      url: `${origin.replace(/\/$/, "")}/t/${token}`,
      printed_name: roster[i] ?? "",
      spare: i >= count,
    });
  }
  return { rows, total, chip, batch };
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export const toCsv = (head, rows) => [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

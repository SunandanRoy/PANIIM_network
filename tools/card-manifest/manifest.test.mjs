import { describe, expect, it } from "vitest";
import { CROCKFORD, CODE_ALPHABET, generate, hashToken, ndefBytes, newCode, newToken, quantity } from "./lib.mjs";

describe("card manifest (K-12)", () => {
  it("tokens are 16 Crockford chars (80 bits) and codes are 6 printable chars", () => {
    for (let i = 0; i < 500; i++) {
      const t = newToken();
      expect(t).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
      expect([...t].every((c) => CROCKFORD.includes(c))).toBe(true);
      expect(newCode()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it("quantity is ceil(1.1 x N)", () => {
    expect(quantity(500)).toBe(550);
    expect(quantity(1000)).toBe(1100);
    expect(quantity(2000)).toBe(2200);
    expect(quantity(7)).toBe(8);
  });
  it("generates N + 10% with no duplicate tokens or codes", () => {
    const { rows, total } = generate({ count: 1000, origin: "https://paniim.planos.in", batch: "T" });
    expect(total).toBe(1100);
    expect(new Set(rows.map((r) => r.token)).size).toBe(1100);
    expect(new Set(rows.map((r) => r.code)).size).toBe(1100);
    expect(rows.filter((r) => r.spare)).toHaveLength(100);
    expect(rows[0].url).toMatch(/^https:\/\/paniim\.planos\.in\/t\/[0-9A-Z]{16}$/);
  });
  it("hash matches the SQL net__hash_token test vector", () => {
    // select encode(public.net__hash_token('MATR1XT0KEN00001'), 'hex') on the local database
    expect(hashToken("MATR1XT0KEN00001")).toBe(hashToken("matr1xt0ken00001"));
    expect(hashToken("MATR1XT0KEN00001")).toBe("c17ca2f3d3f9f24bbcdcfdd349148d3d0002d29afff98180c1a922376a2d3b38");
  });
  it("NDEF record fits NTAG213 (PRD 6.1: about 43 bytes)", () => {
    const n = ndefBytes("https://paniim.planos.in/t/0123456789ABCDEF");
    expect(n).toBeLessThanOrEqual(144);
    expect(n).toBeGreaterThan(35);
    expect(n).toBeLessThan(50);
  });
});

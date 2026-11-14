import type { Page } from "@playwright/test";

export const API = "http://127.0.0.1:54322";

export async function users(): Promise<{ id: string; name: string }[]> {
  return (await fetch(`${API}/harness/users`)).json();
}
export async function idOf(name: string) {
  const u = (await users()).find((x) => x.name === name);
  if (!u) throw new Error(`no demo user ${name}`);
  return u.id;
}
/** Signs the page in as a demo person (stands in for the host's sign-in). */
export async function signInAs(page: Page, name: string) {
  const id = await idOf(name);
  const { access_token } = await (await fetch(`${API}/harness/token`, { method: "POST", body: JSON.stringify({ user_id: id }) })).json();
  await page.goto("/auth");
  await page.evaluate((t) => localStorage.setItem("harness:token", t), access_token);
  return id;
}
export async function rpcAs(name: string, fn: string, args: Record<string, unknown> = {}) {
  const id = await idOf(name);
  const { access_token } = await (await fetch(`${API}/harness/token`, { method: "POST", body: JSON.stringify({ user_id: id }) })).json();
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: "POST", headers: { authorization: `Bearer ${access_token}` }, body: JSON.stringify(args) });
  return r.json();
}

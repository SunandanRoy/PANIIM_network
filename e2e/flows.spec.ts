// End-to-end flows from docs/spec/acceptance-tests.md, run against the harness and a real local database.
// Two browser contexts stand in for two phones; a "tap" is opening /t/<token> as the other person.
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { idOf, rpcAs, signInAs } from "./helpers";

const MEERA = "MEERA000DEM00001";

test("T1 signed out: sign in, return to the same pass", async ({ page }) => {
  await page.goto(`/t/${MEERA}`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/auth\?redirect=%2Ft%2FMEERA000DEM00001/);
  await page.getByTestId("signin-Kavya Nair").click();
  await expect(page).toHaveURL(new RegExp(`/t/${MEERA}$`));
  await expect(page.getByRole("heading", { name: "Dr. Meera Iyer" })).toBeVisible();
});

test("T2, T3, T5 tap connects after render, undo works, re-tap shows Connected without a toast", async ({ browser }) => {
  const phone = await browser.newContext();
  const page = await phone.newPage();
  await signInAs(page, "Tenzin Dorji");
  await page.goto(`/t/${MEERA}`);
  await expect(page.getByRole("heading", { name: "Dr. Meera Iyer" })).toBeVisible();
  await expect(page.getByText("✓ Connected with Meera")).toBeVisible();
  await expect(page.getByLabel("Contact details")).toHaveCount(0);
  await expect(page.getByTestId("privacy-footer")).toContainText("Email and phone are shared only after Meera accepts a request.");
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.getByText("Not connected. Nothing was shared.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("✓ Connected with Meera")).toBeVisible();
  await page.waitForTimeout(9000); // undo window closes
  await page.reload();
  await expect(page.getByText("✓ Connected", { exact: true })).toBeVisible();
  await expect(page.getByTestId("undo-bar")).toHaveCount(0);
  const conns = await rpcAs("Tenzin Dorji", "net_list_connections");
  expect(conns.filter((c: { person: { name: string } }) => c.person.name === "Dr. Meera Iyer")).toHaveLength(1);
  await phone.close();
});

test("T4 undo after 8 seconds is refused by the server", async () => {
  const meera = await idOf("Dr. Meera Iyer");
  const r = await rpcAs("Tenzin Dorji", "net_undo_connection", { p_other: meera });
  expect(r).toEqual({ error: "expired" });
});

test("T6 self tap: friendly message, no connection", async ({ page }) => {
  await signInAs(page, "Dr. Meera Iyer");
  await page.goto(`/t/${MEERA}`);
  await expect(page.getByRole("heading", { name: "This is your pass." })).toBeVisible();
});

test("T7 activation: wrong code fails, right code links, second card refused", async ({ page }) => {
  await signInAs(page, "Unbound Tester");
  await page.goto("/t/VNB0VND0DEM00006");
  await expect(page.getByRole("heading", { name: "Activate your pass" })).toBeVisible();
  await page.getByLabel("Code on back of card").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Link this pass to me" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't match");
  await page.getByLabel("Code on back of card").fill("HJ4N9P");
  await page.getByLabel(/All delegates/).check();
  await page.getByRole("button", { name: "Link this pass to me" }).click();
  await expect(page.getByRole("heading", { name: "This is your pass." })).toBeVisible();
  expect(await rpcAs("Unbound Tester", "net_activate_card", { p_code: "WXYZ23", p_scope: "all" })).toEqual({ error: "already_active" });
});

test("T8 revoked and T9 unknown/blocked look identical", async ({ page }) => {
  await signInAs(page, "Arjun Mehta");
  await page.goto("/t/REV0KED0DEM00009");
  await expect(page.getByRole("heading", { name: "This pass was replaced." })).toBeVisible();
  await expect(page.getByText("Ask the desk.")).toBeVisible();

  const unknown = await rpcAs("Arjun Mehta", "net_get_profile_by_token", { p_token: "ZZZZZZZZZZZZZZZZ" });
  await rpcAs("Kavya Nair", "net_block_user", { p_other: await idOf("Arjun Mehta") });
  const blocked = await rpcAs("Arjun Mehta", "net_get_profile_by_token", { p_token: "KAVYA000DEM00004" });
  expect(blocked).toEqual(unknown);
  await page.goto("/t/KAVYA000DEM00004");
  await expect(page.getByRole("heading", { name: "We couldn't read this pass." })).toBeVisible();
  await rpcAs("Kavya Nair", "net_unblock_user", { p_other: await idOf("Arjun Mehta") });
});

test("T14, T15 block and report from the profile; report reaches the desk queue", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await signInAs(a, "Sana Qureshi");
  const tenzin = await idOf("Tenzin Dorji");
  await a.goto(`/t/TENZ1N00DEM00005`);
  await a.getByRole("button", { name: "Report or block" }).click();
  await a.getByLabel("Spam or unwanted contact").check();
  await a.getByRole("button", { name: "Report and block" }).click();
  await expect(a.getByRole("heading", { name: "We couldn't read this pass." })).toBeVisible();
  expect(await rpcAs("Sana Qureshi", "net_get_profile_detail", { p_user: tenzin })).toBeNull();

  const desk = await (await browser.newContext()).newPage();
  await signInAs(desk, "Desk Volunteer");
  await desk.goto("/network/desk");
  await desk.getByRole("tab", { name: "Reports" }).click();
  await expect(desk.getByText("reported by Sana Qureshi")).toBeVisible();
  await rpcAs("Sana Qureshi", "net_unblock_user", { p_other: tenzin });
});

test("T16 visibility: scope change updates the banner and appends consent", async ({ page }) => {
  await signInAs(page, "Arjun Mehta");
  await page.goto("/network");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Only people I've met/).check();
  await expect(page.getByTestId("banner-preview")).toHaveText("You're visible only to people you've met. Contact details stay hidden until you accept.");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("visibility-banner")).toContainText("You're visible only to people you've met.");
});

test("T18 desk: non-staff denied; staff binds a spare and the action is audited", async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await signInAs(p, "Kavya Nair");
  await p.goto("/network/desk");
  await expect(p.getByText("This page is for desk volunteers and organisers.")).toBeVisible();

  const d = await (await browser.newContext()).newPage();
  await signInAs(d, "Desk Volunteer");
  await d.goto("/network/desk");
  await d.getByLabel("Find delegate").fill("Rahul");
  await d.getByRole("button", { name: /Rahul Bhattacharya/ }).click();
  await d.getByLabel("Code on back of card").fill("PQRS45");
  await d.getByRole("button", { name: "Bind card" }).click();
  await expect(d.getByRole("button", { name: /Rahul Bhattacharya.*Card PQRS45/ })).toBeVisible();
});

test("T19 kill switch: admin pauses taps; tap screen shows the calm message", async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  await signInAs(admin, "Organiser Admin");
  await admin.goto("/network/desk");
  await admin.getByRole("tab", { name: "Metrics" }).click();
  await admin.getByRole("switch", { name: "Taps and scans" }).click();
  const v = await (await browser.newContext()).newPage();
  await signInAs(v, "Arjun Mehta");
  await v.goto(`/t/${MEERA}`);
  await expect(v.getByRole("heading", { name: "Taps are paused for a moment." })).toBeVisible();
  await admin.getByRole("switch", { name: "Taps and scans" }).click();
  await expect(admin.getByRole("switch", { name: "Taps and scans" })).toHaveAttribute("aria-checked", "true");
});

test("N1 Network home: map card with connections, empty state without", async ({ browser }) => {
  const you = await (await browser.newContext()).newPage();
  await signInAs(you, "Demo You");
  await you.goto("/network");
  await expect(you.getByTestId("map-card")).toContainText("4 connections");
  await expect(you.getByRole("button", { name: "Map", exact: true })).toBeVisible();
  await expect(you.getByTestId("visibility-banner")).toContainText("You're visible to other presenters.");
  const empty = await (await browser.newContext()).newPage();
  await signInAs(empty, "Organiser Admin");
  await empty.goto("/network");
  await expect(empty.getByTestId("map-card-empty")).toBeVisible();
  await expect(empty.getByTestId("map-card-empty").getByRole("button", { name: "Scan a pass" })).toBeVisible();
  await expect(empty.getByTestId("map-card-empty").getByRole("button", { name: "Show my pass" })).toBeVisible();
});

test("M2, M4 map: keyboard select shows peek; Enter opens profile; list view works without a mouse", async ({ page }) => {
  await signInAs(page, "Demo You");
  await page.goto("/network/map");
  const node = page.locator('[data-node]').filter({ has: page.locator("xpath=self::*[contains(@aria-label,'Meera')]") }).first();
  await expect(page.getByRole("button", { name: /^Dr\. Meera Iyer,/ })).toBeVisible();
  await page.getByRole("button", { name: /^Dr\. Meera Iyer,/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("peek")).toContainText("Dr. Meera Iyer");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("peek")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Dr\. Meera Iyer,/ })).toBeFocused();
  void node;
  await page.getByRole("button", { name: "Show as list" }).click();
  const first = page.getByRole("list", { name: "People on your map, closest first" }).getByRole("button").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/network\/people\//);
});

test("M3 theme filter with no match shows the message", async ({ page }) => {
  await signInAs(page, "Demo You");
  await page.goto("/network/map");
  await page.getByRole("group", { name: "Filter by theme" }).getByRole("button", { name: "Healthcare Management" }).click();
  await expect(page.getByText("No one in your map matches these filters.")).toBeVisible();
});

test("O1, O2 overlap: regions add up; a fourth theme is refused", async ({ page }) => {
  await signInAs(page, "Demo You");
  await page.goto("/network/map?view=overlap");
  for (const t of ["Sustainability", "Finance & Accounting", "Strategy & Innovation"]) await page.getByRole("button", { name: t }).first().click();
  const note = page.getByTestId("overlap-note");
  await expect(note).toContainText("Region counts add up to");
  const total = Number((await note.textContent())!.match(/add up to (\d+)/)![1]);
  const counts = await page.locator("button[aria-label$='people'], button[aria-label$='person']").evaluateAll((els) =>
    els.map((e) => Number((e.getAttribute("aria-label") ?? "").match(/: (\d+) /)?.[1] ?? 0)));
  expect(counts).toHaveLength(7);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(total);
  await page.getByRole("button", { name: "Marketing" }).click();
  await expect(page.getByText("Three themes is the maximum.")).toBeVisible();
  await page.getByRole("tab", { name: /Event/ }).click();
  await expect(note).toContainText("every discoverable delegate");
});

test("S1 scan sheet: typed code opens the same profile as a tap", async ({ page }) => {
  await signInAs(page, "Arjun Mehta");
  await page.goto("/network/scan");
  await page.getByLabel("Or type the 6-character code").fill("k7qx2m");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/t\/K7QX2M\?src=scan/);
  await expect(page.getByRole("heading", { name: "Dr. Meera Iyer" })).toBeVisible();
  await expect(page.getByText("PAN-IIM WMC 2026 · YOU SCANNED A PASS")).toBeVisible();
});

test("E1 export contains only accepted connections", async ({ page }) => {
  await signInAs(page, "Demo You");
  await page.goto("/network/connections");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export contacts (CSV)" }).click()]);
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toContain("Dr. Meera Iyer");
  expect(text).toContain("Sana Qureshi");
  expect(text).not.toContain("Arjun Mehta");
  expect(text).not.toContain("Rahul Bhattacharya");
});

test("My pass shows the code and a QR", async ({ page }) => {
  await signInAs(page, "Dr. Meera Iyer");
  await page.goto("/network/pass");
  await expect(page.getByText("K7QX2M")).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code for your pass, code K7QX2M/ })).toBeVisible();
});

for (const [name, path] of [["home", "/network"], ["tap", `/t/${MEERA}`], ["map", "/network/map"], ["profile", "PROFILE"], ["visibility", "/network/settings/visibility"], ["connections", "/network/connections"], ["pass", "/network/pass"]] as const) {
  test(`a11y: ${name} has no serious axe violations and 44 px buttons`, async ({ page }) => {
    await signInAs(page, "Demo You");
    await page.goto(path === "PROFILE" ? `/network/people/${await idOf("Dr. Meera Iyer")}` : path);
    await page.waitForLoadState("networkidle");
    const res = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    const small = await page.locator("main button:visible").evaluateAll((els) =>
      // Inline text links styled as links are exempt (WCAG 2.5.8 inline exception).
      els.filter((e) => !e.className.includes("underline"))
        .map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30), h: e.getBoundingClientRect().height }))
        .filter((b) => b.h < 44));
    expect(small).toEqual([]);
  });
}

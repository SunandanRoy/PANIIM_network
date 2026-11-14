import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NetworkProvider } from "../adapter/context";
import type { NetworkHostAdapter } from "../adapter/types";
import TapScreen from "./TapScreen";

const meera = {
  id: "m", name: "Dr. Meera Iyer", institute: "IIM Kozhikode", role_label: "Associate Professor, Operations", role_kind: "faculty",
  photo_url: null, headline: null, key_finding: null, themes: [], ask_text: null, offer_text: null, is_presenter: true,
  paper_title: "Green logistics adoption among Indian MSMEs", session_id: "3B", room: "C-2",
};

function setup(responses: Record<string, unknown>, user: { id: string } | null = { id: "b" }, extra: Partial<NetworkHostAdapter> = {}) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      const r = responses[fn];
      return { data: typeof r === "function" ? (r as (a?: unknown) => unknown)(args) : r, error: null };
    }),
  };
  const adapter: Partial<NetworkHostAdapter> = { supabase, getUser: async () => user, navigate: vi.fn(), requireAuth: vi.fn(), toast: vi.fn(), ...extra };
  render(<NetworkProvider adapter={adapter}><TapScreen token="MEERA000DEM00001" /></NetworkProvider>);
  return { calls, adapter };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("TapScreen (K-21, K-23)", () => {
  it("T2: shows the card first, then connects after render, with undo and no contact", async () => {
    const { calls } = setup({
      net_get_profile_by_token: { state: "active", person: meera, connection: { state: "none" }, mutual_count: 3, in_your_session: true },
      net_connect_via_card: { created: true, other_id: "m", undo_seconds: 8 },
    });
    expect(await screen.findByRole("heading", { name: "Dr. Meera Iyer" })).toBeTruthy();
    await screen.findByTestId("undo-bar");
    expect(screen.getByText("✓ Connected with Meera")).toBeTruthy();
    expect(screen.getByText("3 mutual connections")).toBeTruthy();
    expect(screen.getByText(/In your session/)).toBeTruthy();
    expect(screen.queryByLabelText("Contact details")).toBeNull();
    expect(screen.getByTestId("privacy-footer").textContent).toContain("Email and phone are shared only after Meera accepts a request.");
    const order = calls.map((c) => c.fn);
    expect(order.indexOf("net_get_profile_by_token")).toBeLessThan(order.indexOf("net_connect_via_card"));
  });

  it("T3: undo removes the connection", async () => {
    const { calls } = setup({
      net_get_profile_by_token: { state: "active", person: meera, connection: { state: "none" }, mutual_count: 0 },
      net_connect_via_card: { created: true, other_id: "m" },
      net_undo_connection: { ok: true },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Undo/ }));
    expect(await screen.findByText("Not connected. Nothing was shared.")).toBeTruthy();
    expect(calls.some((c) => c.fn === "net_undo_connection" && c.args?.p_other === "m")).toBe(true);
  });

  it("T5: already connected shows the badge and never calls connect", async () => {
    const { calls } = setup({ net_get_profile_by_token: { state: "active", person: meera, connection: { state: "connected" }, mutual_count: 0 } });
    expect(await screen.findByText("✓ Connected")).toBeTruthy();
    expect(screen.queryByTestId("undo-bar")).toBeNull();
    expect(calls.some((c) => c.fn === "net_connect_via_card")).toBe(false);
  });

  it("T8 and T9: revoked and unknown states", async () => {
    setup({ net_get_profile_by_token: { state: "revoked" } });
    expect(await screen.findByText("This pass was replaced.")).toBeTruthy();
    cleanup();
    setup({ net_get_profile_by_token: { state: "unknown" } });
    expect(await screen.findByText("We couldn't read this pass.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scan a pass" })).toBeTruthy();
  });

  it("T1: signed out asks to sign in and returns to the same URL", async () => {
    const { adapter, calls } = setup({ net_resolve_token: { state: "active" } }, null);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(adapter.requireAuth).toHaveBeenCalledWith("/t/MEERA000DEM00001");
    expect(calls.map((c) => c.fn)).toEqual(["net_resolve_token"]);
  });

  it("T19: paused shows a calm message", async () => {
    setup({ net_get_profile_by_token: { state: "paused" } });
    expect(await screen.findByText("Taps are paused for a moment.")).toBeTruthy();
  });

  it("T7: unbound shows activation and sends code, scope and token", async () => {
    const { calls } = setup({ net_get_profile_by_token: { state: "unbound" }, net_activate_card: { error: "bad_code" } });
    const input = await screen.findByLabelText("Code on back of card");
    fireEvent.change(input, { target: { value: "hj4n9p" } });
    fireEvent.click(screen.getByLabelText(/All delegates/));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Link this pass to me" })); });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/doesn't match/));
    expect(calls.find((c) => c.fn === "net_activate_card")?.args).toEqual({ p_code: "HJ4N9P", p_scope: "all", p_token: "MEERA000DEM00001" });
  });

  it("queues the connect when offline (R8)", async () => {
    localStorage.clear();
    setup({
      net_get_profile_by_token: { state: "active", person: meera, connection: { state: "none" }, mutual_count: 0 },
      net_connect_via_card: () => { throw new TypeError("Failed to fetch"); },
    });
    expect(await screen.findByText(/You're offline\. We'll connect you with Meera/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("net:pendingConnects") ?? "[]")).toHaveLength(1);
  });
});

import type { ReactNode } from "react";

/** The only thing the module needs from the host's Supabase client: `rpc`. supabase-js satisfies it. */
export interface SupabaseClientLike {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

export interface NetworkUser {
  id: string;
}

export interface LiveSession {
  id: string;
  title: string;
}

export type ToastTone = "info" | "success" | "error";

/**
 * The single coupling between the module and the host app. The integrator implements it once in
 * `src/network.adapter.ts`. Every optional member has a graceful default (see defaultAdapter.ts).
 */
export interface NetworkHostAdapter {
  /** The host's existing Supabase client (never create a new one). */
  supabase: SupabaseClientLike;
  /** Current signed-in user, or null. */
  getUser(): Promise<NetworkUser | null>;
  /** Optional: subscribe to sign-in/sign-out; returns an unsubscribe function. */
  onAuthChange?(cb: (user: NetworkUser | null) => void): () => void;
  /** Send the user to the host's sign-in, then back to `returnTo`. */
  requireAuth(returnTo: string): void;
  /** Client-side navigation in the host router. */
  navigate(to: string, opts?: { replace?: boolean }): void;
  /** Optional history back; default navigate to the Network page. */
  back?(): void;
  /** Origin used to build pass links, for example https://paniim.planos.in */
  hostOrigin: string;
  /** Path of the host's existing Network page. Default "/network". */
  networkHomePath?: string;
  /** The session live right now for the current user, if any (tags new connections). */
  getLiveSession?(): Promise<LiveSession | null>;
  /** Host modules (out of scope here). Defaults show a short toast. */
  openCoffeeRequest?(personId: string, name: string): void;
  openAskThread?(personId: string, name: string): void;
  onFollow?(personId: string): void;
  onSave?(personId: string): void;
  openVenueMap?(room: string): void;
  /** Extra host content on the profile screen (for example office hours). */
  renderProfileExtras?(personId: string): ReactNode;
  /** Extra host content on My connections (for example the coffee requests waiting). */
  renderConnectionsExtras?(): ReactNode;
  onConnectionCreated?(otherId: string, source: "tap" | "scan"): void;
  /** Host toast (for example sonner). Default: the module's own polite live region. */
  toast?(message: string, opts?: { tone?: ToastTone }): void;
  analytics?(event: string, props?: Record<string, unknown>): void;
}

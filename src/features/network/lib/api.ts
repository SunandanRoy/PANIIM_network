import type { SupabaseClientLike } from "../adapter/types";
import type {
  AdminCard, AdminDelegate, AdminMetrics, AdminReport, ConnectResult, ConnectionRow, ContactField, EgoGraph,
  FeatureFlags, ListItem, MeetingSource, MyPass, NetworkSummary, OkOrError, OverlapScope, ProfileDetail, Region,
  Scope, Settings, TapProfile, Theme, VennCounts,
} from "../types/rpc";

export type NetErrorKind = "auth" | "forbidden" | "offline" | "server" | "no_client";

/** Thrown for transport and permission failures. Expected business outcomes come back as `{ error }` data. */
export class NetError extends Error {
  constructor(public kind: NetErrorKind, message: string, public code?: string) {
    super(message);
    this.name = "NetError";
  }
}

export function isOffline(e: unknown): boolean {
  if (e instanceof NetError) return e.kind === "offline";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return e instanceof TypeError && /fetch|network|load failed/i.test(e.message);
}

function classify(err: { message: string; code?: string }): NetError {
  const msg = err.message ?? "";
  if (/net:auth|JWT|not authenticated/i.test(msg)) return new NetError("auth", "Sign in to continue.", err.code);
  if (/net:forbidden/.test(msg) || err.code === "42501") return new NetError("forbidden", "Not allowed.", err.code);
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) return new NetError("offline", "You're offline.", err.code);
  return new NetError("server", "Something went wrong. Try again.", err.code);
}

export async function call<T>(client: SupabaseClientLike, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res: { data: unknown; error: { message: string; code?: string } | null };
  try {
    res = await client.rpc(fn, args);
  } catch (e) {
    if (e instanceof NetError) throw e;
    throw isOffline(e) ? new NetError("offline", "You're offline.") : new NetError("server", String(e));
  }
  if (res.error) throw classify(res.error);
  return res.data as T;
}

/** Typed wrappers for every client RPC. Argument names match the SQL parameters. */
export function createNetworkApi(client: SupabaseClientLike) {
  const c = <T>(fn: string, args?: Record<string, unknown>) => call<T>(client, fn, args);
  return {
    featureFlags: () => c<FeatureFlags>("net_get_feature_flags"),
    themes: () => c<Theme[]>("net_list_themes"),
    resolveToken: (token: string) => c<{ state: TapProfile["state"] }>("net_resolve_token", { p_token: token }),
    profileByToken: (token: string) => c<TapProfile>("net_get_profile_by_token", { p_token: token }),
    connectViaCard: (token: string, source: "tap" | "scan", sessionId?: string | null, context?: string | null) =>
      c<ConnectResult>("net_connect_via_card", { p_token: token, p_source: source, p_session_id: sessionId ?? null, p_context: context ?? null }),
    undoConnection: (other: string) => c<OkOrError>("net_undo_connection", { p_other: other }),
    recordMeeting: (other: string, source: MeetingSource, context?: string, sessionId?: string) =>
      c<{ recorded?: boolean; edge?: boolean; error?: string }>("net_record_meeting", {
        p_other: other, p_source: source, p_context: context ?? null, p_session_id: sessionId ?? null,
      }),
    activateCard: (code: string, scope: Scope, token?: string | null) =>
      c<OkOrError & { printed_code?: string }>("net_activate_card", { p_code: code, p_scope: scope, p_token: token ?? null }),
    reportLostCard: () => c<OkOrError & { revoked?: number }>("net_report_lost_card"),
    myPass: () => c<MyPass>("net_get_my_pass"),
    issueDigitalPass: () => c<MyPass & { error?: string }>("net_issue_digital_pass"),
    mySettings: () => c<Settings>("net_get_my_settings"),
    setConsent: (key: "visibility_scope" | "share_on_tap" | "second_degree" | "discoverable" | "contact_fields" | "followup_reminder",
      value: Scope | boolean | ContactField[]) => c<Settings & { error?: string }>("net_set_consent", { p_key: key, p_value: value }),
    updateProfileExt: (p: Partial<Pick<Settings, "headline" | "bio" | "ask_text" | "offer_text" | "interests" | "ask_me_about" | "open_to">> & { theme_ids?: number[] }) =>
      c<Settings & { error?: string }>("net_update_profile_ext", { p }),
    withdrawAll: () => c<OkOrError>("net_withdraw_all"),
    grantContact: (viewer: string, source: "manual" | "coffee" = "manual") => c<OkOrError>("net_grant_contact", { p_viewer: viewer, p_source: source }),
    revokeContact: (viewer: string) => c<OkOrError>("net_revoke_contact", { p_viewer: viewer }),
    profileDetail: (id: string) => c<ProfileDetail | null>("net_get_profile_detail", { p_user: id }),
    setNote: (about: string, body: string) => c<OkOrError>("net_set_note", { p_about: about, p_body: body }),
    removeConnection: (other: string) => c<OkOrError>("net_remove_connection", { p_other: other }),
    listConnections: () => c<ConnectionRow[]>("net_list_connections"),
    blockUser: (other: string) => c<OkOrError>("net_block_user", { p_other: other }),
    unblockUser: (other: string) => c<OkOrError>("net_unblock_user", { p_other: other }),
    reportUser: (other: string, reason: "spam" | "inappropriate" | "impersonation" | "other", note?: string) =>
      c<OkOrError>("net_report_user", { p_other: other, p_reason: reason, p_note: note ?? null }),
    logEvent: (kind: "map_open" | "overlap_open" | "list_open" | "client_error" | "export") => c<OkOrError>("net_log_event", { p_kind: kind }),
    egoGraph: (depth: 1 | 2 = 2) => c<EgoGraph>("net_get_ego_graph", { p_depth: depth }),
    networkSummary: () => c<NetworkSummary>("net_get_my_network_summary"),
    vennCounts: (themeIds: number[], scope: OverlapScope) => c<VennCounts>("net_venn_counts", { p_theme_ids: themeIds, p_scope: scope }),
    listRegion: (themeIds: number[], region: Region, scope: OverlapScope, limit = 50, offset = 0) =>
      c<{ people: ListItem[]; error?: string }>("net_list_region", { p_theme_ids: themeIds, p_region: region, p_scope: scope, p_limit: limit, p_offset: offset }),
    searchPeople: (q: string, f: { themeIds?: number[]; institute?: string; roleKind?: string; sessionId?: string; limit?: number } = {}) =>
      c<{ people: ListItem[] }>("net_search_people", {
        p_q: q, p_theme_ids: f.themeIds ?? null, p_institute: f.institute ?? null, p_role_kind: f.roleKind ?? null,
        p_session_id: f.sessionId ?? null, p_limit: f.limit ?? 30,
      }),
    admin: {
      whoami: () => c<{ staff: boolean; role: "desk" | "admin" | null }>("net_admin_whoami"),
      findDelegate: (q: string) => c<{ people: AdminDelegate[] }>("net_admin_find_delegate", { p_q: q }),
      bindCard: (userId: string, code: string, scope: Scope = "presenters") => c<OkOrError>("net_admin_bind_card", { p_user: userId, p_code: code, p_scope: scope }),
      unbindCard: (cardId: string) => c<OkOrError>("net_admin_unbind_card", { p_card_id: cardId }),
      revokeCard: (cardId: string) => c<OkOrError>("net_admin_revoke_card", { p_card_id: cardId }),
      swapLostCard: (userId: string, newCode: string) => c<OkOrError>("net_admin_swap_lost_card", { p_user: userId, p_new_code: newCode }),
      listCards: (status?: string, batch?: string) =>
        c<{ cards: AdminCard[]; batches: { batch: string | null; unbound: number; active: number; revoked: number }[] }>(
          "net_admin_list_cards", { p_status: status ?? null, p_batch: batch ?? null }),
      importCards: (rows: { token_hash: string; printed_code: string; chip?: string; batch?: string }[]) =>
        c<{ inserted: number; skipped: number }>("net_admin_import_cards", { p_rows: rows }),
      listReports: (status: "open" | "resolved" | null = "open") => c<{ reports: AdminReport[] }>("net_admin_list_reports", { p_status: status }),
      resolveReport: (id: string, resolution: string) => c<OkOrError>("net_admin_resolve_report", { p_id: id, p_resolution: resolution }),
      metrics: () => c<AdminMetrics>("net_admin_metrics"),
      setFlag: (key: keyof FeatureFlags, enabled: boolean) => c<FeatureFlags>("net_admin_set_flag", { p_key: key, p_enabled: enabled }),
      exportReminders: () => c<{ people: { name: string; email: string | null; connections: number }[] }>("net_admin_export_reminders"),
    },
  };
}

export type NetworkApi = ReturnType<typeof createNetworkApi>;

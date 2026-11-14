// The module's own types for its RPCs. Deliberately independent of the host's generated Database types.

export type Scope = "presenters" | "all" | "met";
export type ContactField = "email" | "phone" | "linkedin";
export type MeetingSource = "tap" | "scan" | "coffee" | "circle" | "office_hours" | "table";
export type RoleKind = "faculty" | "phd" | "industry" | "student" | string;

export interface Theme {
  id: number;
  slug: string;
  label: string;
  colour: string;
  rank?: number;
}

export interface Contact {
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
}

/** A person as returned by the server after block, scope and field rules. Absent keys were withheld. */
export interface Person {
  id: string;
  name: string;
  institute: string | null;
  role_label: string | null;
  role_kind: RoleKind | null;
  photo_url: string | null;
  headline: string | null;
  key_finding: string | null;
  themes: Theme[];
  ask_text: string | null;
  offer_text: string | null;
  is_presenter: boolean;
  bio?: string | null;
  paper_title?: string | null;
  paper_url?: string | null;
  slides_url?: string | null;
  session_id?: string | null;
  session_title?: string | null;
  session_start?: string | null;
  room?: string | null;
  interests?: string[];
  ask_me_about?: string[];
  open_to?: string[];
  contact?: Contact;
}

export type TapState = "active" | "self" | "unbound" | "revoked" | "unknown" | "paused" | "limited";

export interface TapProfile {
  state: TapState;
  person?: Person;
  connection?: { state: "connected" | "none" };
  mutual_count?: number;
  in_your_session?: boolean;
}

export interface ConnectResult {
  created?: boolean;
  other_id?: string;
  undo_seconds?: number;
  error?: "paused" | "limited" | "unknown" | "self" | "bad_source";
}

export interface ProfileDetail {
  person: Person;
  relation: {
    self?: boolean;
    level?: "directory" | "met" | "accepted";
    connection?: "connected" | "none";
    connected_at?: string | null;
    source?: MeetingSource | null;
    context?: string | null;
    initiator_is_me?: boolean | null;
    contact_granted_to_me?: boolean;
    i_shared_contact?: boolean;
  };
  mutual?: { count: number; people?: { id: string; name: string }[] };
  path_to_me?: { id: string; name: string }[] | null;
  shared_sessions?: string[];
  note?: string | null;
}

export interface Settings {
  visibility_scope: Scope;
  share_on_tap: boolean;
  second_degree: boolean;
  discoverable: boolean;
  contact_fields: ContactField[];
  followup_reminder: boolean;
  headline: string | null;
  bio: string | null;
  ask_text: string | null;
  offer_text: string | null;
  interests: string[];
  ask_me_about: string[];
  open_to: string[];
  themes: Theme[];
  consent_version: string;
  registered: boolean;
  is_presenter: boolean;
  name: string | null;
  has_contact: Record<ContactField, boolean>;
}

export interface PassCard {
  status: "unbound" | "active" | "revoked";
  printed_code: string | null;
  chip: string;
  virtual: boolean;
  bound_at: string | null;
  revoked_at: string | null;
}

export interface MyPass {
  card: PassCard | null;
  digital_pass_allowed: boolean;
}

export interface GraphNode {
  id: string;
  depth: 0 | 1 | 2;
  name: string;
  institute: string | null;
  role_label: string | null;
  role_kind: RoleKind | null;
  photo_url: string | null;
  theme_ids: number[];
  session_id: string | null;
  degree: number;
  mutual: number;
  ask_text: string | null;
  offer_text: string | null;
}

export interface GraphEdge {
  a: string;
  b: string;
  source: MeetingSource;
  sim: number | null;
  direct: boolean;
}

export interface EgoGraph {
  me: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  total: number;
  paused?: boolean;
}

export interface NetworkSummary {
  direct: number;
  within_two: number;
  preview: { id: string; depth: 1 | 2; parent: string; colour: string | null }[];
  legend: { id: number; label: string; colour: string }[];
}

export type Region = "A" | "B" | "C" | "AB" | "AC" | "BC" | "ABC";
export type OverlapScope = "network" | "event";

export interface VennCounts {
  theme_ids: number[];
  scope: OverlapScope;
  regions: Partial<Record<Region, number>>;
  total: number;
  totals: { network: number; event: number };
  paused?: boolean;
  error?: string;
}

export interface ListItem {
  id: string;
  name: string;
  institute: string | null;
  role_label: string | null;
  role_kind: RoleKind | null;
  photo_url: string | null;
  paper_title: string | null;
  session_id: string | null;
  headline: string | null;
  themes: Theme[];
  connected: boolean;
}

export interface ConnectionRow {
  person: Person;
  source: MeetingSource;
  context: string | null;
  session_id: string | null;
  created_at: string;
  initiator_is_me: boolean;
  note: string | null;
  contact_granted_to_me: boolean;
  i_shared_contact: boolean;
}

export interface FeatureFlags {
  tap: boolean;
  map: boolean;
  overlap: boolean;
  galaxy: boolean;
  digital_pass: boolean;
}

export interface AdminCard {
  id: string;
  printed_code: string;
  chip: string;
  status: "unbound" | "active" | "revoked";
  user_id: string | null;
  user_name: string | null;
  batch: string | null;
  bound_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AdminDelegate {
  id: string;
  name: string;
  institute: string | null;
  email: string | null;
  is_presenter: boolean;
  card: AdminCard | null;
}

export interface AdminReport {
  id: string;
  reason: string;
  note: string | null;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: string;
  reporter: { id: string; name: string | null };
  reported: { id: string; name: string | null };
  reports_against: number;
}

export interface AdminMetrics {
  as_of: string;
  taps_total: number;
  taps_last_hour: number;
  connections: number;
  connections_today: number;
  activations: number;
  digital_passes: number;
  cards_unbound: number;
  registered: number;
  profiles_completed: number;
  completion_rate: number;
  map_opens: number;
  overlap_opens: number;
  client_errors: number;
  rate_limited: number;
  reports_open: number;
  flags: FeatureFlags;
}

export interface OkOrError {
  ok?: boolean;
  error?: string;
}

-- pan-iim-network: core tables (K-06, K-20, K-28, K-30, K-81)
-- Additive only. Every object is prefixed net_. No host table is altered.
-- Idempotent: safe to run more than once. RLS on, no policies, no client grants (grants file revokes).

create table if not exists public.net_schema_version (
  version     int primary key,
  applied_at  timestamptz not null default now()
);

create table if not exists public.net_themes (
  id      smallint primary key,
  slug    text not null unique,
  label   text not null,
  colour  text not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort    smallint not null default 0
);

create table if not exists public.net_profile_ext (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  headline          text check (char_length(headline) <= 80),
  bio               text check (char_length(bio) <= 280),
  ask_text          text check (char_length(ask_text) <= 140),
  offer_text        text check (char_length(offer_text) <= 140),
  interests         text[] not null default '{}' check (cardinality(interests) <= 12),
  ask_me_about      text[] not null default '{}' check (cardinality(ask_me_about) <= 12),
  open_to           text[] not null default '{}' check (cardinality(open_to) <= 8),
  visibility_scope  text not null default 'presenters' check (visibility_scope in ('presenters','all','met')),
  discoverable      boolean not null default false,
  second_degree     boolean not null default false,
  share_on_tap      boolean not null default false,
  contact_fields    text[] not null default '{email}' check (contact_fields <@ array['email','phone','linkedin']::text[]),
  followup_reminder boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table if not exists public.net_profile_themes (
  user_id   uuid not null references auth.users(id) on delete cascade,
  theme_id  smallint not null references public.net_themes(id) on delete cascade,
  rank      smallint not null check (rank between 1 and 3),
  primary key (user_id, rank),
  unique (user_id, theme_id)
);
create index if not exists net_profile_themes_theme_idx on public.net_profile_themes (theme_id);

create table if not exists public.net_cards (
  id            uuid primary key default gen_random_uuid(),
  token_hash    bytea unique check (token_hash is null or octet_length(token_hash) = 32),
  printed_code  text not null unique check (printed_code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  chip          text not null default 'ntag213' check (chip in ('ntag213','ntag215','ntag216','ntag424','virtual')),
  status        text not null default 'unbound' check (status in ('unbound','active','revoked')),
  user_id       uuid references auth.users(id) on delete set null,
  batch         text,
  last_ctr      int,
  bound_at      timestamptz,
  bound_by      uuid,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (status <> 'active' or user_id is not null),
  check (chip <> 'virtual' or token_hash is null)
);
create unique index if not exists net_cards_one_active_per_user on public.net_cards (user_id) where status = 'active';

create table if not exists public.net_connections (
  a           uuid not null references auth.users(id) on delete cascade,
  b           uuid not null references auth.users(id) on delete cascade,
  initiator   uuid not null,
  source      text not null check (source in ('tap','scan','coffee','circle','office_hours','table')),
  context     text check (char_length(context) <= 120),
  card_id     uuid,
  session_id  text,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,
  removed_by  uuid,
  primary key (a, b),
  check (a < b),
  check (initiator = a or initiator = b)
);
create index if not exists net_connections_b_idx on public.net_connections (b);
create index if not exists net_connections_a_active_idx on public.net_connections (a) where removed_at is null;
create index if not exists net_connections_b_active_idx on public.net_connections (b) where removed_at is null;

-- ADDITION (docs/DECISIONS.md E-06): every record_meeting call, edge or not.
create table if not exists public.net_meetings (
  id          bigserial primary key,
  actor       uuid not null references auth.users(id) on delete cascade,
  other       uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('tap','scan','coffee','circle','office_hours','table')),
  context     text check (char_length(context) <= 120),
  session_id  text,
  at          timestamptz not null default now()
);
create index if not exists net_meetings_pair_idx on public.net_meetings (actor, other, at);

-- ADDITION (data-contract NEW): where an accepted contact request is stored.
create table if not exists public.net_contact_grants (
  owner       uuid not null references auth.users(id) on delete cascade,
  viewer      uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('coffee','manual','share_on_tap')),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  primary key (owner, viewer),
  check (owner <> viewer)
);

create table if not exists public.net_blocks (
  blocker     uuid not null references auth.users(id) on delete cascade,
  blocked     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists net_blocks_blocked_idx on public.net_blocks (blocked);

create table if not exists public.net_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter     uuid not null references auth.users(id) on delete cascade,
  reported     uuid not null references auth.users(id) on delete cascade,
  reason       text not null check (reason in ('spam','inappropriate','impersonation','other')),
  note         text check (char_length(note) <= 500),
  status       text not null default 'open' check (status in ('open','resolved')),
  resolution   text check (char_length(resolution) <= 500),
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.net_consents (
  id            bigserial primary key,
  user_id       uuid not null,
  key           text not null,
  value         jsonb not null,
  text_version  text not null,
  at            timestamptz not null default now()
);
create index if not exists net_consents_user_idx on public.net_consents (user_id, at);

create table if not exists public.net_person_notes (
  author      uuid not null references auth.users(id) on delete cascade,
  about       uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  updated_at  timestamptz not null default now(),
  primary key (author, about)
);

create table if not exists public.net_tap_events (
  id          bigserial primary key,
  viewer      uuid,
  bucket      text,
  kind        text not null,
  token_hash  bytea,
  result      text not null,
  at          timestamptz not null default now()
);
create index if not exists net_tap_events_viewer_idx on public.net_tap_events (viewer, kind, at);
create index if not exists net_tap_events_bucket_idx on public.net_tap_events (bucket, kind, at);

create table if not exists public.net_similarity_edges (
  a            uuid not null,
  b            uuid not null,
  score        real not null check (score >= 0 and score <= 1),
  computed_at  timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists net_similarity_edges_b_idx on public.net_similarity_edges (b);

create table if not exists public.net_feature_flags (
  key      text primary key,
  enabled  boolean not null
);

create table if not exists public.net_staff (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null check (role in ('desk','admin'))
);

create table if not exists public.net_audit (
  id       bigserial primary key,
  actor    uuid,
  action   text not null,
  subject  text,
  detail   jsonb,
  at       timestamptz not null default now()
);

create table if not exists public.net_metric_events (
  id       bigserial primary key,
  kind     text not null,
  user_id  uuid,
  at       timestamptz not null default now()
);
create index if not exists net_metric_events_idx on public.net_metric_events (kind, user_id, at);

-- Aggregates kept after the 29 Dec 2026 retention deletion (no identifiers).
create table if not exists public.net_aggregates (
  key          text not null,
  value        bigint not null,
  recorded_at  timestamptz not null default now(),
  primary key (key, recorded_at)
);

-- Consents are append-only. Only the retention and withdrawal paths may delete (they set net.allow_consent_delete).
create or replace function public.net__consents_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('net.allow_consent_delete', true), '') = 'on' then
    return old;
  end if;
  raise exception 'net:consents_append_only' using errcode = 'P0001';
end $$;

drop trigger if exists net_consents_append_only on public.net_consents;
create trigger net_consents_append_only
  before update or delete on public.net_consents
  for each row execute function public.net__consents_append_only();

-- RLS on every table, no policies: clients reach data only through SECURITY DEFINER functions.
do $$
declare t text;
begin
  foreach t in array array[
    'net_schema_version','net_themes','net_profile_ext','net_profile_themes','net_cards','net_connections',
    'net_meetings','net_contact_grants','net_blocks','net_reports','net_consents','net_person_notes',
    'net_tap_events','net_similarity_edges','net_feature_flags','net_staff','net_audit','net_metric_events',
    'net_aggregates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- K-06 theme taxonomy: wireframe chips plus likely paper tracks. Colours checked for contrast on white.
insert into public.net_themes (id, slug, label, colour, sort) values
  (1,  'strategy',        'Strategy & Innovation',        '#5B54C0', 1),
  (2,  'sustainability',  'Sustainability',               '#1F5C4A', 2),
  (3,  'finance',         'Finance & Accounting',         '#B8741F', 3),
  (4,  'marketing',       'Marketing',                    '#B23E6E', 4),
  (5,  'operations',      'Operations & Supply Chain',    '#2B6F96', 5),
  (6,  'hr-ob',           'HR & Organisational Behaviour','#7A5A33', 6),
  (7,  'analytics',       'Information Systems & Analytics','#0E7C7E', 7),
  (8,  'economics',       'Economics & Public Policy',    '#9C3434', 8),
  (9,  'entrepreneurship','Entrepreneurship',             '#8C7A12', 9),
  (10, 'healthcare',      'Healthcare Management',        '#4F7426', 10)
on conflict (id) do nothing;

insert into public.net_feature_flags (key, enabled) values
  ('tap', true), ('map', true), ('overlap', true), ('galaxy', false), ('digital_pass', true)
on conflict (key) do nothing;

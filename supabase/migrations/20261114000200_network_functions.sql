-- pan-iim-network: core functions (K-21..K-28, K-32, K-33, K-62, K-81)
-- Every function: SECURITY DEFINER, search_path = '' (fully qualified names), caller from auth.uid().
-- Expected failures return {"error": "<code>"}; a missing session raises 'net:auth'.
-- Privacy order is always: block, then scope, then field rules (docs/spec/privacy-matrix.md).

-- ---------------------------------------------------------------- internal helpers (never granted to clients)

create or replace function public.net__consent_version()
returns text language sql immutable set search_path = '' as $$ select 'v1-2026-11-14' $$;

create or replace function public.net__uid()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'net:auth' using errcode = 'P0001'; end if;
  return u;
end $$;

create or replace function public.net__flag(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select f.enabled from public.net_feature_flags f where f.key = p_key), false)
$$;

create or replace function public.net__blocked(p_x uuid, p_y uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.net_blocks k
                 where (k.blocker = p_x and k.blocked = p_y) or (k.blocker = p_y and k.blocked = p_x))
$$;

create or replace function public.net__met(p_x uuid, p_y uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.net_connections c
                 where c.a = least(p_x, p_y) and c.b = greatest(p_x, p_y) and c.removed_at is null)
$$;

create or replace function public.net__granted(p_owner uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.net_contact_grants g
                 where g.owner = p_owner and g.viewer = p_viewer and g.revoked_at is null)
$$;

create or replace function public.net__is_person(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.net_people p where p.user_id = p_id)
$$;

-- Relationship of viewer v to owner o: self | blocked | accepted | met | stranger
create or replace function public.net__relation(p_v uuid, p_o uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if p_v = p_o then return 'self'; end if;
  if public.net__blocked(p_v, p_o) then return 'blocked'; end if;
  if public.net__granted(p_o, p_v) then return 'accepted'; end if;
  if public.net__met(p_v, p_o) then return 'met'; end if;
  return 'stranger';
end $$;

-- Block, then scope. p_via_card: a physical tap or scan of the owner's active card passes scope, never a block.
create or replace function public.net__can_see(p_v uuid, p_o uuid, p_via_card boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  rel text;
  scope text;
  v_presenter boolean;
  v_registered boolean;
begin
  if p_v is null or p_o is null then return false; end if;
  if not public.net__is_person(p_o) then return false; end if;
  rel := public.net__relation(p_v, p_o);
  if rel = 'self' then return true; end if;
  if rel = 'blocked' then return false; end if;
  if p_via_card then return true; end if;
  if rel in ('met', 'accepted') then return true; end if;
  select coalesce((select e.visibility_scope from public.net_profile_ext e where e.user_id = p_o), 'presenters') into scope;
  select coalesce(bool_or(p.is_presenter), false), coalesce(bool_or(p.is_registered), false)
    into v_presenter, v_registered
    from public.net_people p where p.user_id = p_v;
  if scope = 'presenters' then return v_presenter; end if;
  if scope = 'all' then return v_registered; end if;
  return false; -- 'met'
end $$;

create or replace function public.net__themes_json(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'label', t.label, 'colour', t.colour, 'rank', pt.rank)
                            order by pt.rank), '[]'::jsonb)
  from public.net_profile_themes pt join public.net_themes t on t.id = pt.theme_id
  where pt.user_id = p_user
$$;

-- Field rules. p_level: self | tap | directory | met | accepted | second
--   tap        stranger who tapped or scanned the owner's card
--   directory  in-scope stranger reached by search, detail or overlap (DECISIONS E-12)
--   second     friend-of-friend node on the map
create or replace function public.net__person(p_o uuid, p_level text, p_via_tap boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.net_people%rowtype;
  e public.net_profile_ext%rowtype;
  out jsonb;
  cf text[];
  contact jsonb;
begin
  select * into p from public.net_people x where x.user_id = p_o limit 1;
  if not found then return null; end if;
  select * into e from public.net_profile_ext x where x.user_id = p_o;
  cf := coalesce(e.contact_fields, array['email']::text[]);

  out := jsonb_build_object(
    'id', p.user_id,
    'name', p.display_name,
    'institute', p.institute,
    'role_label', p.role_label,
    'role_kind', p.role_kind,
    'photo_url', p.photo_url,
    'headline', e.headline,
    'key_finding', p.key_finding,
    'themes', public.net__themes_json(p_o),
    'ask_text', e.ask_text,
    'offer_text', e.offer_text,
    'is_presenter', p.is_presenter
  );

  if p_level <> 'second' then
    out := out || jsonb_build_object(
      'bio', e.bio,
      'paper_title', p.paper_title,
      'paper_url', p.paper_url,
      'slides_url', p.slides_url,
      'session_id', p.session_id,
      'session_title', p.session_title,
      'session_start', p.session_start,
      'room', p.room
    );
  end if;

  if p_level in ('self', 'met', 'accepted') then
    out := out || jsonb_build_object(
      'interests', to_jsonb(coalesce(e.interests, '{}'::text[])),
      'ask_me_about', to_jsonb(coalesce(e.ask_me_about, '{}'::text[])),
      'open_to', to_jsonb(coalesce(e.open_to, '{}'::text[]))
    );
  end if;

  if p_level = 'self' then
    cf := array['email','phone','linkedin']::text[];
  end if;
  if p_level in ('self', 'accepted') or (p_via_tap and p_level <> 'second' and coalesce(e.share_on_tap, false)) then
    contact := '{}'::jsonb;
    if 'email' = any(cf) then contact := contact || jsonb_build_object('email', p.email); end if;
    if 'phone' = any(cf) then contact := contact || jsonb_build_object('phone', p.phone); end if;
    if 'linkedin' = any(cf) then contact := contact || jsonb_build_object('linkedin', p.linkedin); end if;
    out := out || jsonb_build_object('contact', contact);
  end if;

  return out;
end $$;

create or replace function public.net__level(p_rel text, p_path text)
returns text language sql immutable set search_path = '' as $$
  select case p_rel when 'self' then 'self' when 'accepted' then 'accepted' when 'met' then 'met'
                    else case when p_path = 'tap' then 'tap' else 'directory' end end
$$;

create or replace function public.net__mutual_ids(p_x uuid, p_y uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  with cx as (
    select case when c.a = p_x then c.b else c.a end as id from public.net_connections c
    where (c.a = p_x or c.b = p_x) and c.removed_at is null
  ), cy as (
    select case when c.a = p_y then c.b else c.a end as id from public.net_connections c
    where (c.a = p_y or c.b = p_y) and c.removed_at is null
  )
  select cx.id from cx join cy on cx.id = cy.id
  where not public.net__blocked(p_x, cx.id) and not public.net__blocked(p_y, cx.id)
$$;

-- Normalise a /t/ parameter. 16 chars: Crockford token (I,L -> 1, O -> 0). 6 chars: printed code.
create or replace function public.net__norm_ref(p_ref text)
returns text language sql immutable set search_path = '' as $$
  select translate(upper(regexp_replace(coalesce(p_ref, ''), '[\s-]', '', 'g')), 'ILO', '110')
$$;

create or replace function public.net__hash_token(p_token text)
returns bytea language sql immutable set search_path = '' as $$
  select pg_catalog.sha256(convert_to(public.net__norm_ref(p_token), 'UTF8'))
$$;

-- Find a card from a token (16) or printed code (6). Codes never resolve unbound cards (activation secret).
create or replace function public.net__card_by_ref(p_ref text)
returns public.net_cards language plpgsql stable security definer set search_path = '' as $$
declare
  r text := public.net__norm_ref(p_ref);
  c public.net_cards%rowtype;
begin
  if char_length(r) = 16 and r ~ '^[0-9A-HJKMNP-TV-Z]{16}$' then
    select * into c from public.net_cards x where x.token_hash = public.net__hash_token(r);
  elsif char_length(r) = 6 then
    select * into c from public.net_cards x
      where x.printed_code = upper(regexp_replace(coalesce(p_ref, ''), '[\s-]', '', 'g')) and x.status <> 'unbound';
  end if;
  return c; -- all-null row when not found
end $$;

create or replace function public.net__rate_ok(p_viewer uuid, p_bucket text, p_kind text, p_max int, p_window interval)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.net_tap_events t
          where t.kind = p_kind and t.at > now() - p_window
            and ((p_viewer is not null and t.viewer = p_viewer) or (p_viewer is null and t.bucket = p_bucket))) < p_max
$$;

create or replace function public.net__ip_bucket()
returns text language plpgsql stable security definer set search_path = '' as $$
declare h text;
begin
  begin
    h := coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for';
  exception when others then h := null;
  end;
  return encode(pg_catalog.sha256(convert_to(coalesce(split_part(h, ',', 1), 'none'), 'UTF8')), 'hex');
end $$;

create or replace function public.net__audit(p_action text, p_subject text, p_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.net_audit (actor, action, subject, detail) values (auth.uid(), p_action, p_subject, p_detail)
$$;

create or replace function public.net__ensure_ext(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.net_profile_ext (user_id) values (p_user) on conflict (user_id) do nothing
$$;

create or replace function public.net__random_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea := pg_catalog.uuid_send(gen_random_uuid());
  s text := '';
  i int;
begin
  for i in 0..5 loop
    s := s || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return s;
end $$;

-- Upsert or revive an edge (canonical order). Returns true when a new active edge was created.
create or replace function public.net__upsert_edge(p_me uuid, p_other uuid, p_source text, p_context text,
                                                   p_session text, p_card uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  lo uuid := least(p_me, p_other);
  hi uuid := greatest(p_me, p_other);
  existing public.net_connections%rowtype;
begin
  select * into existing from public.net_connections c where c.a = lo and c.b = hi for update;
  if not found then
    insert into public.net_connections (a, b, initiator, source, context, card_id, session_id)
    values (lo, hi, p_me, p_source, p_context, p_card, p_session);
    return true;
  elsif existing.removed_at is not null then
    update public.net_connections c
       set initiator = p_me, source = p_source, context = p_context, card_id = p_card, session_id = p_session,
           created_at = now(), removed_at = null, removed_by = null
     where c.a = lo and c.b = hi;
    return true;
  end if;
  return false;
end $$;

-- D-5: which sources draw an edge. Edit here to widen (for example add 'table').
create or replace function public.net__edge_sources()
returns text[] language sql immutable set search_path = '' as $$ select array['tap','scan','coffee']::text[] $$;

-- Log a meeting and draw an edge when allowed (DECISIONS E-07).
create or replace function public.net__record(p_me uuid, p_other uuid, p_source text, p_context text, p_session text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  reciprocal boolean;
begin
  insert into public.net_meetings (actor, other, source, context, session_id)
  values (p_me, p_other, p_source, left(p_context, 120), p_session);
  if not (p_source = any(public.net__edge_sources())) then return false; end if;
  select exists (select 1 from public.net_meetings m
                 where m.actor = p_other and m.other = p_me and m.at > now() - interval '14 days')
    into reciprocal;
  if reciprocal or public.net_host_confirms_meeting(p_me, p_other, p_source) then
    perform public.net__upsert_edge(p_me, p_other, p_source, left(p_context, 120), p_session, null);
    return true;
  end if;
  return false;
end $$;

-- ---------------------------------------------------------------- flags and themes

create or replace function public.net_get_feature_flags()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tap', public.net__flag('tap'), 'map', public.net__flag('map'), 'overlap', public.net__flag('overlap'),
    'galaxy', public.net__flag('galaxy'), 'digital_pass', public.net__flag('digital_pass'))
$$;

create or replace function public.net_list_themes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'label', t.label, 'colour', t.colour)
                            order by t.sort, t.id), '[]'::jsonb)
  from public.net_themes t
$$;

-- ---------------------------------------------------------------- tap flow

-- anon. No personal data. Lets the signed-out tap screen choose: sign in, replaced, unknown, paused.
create or replace function public.net_resolve_token(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.net_cards%rowtype;
  bucket text := public.net__ip_bucket();
  st text;
begin
  if not public.net__flag('tap') then return jsonb_build_object('state', 'paused'); end if;
  if not public.net__rate_ok(null, bucket, 'resolve', 60, interval '1 minute') then
    return jsonb_build_object('state', 'limited');
  end if;
  c := public.net__card_by_ref(p_token);
  st := case when c.id is null then 'unknown' else c.status end;
  insert into public.net_tap_events (viewer, bucket, kind, token_hash, result)
  values (auth.uid(), bucket, 'resolve', c.token_hash, st);
  return jsonb_build_object('state', st);
end $$;

-- Signed in. Read-only for the graph (writes only an audit/rate-limit event). Never creates a connection.
create or replace function public.net_get_profile_by_token(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  c public.net_cards%rowtype;
  rel text;
  owner_session text;
  my_session text;
  result text;
begin
  if not public.net__flag('tap') then return jsonb_build_object('state', 'paused'); end if;
  if not public.net__rate_ok(me, null, 'profile', 30, interval '1 minute') then
    return jsonb_build_object('state', 'limited');
  end if;
  c := public.net__card_by_ref(p_token);

  if c.id is null then result := 'unknown';
  elsif c.status = 'revoked' then result := 'revoked';
  elsif c.status = 'unbound' then result := 'unbound';
  elsif not public.net__is_person(c.user_id) then result := 'unknown';
  else
    rel := public.net__relation(me, c.user_id);
    result := case rel when 'blocked' then 'unknown' when 'self' then 'self' else 'active' end;
  end if;

  insert into public.net_tap_events (viewer, kind, token_hash, result) values (me, 'profile', c.token_hash, result);

  if result in ('unknown', 'revoked', 'unbound') then
    return jsonb_build_object('state', result);
  end if;
  if result = 'self' then
    return jsonb_build_object('state', 'self', 'person', public.net__person(me, 'self'));
  end if;

  select p.session_id into owner_session from public.net_people p where p.user_id = c.user_id limit 1;
  select p.session_id into my_session from public.net_people p where p.user_id = me limit 1;

  return jsonb_build_object(
    'state', 'active',
    'person', public.net__person(c.user_id, public.net__level(rel, 'tap'), true),
    'connection', jsonb_build_object('state', case when public.net__met(me, c.user_id) then 'connected' else 'none' end),
    'mutual_count', (select count(*) from public.net__mutual_ids(me, c.user_id)),
    'in_your_session', (owner_session is not null and owner_session = my_session)
  );
end $$;

-- Idempotent connect after the tap screen renders. Physical card passes scope, never a block.
create or replace function public.net_connect_via_card(p_token text, p_source text default 'tap',
                                                       p_session_id text default null, p_context text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  c public.net_cards%rowtype;
  created boolean;
  owner_share boolean;
begin
  if not public.net__flag('tap') then return jsonb_build_object('error', 'paused'); end if;
  if p_source not in ('tap', 'scan') then return jsonb_build_object('error', 'bad_source'); end if;
  if not public.net__rate_ok(me, null, 'connect', 60, interval '1 minute') then
    return jsonb_build_object('error', 'limited');
  end if;
  c := public.net__card_by_ref(p_token);
  insert into public.net_tap_events (viewer, kind, token_hash, result)
  values (me, 'connect', c.token_hash, coalesce(c.status, 'unknown'));

  if c.id is null or c.status <> 'active' or public.net__blocked(me, c.user_id)
     or not public.net__is_person(c.user_id) then
    return jsonb_build_object('error', 'unknown');
  end if;
  if c.user_id = me then return jsonb_build_object('error', 'self'); end if;

  created := public.net__upsert_edge(me, c.user_id, p_source, left(p_context, 120), p_session_id, c.id);
  insert into public.net_meetings (actor, other, source, context, session_id)
  values (me, c.user_id, p_source, left(p_context, 120), p_session_id);

  select coalesce((select e.share_on_tap from public.net_profile_ext e where e.user_id = c.user_id), false) into owner_share;
  if owner_share then
    insert into public.net_contact_grants (owner, viewer, source) values (c.user_id, me, 'share_on_tap')
    on conflict (owner, viewer) do update set revoked_at = null, granted_at = now(), source = excluded.source
      where public.net_contact_grants.revoked_at is not null;
  end if;

  return jsonb_build_object('created', created, 'other_id', c.user_id, 'undo_seconds', 8);
end $$;

-- Initiator only, within 8 seconds (plus 1 s network grace) of creation.
create or replace function public.net_undo_connection(p_other uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  n int;
begin
  update public.net_connections c
     set removed_at = now(), removed_by = me
   where c.a = least(me, p_other) and c.b = greatest(me, p_other)
     and c.removed_at is null and c.initiator = me and c.created_at > now() - interval '9 seconds';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'expired'); end if;
  update public.net_contact_grants g set revoked_at = now()
   where g.owner = p_other and g.viewer = me and g.source = 'share_on_tap' and g.revoked_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- The single write path for every non-card meeting source.
create or replace function public.net_record_meeting(p_other uuid, p_source text, p_context text default null,
                                                     p_session_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  edge boolean;
begin
  if p_source not in ('tap','scan','coffee','circle','office_hours','table') then
    return jsonb_build_object('error', 'bad_source');
  end if;
  if p_other = me then return jsonb_build_object('error', 'self'); end if;
  if not public.net__is_person(p_other) or public.net__blocked(me, p_other) then
    return jsonb_build_object('error', 'unknown');
  end if;
  if not public.net__rate_ok(me, null, 'meeting', 60, interval '1 minute') then
    return jsonb_build_object('error', 'limited');
  end if;
  insert into public.net_tap_events (viewer, kind, result) values (me, 'meeting', p_source);
  edge := public.net__record(me, p_other, p_source, p_context, p_session_id);
  return jsonb_build_object('recorded', true, 'edge', edge);
end $$;

-- ---------------------------------------------------------------- cards and pass

create or replace function public.net_activate_card(p_code text, p_scope text default 'presenters',
                                                    p_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  c public.net_cards%rowtype;
  cur public.net_cards%rowtype;
begin
  if p_scope not in ('presenters', 'all', 'met') then return jsonb_build_object('error', 'bad_scope'); end if;
  if not public.net__rate_ok(me, null, 'activate_fail', 10, interval '1 hour') then
    return jsonb_build_object('error', 'limited');
  end if;
  select * into c from public.net_cards x where x.printed_code = code and x.status = 'unbound' for update;
  if not found or (p_token is not null and c.token_hash is distinct from public.net__hash_token(p_token)) then
    insert into public.net_tap_events (viewer, kind, result) values (me, 'activate_fail', 'bad_code');
    return jsonb_build_object('error', 'bad_code');
  end if;
  select * into cur from public.net_cards x where x.user_id = me and x.status = 'active' for update;
  if found and cur.chip <> 'virtual' then return jsonb_build_object('error', 'already_active'); end if;
  if found then
    update public.net_cards x set status = 'revoked', revoked_at = now() where x.id = cur.id;
  end if;

  update public.net_cards x set status = 'active', user_id = me, bound_at = now(), bound_by = me where x.id = c.id;
  perform public.net__ensure_ext(me);
  update public.net_profile_ext e set visibility_scope = p_scope, updated_at = now() where e.user_id = me;
  insert into public.net_consents (user_id, key, value, text_version)
  values (me, 'visibility_scope', to_jsonb(p_scope), public.net__consent_version());
  perform public.net__audit('activate_card', c.id::text, jsonb_build_object('code', c.printed_code, 'self', true));
  return jsonb_build_object('ok', true, 'card_id', c.id, 'printed_code', c.printed_code);
end $$;

create or replace function public.net_report_lost_card()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  n int;
begin
  update public.net_cards x set status = 'revoked', revoked_at = now()
   where x.user_id = me and x.status = 'active' and x.chip <> 'virtual';
  get diagnostics n = row_count;
  perform public.net__audit('report_lost_card', me::text, jsonb_build_object('revoked', n));
  return jsonb_build_object('ok', true, 'revoked', n);
end $$;

create or replace function public.net_get_my_pass()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  c public.net_cards%rowtype;
begin
  select * into c from public.net_cards x where x.user_id = me
   order by (x.status = 'active') desc, coalesce(x.revoked_at, x.bound_at, x.created_at) desc limit 1;
  return jsonb_build_object(
    'card', case when c.id is null then null else jsonb_build_object(
      'status', c.status, 'printed_code', case when c.status = 'active' then c.printed_code end,
      'chip', c.chip, 'virtual', c.chip = 'virtual', 'bound_at', c.bound_at, 'revoked_at', c.revoked_at) end,
    'digital_pass_allowed', public.net__flag('digital_pass') and public.net__is_person(me)
  );
end $$;

create or replace function public.net_issue_digital_pass()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  code text;
  tries int := 0;
begin
  if not public.net__flag('digital_pass') then return jsonb_build_object('error', 'paused'); end if;
  if not public.net__is_person(me) then return jsonb_build_object('error', 'not_registered'); end if;
  if exists (select 1 from public.net_cards x where x.user_id = me and x.status = 'active') then
    return public.net_get_my_pass();
  end if;
  loop
    code := public.net__random_code();
    exit when not exists (select 1 from public.net_cards x where x.printed_code = code);
    tries := tries + 1;
    if tries > 20 then return jsonb_build_object('error', 'try_again'); end if;
  end loop;
  insert into public.net_cards (printed_code, chip, status, user_id, bound_at, bound_by, batch)
  values (code, 'virtual', 'active', me, now(), me, 'digital');
  perform public.net__ensure_ext(me);
  perform public.net__audit('issue_digital_pass', me::text, jsonb_build_object('code', code));
  return public.net_get_my_pass();
end $$;

-- ---------------------------------------------------------------- settings and consent

create or replace function public.net_get_my_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  e public.net_profile_ext%rowtype;
  p public.net_people%rowtype;
begin
  select * into e from public.net_profile_ext x where x.user_id = me;
  select * into p from public.net_people x where x.user_id = me limit 1;
  return jsonb_build_object(
    'visibility_scope', coalesce(e.visibility_scope, 'presenters'),
    'share_on_tap', coalesce(e.share_on_tap, false),
    'second_degree', coalesce(e.second_degree, false),
    'discoverable', coalesce(e.discoverable, false),
    'contact_fields', to_jsonb(coalesce(e.contact_fields, array['email']::text[])),
    'followup_reminder', coalesce(e.followup_reminder, false),
    'headline', e.headline, 'bio', e.bio, 'ask_text', e.ask_text, 'offer_text', e.offer_text,
    'interests', to_jsonb(coalesce(e.interests, '{}'::text[])),
    'ask_me_about', to_jsonb(coalesce(e.ask_me_about, '{}'::text[])),
    'open_to', to_jsonb(coalesce(e.open_to, '{}'::text[])),
    'themes', public.net__themes_json(me),
    'consent_version', public.net__consent_version(),
    'registered', p.user_id is not null,
    'is_presenter', coalesce(p.is_presenter, false),
    'name', p.display_name,
    'has_contact', jsonb_build_object('email', p.email is not null, 'phone', p.phone is not null,
                                      'linkedin', p.linkedin is not null)
  );
end $$;

-- Appends a consent row and applies the setting. Takes effect on the next request.
create or replace function public.net_set_consent(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  arr text[];
begin
  perform public.net__ensure_ext(me);
  if p_key = 'visibility_scope' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') not in ('presenters', 'all', 'met') then
      return jsonb_build_object('error', 'bad_value');
    end if;
    update public.net_profile_ext e set visibility_scope = p_value #>> '{}', updated_at = now() where e.user_id = me;
  elsif p_key in ('share_on_tap', 'second_degree', 'discoverable', 'followup_reminder') then
    if jsonb_typeof(p_value) <> 'boolean' then return jsonb_build_object('error', 'bad_value'); end if;
    execute format('update public.net_profile_ext set %I = $1, updated_at = now() where user_id = $2', p_key)
      using (p_value #>> '{}')::boolean, me;
  elsif p_key = 'contact_fields' then
    if jsonb_typeof(p_value) <> 'array' then return jsonb_build_object('error', 'bad_value'); end if;
    select coalesce(array_agg(distinct v), '{}') into arr from jsonb_array_elements_text(p_value) v;
    if not (arr <@ array['email','phone','linkedin']::text[]) then return jsonb_build_object('error', 'bad_value'); end if;
    update public.net_profile_ext e set contact_fields = arr, updated_at = now() where e.user_id = me;
  else
    return jsonb_build_object('error', 'bad_key');
  end if;
  insert into public.net_consents (user_id, key, value, text_version)
  values (me, p_key, p_value, public.net__consent_version());
  return public.net_get_my_settings();
end $$;

-- Profile extension edited in onboarding step 2 or the module's editor (K-30, K-31).
create or replace function public.net_update_profile_ext(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  ids smallint[];
  arr_interests text[];
  arr_ask text[];
  arr_open text[];
begin
  if not public.net__is_person(me) then return jsonb_build_object('error', 'not_registered'); end if;
  perform public.net__ensure_ext(me);
  begin
    select coalesce(array_agg(trim(v)) filter (where trim(v) <> ''), '{}') into arr_interests
      from jsonb_array_elements_text(coalesce(p -> 'interests', '[]')) v;
    select coalesce(array_agg(trim(v)) filter (where trim(v) <> ''), '{}') into arr_ask
      from jsonb_array_elements_text(coalesce(p -> 'ask_me_about', '[]')) v;
    select coalesce(array_agg(trim(v)) filter (where trim(v) <> ''), '{}') into arr_open
      from jsonb_array_elements_text(coalesce(p -> 'open_to', '[]')) v;
    update public.net_profile_ext e set
      headline = nullif(trim(p ->> 'headline'), ''),
      bio = nullif(trim(p ->> 'bio'), ''),
      ask_text = nullif(trim(p ->> 'ask_text'), ''),
      offer_text = nullif(trim(p ->> 'offer_text'), ''),
      interests = case when p ? 'interests' then arr_interests else e.interests end,
      ask_me_about = case when p ? 'ask_me_about' then arr_ask else e.ask_me_about end,
      open_to = case when p ? 'open_to' then arr_open else e.open_to end,
      updated_at = now()
    where e.user_id = me;
  exception when check_violation then
    return jsonb_build_object('error', 'invalid');
  end;

  if p ? 'theme_ids' then
    select coalesce(array_agg(distinct (v)::smallint), '{}') into ids from jsonb_array_elements_text(p -> 'theme_ids') v;
    if cardinality(ids) > 3 then return jsonb_build_object('error', 'too_many_themes'); end if;
    delete from public.net_profile_themes t where t.user_id = me;
    insert into public.net_profile_themes (user_id, theme_id, rank)
    select me, d.id, (row_number() over (order by d.o))::smallint
    from (select (v.value)::smallint as id, min(v.ordinality) as o
          from jsonb_array_elements_text(p -> 'theme_ids') with ordinality v
          where exists (select 1 from public.net_themes t where t.id = (v.value)::smallint)
          group by (v.value)::smallint) d;
  end if;

  perform public.net_refresh_similarity(me);
  return public.net_get_my_settings();
end $$;

-- Removes the caller's card link, connections, notes, grants, meetings and extension row (DECISIONS E-14).
create or replace function public.net_withdraw_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  n_conn int; n_notes int; n_cards int;
begin
  delete from public.net_connections c where c.a = me or c.b = me;
  get diagnostics n_conn = row_count;
  delete from public.net_person_notes n where n.author = me or n.about = me;
  get diagnostics n_notes = row_count;
  delete from public.net_contact_grants g where g.owner = me or g.viewer = me;
  delete from public.net_meetings m where m.actor = me or m.other = me;
  delete from public.net_similarity_edges s where s.a = me or s.b = me;
  delete from public.net_profile_themes t where t.user_id = me;
  delete from public.net_profile_ext e where e.user_id = me;
  update public.net_cards x set status = 'revoked', revoked_at = now() where x.user_id = me and x.status = 'active';
  get diagnostics n_cards = row_count;
  insert into public.net_consents (user_id, key, value, text_version)
  values (me, 'withdraw_all', 'true'::jsonb, public.net__consent_version());
  perform public.net__audit('withdraw_all', me::text, jsonb_build_object('connections', n_conn, 'cards', n_cards));
  return jsonb_build_object('ok', true, 'connections', n_conn, 'notes', n_notes, 'cards', n_cards);
end $$;

-- ---------------------------------------------------------------- contact grants (ADDITION, data-contract NEW)

create or replace function public.net_grant_contact(p_viewer uuid, p_source text default 'manual')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
begin
  if p_source not in ('coffee', 'manual') then return jsonb_build_object('error', 'bad_source'); end if;
  if p_viewer = me then return jsonb_build_object('error', 'self'); end if;
  if not public.net__is_person(p_viewer) or public.net__blocked(me, p_viewer) then
    return jsonb_build_object('error', 'unknown');
  end if;
  insert into public.net_contact_grants (owner, viewer, source) values (me, p_viewer, p_source)
  on conflict (owner, viewer) do update set revoked_at = null, granted_at = now(), source = excluded.source;
  if p_source = 'coffee' then
    perform public.net__record(me, p_viewer, 'coffee', null, null);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_revoke_contact(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  update public.net_contact_grants g set revoked_at = now()
   where g.owner = me and g.viewer = p_viewer and g.revoked_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- profile detail (K-33)

-- Path from viewer to owner of up to 3 hops, through people the viewer may see. Null if none.
create or replace function public.net__path_to(p_me uuid, p_o uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  x uuid; y uuid;
begin
  if public.net__met(p_me, p_o) then
    return jsonb_build_array(p_me, p_o);
  end if;
  select m into x from public.net__mutual_ids(p_me, p_o) m limit 1;
  if x is not null then return jsonb_build_array(p_me, x, p_o); end if;
  -- me - x - y - o : y must be visible to me as a second-degree person
  select d.id, s.id into x, y
  from (select case when c.a = p_me then c.b else c.a end as id from public.net_connections c
        where (c.a = p_me or c.b = p_me) and c.removed_at is null) d
  join lateral (select case when c2.a = d.id then c2.b else c2.a end as id from public.net_connections c2
                where (c2.a = d.id or c2.b = d.id) and c2.removed_at is null) s on s.id <> p_me
  where public.net__met(s.id, p_o)
    and coalesce((select e.second_degree from public.net_profile_ext e where e.user_id = s.id), false)
    and public.net__can_see(p_me, s.id)
    and not public.net__blocked(p_o, d.id) and not public.net__blocked(p_o, s.id)
  limit 1;
  if y is not null then return jsonb_build_array(p_me, x, y, p_o); end if;
  return null;
end $$;

create or replace function public.net_get_profile_detail(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  rel text;
  lvl text;
  conn public.net_connections%rowtype;
  path jsonb;
  path_named jsonb;
  mutual jsonb;
  shared jsonb;
  note text;
begin
  if not public.net__can_see(me, p_user) then return null; end if;
  rel := public.net__relation(me, p_user);
  lvl := public.net__level(rel, 'directory');
  if rel = 'self' then
    return jsonb_build_object('person', public.net__person(me, 'self'), 'relation', jsonb_build_object('self', true));
  end if;

  select * into conn from public.net_connections c
   where c.a = least(me, p_user) and c.b = greatest(me, p_user) and c.removed_at is null;

  if lvl in ('met', 'accepted') then
    select jsonb_build_object('count', count(*),
             'people', coalesce(jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.display_name)
                                          order by p.display_name) filter (where p.user_id is not null), '[]'::jsonb))
      into mutual
      from public.net__mutual_ids(me, p_user) m left join public.net_people p on p.user_id = m;
  else
    select jsonb_build_object('count', count(*)) into mutual from public.net__mutual_ids(me, p_user);
  end if;

  path := public.net__path_to(me, p_user);
  if path is not null then
    select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', case when p.user_id = me then 'You' else p.display_name end)
                     order by v.ord)
      into path_named
      from jsonb_array_elements_text(path) with ordinality v(id, ord)
      join public.net_people p on p.user_id = v.id::uuid;
  end if;

  select coalesce(jsonb_agg(distinct x.label), '[]'::jsonb) into shared from (
    select 'Same session: ' || pm.session_title as label
      from public.net_people pm join public.net_people po on po.session_id = pm.session_id
     where pm.user_id = me and po.user_id = p_user and pm.session_id is not null
    union
    select 'Both starred: ' || coalesce(pp.session_title, a.session_id)
      from public.net_starred_sessions a join public.net_starred_sessions b on a.session_id = b.session_id
      left join lateral (select x2.session_title from public.net_people x2 where x2.session_id = a.session_id limit 1) pp on true
     where a.user_id = me and b.user_id = p_user
    union
    select 'Both at ' || coalesce(m.context, replace(m.source, '_', ' '))
      from public.net_meetings m
     where m.source in ('table', 'circle', 'office_hours')
       and ((m.actor = me and m.other = p_user) or (m.actor = p_user and m.other = me))
  ) x;

  select n.body into note from public.net_person_notes n where n.author = me and n.about = p_user;

  return jsonb_build_object(
    'person', public.net__person(p_user, lvl),
    'relation', jsonb_build_object(
      'level', lvl,
      'connection', case when conn.a is null then 'none' else 'connected' end,
      'connected_at', conn.created_at,
      'source', conn.source,
      'context', conn.context,
      'initiator_is_me', conn.initiator = me,
      'contact_granted_to_me', rel = 'accepted',
      'i_shared_contact', public.net__granted(me, p_user)
    ),
    'mutual', mutual,
    'path_to_me', path_named,
    'shared_sessions', shared,
    'note', note
  );
end $$;

-- ---------------------------------------------------------------- notes, connections, blocks, reports

create or replace function public.net_set_note(p_about uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if p_about = me or not public.net__is_person(p_about) then return jsonb_build_object('error', 'unknown'); end if;
  if coalesce(trim(p_body), '') = '' then
    delete from public.net_person_notes n where n.author = me and n.about = p_about;
    return jsonb_build_object('ok', true, 'deleted', true);
  end if;
  if char_length(p_body) > 1000 then return jsonb_build_object('error', 'too_long'); end if;
  insert into public.net_person_notes (author, about, body) values (me, p_about, trim(p_body))
  on conflict (author, about) do update set body = excluded.body, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_remove_connection(p_other uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  update public.net_connections c set removed_at = now(), removed_by = me
   where c.a = least(me, p_other) and c.b = greatest(me, p_other) and c.removed_at is null;
  update public.net_contact_grants g set revoked_at = now()
   where g.revoked_at is null and ((g.owner = me and g.viewer = p_other) or (g.owner = p_other and g.viewer = me and g.source = 'share_on_tap'));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_list_connections()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  return coalesce((
    select jsonb_agg(x.row order by x.created_at desc) from (
      select c.created_at, jsonb_build_object(
        'person', public.net__person(o.id, public.net__level(public.net__relation(me, o.id), 'directory')),
        'source', c.source, 'context', c.context, 'session_id', c.session_id, 'created_at', c.created_at,
        'initiator_is_me', c.initiator = me,
        'note', (select n.body from public.net_person_notes n where n.author = me and n.about = o.id),
        'contact_granted_to_me', public.net__granted(o.id, me),
        'i_shared_contact', public.net__granted(me, o.id)
      ) as row
      from public.net_connections c
      cross join lateral (select case when c.a = me then c.b else c.a end as id) o
      where (c.a = me or c.b = me) and c.removed_at is null
        and not public.net__blocked(me, o.id) and public.net__is_person(o.id)
    ) x), '[]'::jsonb);
end $$;

create or replace function public.net_block_user(p_other uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if p_other = me then return jsonb_build_object('error', 'self'); end if;
  if not exists (select 1 from auth.users u where u.id = p_other) then return jsonb_build_object('ok', true); end if;
  insert into public.net_blocks (blocker, blocked) values (me, p_other) on conflict do nothing;
  update public.net_connections c set removed_at = now(), removed_by = me
   where c.a = least(me, p_other) and c.b = greatest(me, p_other) and c.removed_at is null;
  update public.net_contact_grants g set revoked_at = now()
   where g.revoked_at is null and ((g.owner = me and g.viewer = p_other) or (g.owner = p_other and g.viewer = me));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_unblock_user(p_other uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  delete from public.net_blocks k where k.blocker = me and k.blocked = p_other;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_report_user(p_other uuid, p_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if p_reason not in ('spam', 'inappropriate', 'impersonation', 'other') then
    return jsonb_build_object('error', 'bad_reason');
  end if;
  if p_other = me or not exists (select 1 from auth.users u where u.id = p_other) then
    return jsonb_build_object('error', 'unknown');
  end if;
  if (select count(*) from public.net_reports r where r.reporter = me and r.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'limited');
  end if;
  insert into public.net_reports (reporter, reported, reason, note) values (me, p_other, p_reason, left(p_note, 500));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_log_event(p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if p_kind not in ('map_open', 'overlap_open', 'list_open', 'client_error', 'export') then
    return jsonb_build_object('error', 'bad_kind');
  end if;
  if exists (select 1 from public.net_metric_events m
             where m.user_id = me and m.kind = p_kind and m.at > now() - interval '30 seconds') then
    return jsonb_build_object('ok', true, 'throttled', true);
  end if;
  insert into public.net_metric_events (kind, user_id) values (p_kind, me);
  return jsonb_build_object('ok', true);
end $$;

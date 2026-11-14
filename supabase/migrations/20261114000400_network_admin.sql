-- pan-iim-network: desk console, metrics, kill switch, retention (K-27, K-60, K-61, K-62, K-64)
-- Every staff function checks net_is_staff() (defined in host_mapping.sql) and writes net_audit.

create or replace function public.net__require_staff()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if not public.net_is_staff() then raise exception 'net:forbidden' using errcode = 'P0001'; end if;
  return me;
end $$;

create or replace function public.net_admin_whoami()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  return jsonb_build_object('staff', public.net_is_staff(),
                            'role', case when public.net_is_admin() then 'admin' when public.net_is_staff() then 'desk' end);
end $$;

create or replace function public.net__card_json(c public.net_cards)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'printed_code', c.printed_code, 'chip', c.chip, 'status', c.status,
    'user_id', c.user_id, 'user_name', (select p.display_name from public.net_people p where p.user_id = c.user_id limit 1),
    'batch', c.batch, 'bound_at', c.bound_at, 'revoked_at', c.revoked_at, 'created_at', c.created_at)
$$;

create or replace function public.net_admin_find_delegate(p_q text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q text := nullif(trim(coalesce(p_q, '')), '');
begin
  perform public.net__require_staff();
  if q is null or char_length(q) < 2 then return jsonb_build_object('people', '[]'::jsonb); end if;
  return jsonb_build_object('people', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.user_id, 'name', p.display_name, 'institute', p.institute, 'email', p.email,
             'is_presenter', p.is_presenter,
             'card', (select public.net__card_json(c) from public.net_cards c
                      where c.user_id = p.user_id and c.status = 'active' limit 1)) order by p.display_name)
    from (select * from public.net_people x
          where x.display_name ilike '%' || q || '%' or x.email ilike '%' || q || '%' or x.institute ilike '%' || q || '%'
          order by x.display_name limit 25) p), '[]'::jsonb));
end $$;

create or replace function public.net_admin_bind_card(p_user uuid, p_code text, p_scope text default 'presenters')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := public.net__require_staff();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  c public.net_cards%rowtype;
  cur public.net_cards%rowtype;
begin
  if p_scope not in ('presenters', 'all', 'met') then return jsonb_build_object('error', 'bad_scope'); end if;
  if not public.net__is_person(p_user) then return jsonb_build_object('error', 'not_registered'); end if;
  select * into c from public.net_cards x where x.printed_code = code for update;
  if not found then return jsonb_build_object('error', 'bad_code'); end if;
  if c.status <> 'unbound' then return jsonb_build_object('error', 'card_' || c.status); end if;
  select * into cur from public.net_cards x where x.user_id = p_user and x.status = 'active' for update;
  if found and cur.chip <> 'virtual' then return jsonb_build_object('error', 'already_active'); end if;
  if found then update public.net_cards x set status = 'revoked', revoked_at = now() where x.id = cur.id; end if;
  update public.net_cards x set status = 'active', user_id = p_user, bound_at = now(), bound_by = actor where x.id = c.id;
  perform public.net__ensure_ext(p_user);
  if not exists (select 1 from public.net_consents k where k.user_id = p_user and k.key = 'visibility_scope') then
    update public.net_profile_ext e set visibility_scope = p_scope, updated_at = now() where e.user_id = p_user;
    insert into public.net_consents (user_id, key, value, text_version)
    values (p_user, 'visibility_scope', to_jsonb(p_scope), public.net__consent_version() || '+desk');
  end if;
  perform public.net__audit('admin_bind_card', c.id::text, jsonb_build_object('user', p_user, 'code', code));
  return jsonb_build_object('ok', true, 'card_id', c.id);
end $$;

create or replace function public.net_admin_unbind_card(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.net__require_staff();
  update public.net_cards x set status = 'unbound', user_id = null, bound_at = null, bound_by = null
   where x.id = p_card_id and x.status = 'active' and x.chip <> 'virtual';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'not_active'); end if;
  perform public.net__audit('admin_unbind_card', p_card_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_admin_revoke_card(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.net__require_staff();
  update public.net_cards x set status = 'revoked', revoked_at = now() where x.id = p_card_id and x.status <> 'revoked';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'already_revoked'); end if;
  perform public.net__audit('admin_revoke_card', p_card_id::text, null);
  return jsonb_build_object('ok', true);
end $$;

-- Lost card: old token deactivates at once, spare binds (K-27, T17).
create or replace function public.net_admin_swap_lost_card(p_user uuid, p_new_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old_ids uuid[];
  res jsonb;
begin
  perform public.net__require_staff();
  select array_agg(x.id) into old_ids from public.net_cards x where x.user_id = p_user and x.status = 'active';
  update public.net_cards x set status = 'revoked', revoked_at = now() where x.id = any(coalesce(old_ids, '{}'));
  res := public.net_admin_bind_card(p_user, p_new_code);
  if res ? 'error' then raise exception 'net:%', res ->> 'error' using errcode = 'P0001'; end if;
  perform public.net__audit('admin_swap_lost_card', p_user::text, jsonb_build_object('revoked', old_ids, 'new_code', p_new_code));
  return res || jsonb_build_object('revoked', to_jsonb(coalesce(old_ids, '{}')));
exception when raise_exception then
  return jsonb_build_object('error', replace(sqlerrm, 'net:', ''));
end $$;

create or replace function public.net_admin_list_cards(p_status text default null, p_batch text default null,
                                                       p_limit int default 500, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.net__require_staff();
  return jsonb_build_object(
    'cards', coalesce((select jsonb_agg(public.net__card_json(c) order by c.batch, c.printed_code) from (
       select * from public.net_cards x
        where (p_status is null or x.status = p_status) and (p_batch is null or x.batch = p_batch)
        order by x.batch, x.printed_code
        limit least(greatest(coalesce(p_limit, 500), 1), 5000) offset greatest(coalesce(p_offset, 0), 0)) c), '[]'::jsonb),
    'batches', coalesce((select jsonb_agg(jsonb_build_object('batch', b.batch, 'unbound', b.u, 'active', b.a, 'revoked', b.r) order by b.batch)
       from (select x.batch, count(*) filter (where x.status = 'unbound') u, count(*) filter (where x.status = 'active') a,
                    count(*) filter (where x.status = 'revoked') r
             from public.net_cards x group by x.batch) b), '[]'::jsonb));
end $$;

-- Import from tools/card-manifest out/import.json: [{token_hash: hex(64), printed_code, chip, batch}].
create or replace function public.net_admin_import_cards(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inserted int;
  total int := jsonb_array_length(coalesce(p_rows, '[]'));
begin
  perform public.net__require_staff();
  insert into public.net_cards (token_hash, printed_code, chip, batch)
  select decode(r ->> 'token_hash', 'hex'), upper(r ->> 'printed_code'), coalesce(r ->> 'chip', 'ntag213'), r ->> 'batch'
  from jsonb_array_elements(p_rows) r
  where (r ->> 'token_hash') ~ '^[0-9a-f]{64}$'
  on conflict do nothing;
  get diagnostics inserted = row_count;
  perform public.net__audit('admin_import_cards', null, jsonb_build_object('inserted', inserted, 'total', total));
  return jsonb_build_object('inserted', inserted, 'skipped', total - inserted);
end $$;

create or replace function public.net_admin_list_reports(p_status text default 'open')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.net__require_staff();
  return jsonb_build_object('reports', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'note', r.note, 'status', r.status, 'resolution', r.resolution,
      'created_at', r.created_at,
      'reporter', jsonb_build_object('id', r.reporter, 'name', (select p.display_name from public.net_people p where p.user_id = r.reporter limit 1)),
      'reported', jsonb_build_object('id', r.reported, 'name', (select p.display_name from public.net_people p where p.user_id = r.reported limit 1)),
      'reports_against', (select count(*) from public.net_reports r2 where r2.reported = r.reported)) order by r.created_at desc)
    from public.net_reports r where p_status is null or r.status = p_status), '[]'::jsonb));
end $$;

create or replace function public.net_admin_resolve_report(p_id uuid, p_resolution text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.net__require_staff(); n int;
begin
  update public.net_reports r set status = 'resolved', resolution = left(p_resolution, 500), resolved_by = actor, resolved_at = now()
   where r.id = p_id and r.status = 'open';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'not_open'); end if;
  perform public.net__audit('admin_resolve_report', p_id::text, jsonb_build_object('resolution', p_resolution));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.net_admin_metrics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare registered int; completed int;
begin
  perform public.net__require_staff();
  select count(*) into registered from public.net_people p where p.is_registered;
  select count(*) into completed from public.net_people p
   where exists (select 1 from public.net_profile_themes t where t.user_id = p.user_id)
     and exists (select 1 from public.net_profile_ext e where e.user_id = p.user_id and e.headline is not null);
  return jsonb_build_object(
    'as_of', now(),
    'taps_total', (select count(*) from public.net_tap_events t where t.kind = 'profile'),
    'taps_last_hour', (select count(*) from public.net_tap_events t where t.kind = 'profile' and t.at > now() - interval '1 hour'),
    'connections', (select count(*) from public.net_connections c where c.removed_at is null),
    'connections_today', (select count(*) from public.net_connections c where c.removed_at is null and c.created_at > date_trunc('day', now())),
    'activations', (select count(*) from public.net_cards c where c.status = 'active' and c.chip <> 'virtual'),
    'digital_passes', (select count(*) from public.net_cards c where c.status = 'active' and c.chip = 'virtual'),
    'cards_unbound', (select count(*) from public.net_cards c where c.status = 'unbound'),
    'registered', registered,
    'profiles_completed', completed,
    'completion_rate', case when registered = 0 then 0 else round(completed::numeric / registered, 3) end,
    'map_opens', (select count(*) from public.net_metric_events m where m.kind = 'map_open'),
    'overlap_opens', (select count(*) from public.net_metric_events m where m.kind = 'overlap_open'),
    'client_errors', (select count(*) from public.net_metric_events m where m.kind = 'client_error'),
    'rate_limited', (select count(*) from public.net_tap_events t where t.result = 'limited'),
    'reports_open', (select count(*) from public.net_reports r where r.status = 'open'),
    'flags', public.net_get_feature_flags()
  );
end $$;

create or replace function public.net_admin_set_flag(p_key text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.net__require_staff();
  if not public.net_is_admin() then raise exception 'net:forbidden' using errcode = 'P0001'; end if;
  if p_key not in ('tap', 'map', 'overlap', 'galaxy', 'digital_pass') then return jsonb_build_object('error', 'bad_key'); end if;
  insert into public.net_feature_flags (key, enabled) values (p_key, p_enabled)
  on conflict (key) do update set enabled = excluded.enabled;
  perform public.net__audit('admin_set_flag', p_key, jsonb_build_object('enabled', p_enabled));
  return public.net_get_feature_flags();
end $$;

-- K-83: people who asked for a follow-up reminder; organisers email them on 30 Nov.
create or replace function public.net_admin_export_reminders()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.net__require_staff();
  perform public.net__audit('admin_export_reminders', null, null);
  return jsonb_build_object('people', coalesce((
    select jsonb_agg(jsonb_build_object('name', p.display_name, 'email', p.email,
             'connections', (select count(*) from public.net__direct_ids(p.user_id))) order by p.display_name)
    from public.net_profile_ext e join public.net_people p on p.user_id = e.user_id
    where e.followup_reminder), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- jobs (not client-callable)

create or replace function public.net_prune()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n1 int; n2 int;
begin
  delete from public.net_tap_events t where t.at < now() - interval '30 days';
  get diagnostics n1 = row_count;
  delete from public.net_metric_events m where m.at < now() - interval '90 days';
  get diagnostics n2 = row_count;
  return jsonb_build_object('tap_events', n1, 'metric_events', n2);
end $$;

-- 29 Dec 2026 retention (PRD 6.4). Dry run by default; a real run before the date needs p_force.
create or replace function public.net_retention_delete(p_dry_run boolean default true, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare counts jsonb;
begin
  counts := jsonb_build_object(
    'connections', (select count(*) from public.net_connections),
    'meetings', (select count(*) from public.net_meetings),
    'contact_grants', (select count(*) from public.net_contact_grants),
    'person_notes', (select count(*) from public.net_person_notes),
    'tap_events', (select count(*) from public.net_tap_events),
    'similarity_edges', (select count(*) from public.net_similarity_edges),
    'consents', (select count(*) from public.net_consents),
    'blocks', (select count(*) from public.net_blocks),
    'reports', (select count(*) from public.net_reports),
    'profile_ext', (select count(*) from public.net_profile_ext),
    'profile_themes', (select count(*) from public.net_profile_themes),
    'metric_events', (select count(*) from public.net_metric_events),
    'cards_bound', (select count(*) from public.net_cards c where c.user_id is not null));
  if p_dry_run then return jsonb_build_object('dry_run', true, 'would_delete', counts); end if;
  if now() < '2026-12-29'::timestamptz and not p_force then
    return jsonb_build_object('error', 'before_retention_date', 'would_delete', counts);
  end if;

  insert into public.net_aggregates (key, value)
  select k, (counts ->> k)::bigint from jsonb_object_keys(counts) k;

  perform set_config('net.allow_consent_delete', 'on', true);
  delete from public.net_connections;
  delete from public.net_meetings;
  delete from public.net_contact_grants;
  delete from public.net_person_notes;
  delete from public.net_tap_events;
  delete from public.net_similarity_edges;
  delete from public.net_consents;
  delete from public.net_blocks;
  delete from public.net_reports;
  delete from public.net_profile_themes;
  delete from public.net_profile_ext;
  delete from public.net_metric_events;
  update public.net_cards set status = 'revoked', user_id = null, revoked_at = coalesce(revoked_at, now())
   where user_id is not null;
  perform set_config('net.allow_consent_delete', 'off', true);
  insert into public.net_audit (actor, action, detail) values (null, 'retention_delete', counts);
  return jsonb_build_object('dry_run', false, 'deleted', counts);
end $$;

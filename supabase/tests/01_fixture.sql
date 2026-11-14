-- TEST ONLY. A fake host: nettest.people backs net_people; helpers call RPCs as a given role and user.
create schema if not exists nettest;
create table if not exists nettest.people (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text, institute text, role_label text, role_kind text, photo_url text,
  email text, phone text, linkedin text, paper_title text, paper_url text, slides_url text, key_finding text,
  session_id text, session_title text, session_start timestamptz, room text,
  is_presenter boolean not null default false, is_registered boolean not null default true
);

create or replace view public.net_people with (security_invoker = true) as
select user_id, display_name, institute, role_label, role_kind, photo_url, email, phone, linkedin,
       paper_title, paper_url, slides_url, key_finding, session_id, session_title, session_start, room,
       is_presenter, is_registered
from nettest.people;
revoke all on public.net_people from public, anon, authenticated;

-- Creates a person. Name doubles as a readable id in failures.
create or replace function nettest.person(p_name text, p_presenter boolean default true, p_session text default null)
returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (u, lower(replace(p_name, ' ', '.')) || '@test.invalid');
  insert into nettest.people (user_id, display_name, institute, role_label, role_kind, email, phone, linkedin,
                              paper_title, session_id, session_title, room, is_presenter, is_registered)
  values (u, p_name, 'IIM Test', 'Faculty', 'faculty', lower(replace(p_name, ' ', '.')) || '@test.invalid',
          '+91 90000 00000', 'https://linkedin.example/' || u, case when p_presenter then 'Paper of ' || p_name end,
          p_session, case when p_session is not null then 'Session ' || p_session end, 'C-2', p_presenter, true);
  return u;
end $$;

-- Call public.<fn>(<args>) as role 'authenticated' with auth.uid() = p_user (or as 'anon' when p_user is null).
create or replace function nettest.call(p_user uuid, p_sql text)
returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role":"anon"}' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  if p_user is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
  begin
    execute 'select ' || p_sql into r;
  exception when others then
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    raise;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return r;
end $$;

-- Assertion helper with a readable message.
create or replace function nettest.ok(p_cond boolean, p_msg text)
returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_msg; end if;
end $$;

create or replace function nettest.keys(p jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(k order by k), '{}') from jsonb_object_keys(coalesce(p, '{}')) k
$$;

create or replace function nettest.reset()
returns void language plpgsql as $$
begin
  perform set_config('net.allow_consent_delete', 'on', true);
  truncate public.net_connections, public.net_meetings, public.net_contact_grants, public.net_blocks,
           public.net_reports, public.net_person_notes, public.net_tap_events, public.net_similarity_edges,
           public.net_profile_themes, public.net_profile_ext, public.net_cards, public.net_staff, public.net_audit,
           public.net_metric_events, public.net_aggregates;
  delete from public.net_consents;
  perform set_config('net.allow_consent_delete', 'off', true);
  update public.net_feature_flags set enabled = (key <> 'galaxy');
  delete from nettest.people;
  delete from auth.users;
end $$;

-- Gives a person an active card whose raw token is p_token.
create or replace function nettest.card(p_user uuid, p_token text, p_code text, p_status text default 'active')
returns uuid language sql as $$
  insert into public.net_cards (token_hash, printed_code, status, user_id, bound_at)
  values (public.net__hash_token(p_token), p_code, p_status, case when p_status = 'active' then p_user end,
          case when p_status = 'active' then now() end)
  returning id
$$;

create or replace function nettest.connect(p_x uuid, p_y uuid)
returns void language sql as $$
  insert into public.net_connections (a, b, initiator, source) values (least(p_x, p_y), greatest(p_x, p_y), p_x, 'tap')
  on conflict (a, b) do update set removed_at = null
$$;

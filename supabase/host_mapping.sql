-- pan-iim-network: HOST MAPPING. The integrator edits this file, and only this file, to point the module at the
-- host's own tables. Read docs/HOST_RECON.md first. Nothing else in the module references host tables.
--
-- Shipped state: stubs that return zero rows / false, so install never fails on an unknown host. With the stub the
-- module installs and its RPCs work, but nobody is "a person" yet, so every profile resolves as unknown.

-- 1. net_people: one row per registered delegate. Column names and types are fixed; only the SELECT changes.
--    security_invoker keeps Lovable's linter quiet; the view is never granted to anon or authenticated, and the
--    module's SECURITY DEFINER functions (owned by postgres) are the only readers.
create or replace view public.net_people with (security_invoker = true) as
select
  null::uuid        as user_id,
  null::text        as display_name,
  null::text        as institute,
  null::text        as role_label,
  null::text        as role_kind,       -- 'faculty' | 'phd' | 'industry' | 'student'
  null::text        as photo_url,
  null::text        as email,
  null::text        as phone,
  null::text        as linkedin,
  null::text        as paper_title,
  null::text        as paper_url,
  null::text        as slides_url,
  null::text        as key_finding,
  null::text        as session_id,
  null::text        as session_title,
  null::timestamptz as session_start,
  null::text        as room,
  false             as is_presenter,
  false             as is_registered
where false;

-- EXAMPLE (ASSUMPTION, adjust to the real host schema, then replace the stub above):
--
-- create or replace view public.net_people with (security_invoker = true) as
-- select
--   p.id                                   as user_id,
--   p.full_name                            as display_name,
--   p.institute                            as institute,
--   p.designation                          as role_label,
--   case when p.designation ilike '%phd%' then 'phd'
--        when p.designation ilike any (array['%professor%','%faculty%','%lecturer%']) then 'faculty'
--        when p.designation ilike '%student%' then 'student'
--        else 'industry' end                as role_kind,
--   p.avatar_url                           as photo_url,
--   p.email, p.phone, p.linkedin_url       as linkedin,
--   pa.title as paper_title, pa.abstract_url as paper_url, pa.slides_url, pa.key_finding,
--   s.id::text as session_id, s.title as session_title, s.starts_at as session_start, s.room,
--   (pa.id is not null)                    as is_presenter,
--   true                                   as is_registered
-- from public.profiles p
-- left join lateral (select * from public.papers x where x.presenter_id = p.id order by x.created_at limit 1) pa on true
-- left join public.sessions s on s.id = pa.session_id;

-- 2. Starred sessions (used by similarity). Stub: none. If the host has a table, select (user_id uuid, session_id text)
--    from it and make net_has_starred_sessions() return true.
create or replace view public.net_starred_sessions with (security_invoker = true) as
select null::uuid as user_id, null::text as session_id where false;

create or replace function public.net_has_starred_sessions()
returns boolean language sql immutable set search_path = '' as $$ select false $$;

-- 3. Staff for the desk console. Default: membership of net_staff (managed with SQL, see docs/ADMIN_RUNBOOK.md).
--    To use a host role table instead, replace the body, for example:
--    select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','volunteer'))
create or replace function public.net_is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.net_staff s where s.user_id = auth.uid())
$$;

-- 4. Host confirmation of a meeting (docs/DECISIONS.md E-07). Return true when the host's own data proves the meeting
--    happened with both people's consent, for example an accepted coffee request between the two users. Default:
--    false, so a one-sided record_meeting never forces an edge onto someone else's map.
--    Example: select exists (select 1 from public.coffee_requests r where r.status = 'accepted'
--               and ((r.requester_id = p_caller and r.recipient_id = p_other) or (r.requester_id = p_other and r.recipient_id = p_caller)))
create or replace function public.net_host_confirms_meeting(p_caller uuid, p_other uuid, p_source text)
returns boolean language sql stable security definer set search_path = '' as $$
  select false
$$;

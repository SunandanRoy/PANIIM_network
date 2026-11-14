-- pan-iim-network: graph, overlap, search and similarity (K-41, K-50, K-53, K-55)

-- Direct connections of p_me that are people and not blocked.
create or replace function public.net__direct_ids(p_me uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select o.id
  from public.net_connections c
  cross join lateral (select case when c.a = p_me then c.b else c.a end as id) o
  where (c.a = p_me or c.b = p_me) and c.removed_at is null
    and not public.net__blocked(p_me, o.id) and public.net__is_person(o.id)
$$;

-- Friends of friends p_me may see: owner opted into second_degree, scope allows, no block.
create or replace function public.net__second_ids(p_me uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  with d as (select public.net__direct_ids(p_me) as id),
  cand as (
    select distinct o.id
    from d
    join public.net_connections c on (c.a = d.id or c.b = d.id) and c.removed_at is null
    cross join lateral (select case when c.a = d.id then c.b else c.a end as id) o
    where o.id <> p_me and o.id not in (select id from d)
  )
  select cand.id from cand
  join public.net_profile_ext e on e.user_id = cand.id and e.second_degree
  where public.net__can_see(p_me, cand.id)
$$;

create or replace function public.net__sim(p_x uuid, p_y uuid)
returns real language sql stable security definer set search_path = '' as $$
  select s.score from public.net_similarity_edges s where s.a = least(p_x, p_y) and s.b = greatest(p_x, p_y)
$$;

-- Ego graph: you, your connections, consenting second-degree people. Cap 300 nodes.
create or replace function public.net_get_ego_graph(p_depth int default 2, p_theme_ids int[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  cap constant int := 300;
  total int;
  nodes jsonb;
  edges jsonb;
begin
  if not public.net__flag('map') then return jsonb_build_object('paused', true); end if;

  create temporary table if not exists net_tmp_nodes (id uuid primary key, depth int, rank_score real) on commit drop;
  truncate pg_temp.net_tmp_nodes;

  insert into pg_temp.net_tmp_nodes values (me, 0, 2);
  insert into pg_temp.net_tmp_nodes
    select d, 1, coalesce(public.net__sim(me, d), 0) + 1 from public.net__direct_ids(me) d
    on conflict do nothing;
  if coalesce(p_depth, 2) >= 2 then
    insert into pg_temp.net_tmp_nodes
      select s, 2, coalesce(public.net__sim(me, s), 0) from public.net__second_ids(me) s
      on conflict do nothing;
  end if;

  if p_theme_ids is not null and cardinality(p_theme_ids) > 0 then
    delete from pg_temp.net_tmp_nodes n
     where n.depth > 0
       and not exists (select 1 from public.net_profile_themes t where t.user_id = n.id and t.theme_id = any(p_theme_ids));
  end if;

  select count(*) into total from pg_temp.net_tmp_nodes;
  if total > cap then
    delete from pg_temp.net_tmp_nodes n where n.id in (
      select x.id from pg_temp.net_tmp_nodes x where x.depth > 0
      order by x.depth asc, x.rank_score desc, x.id offset cap - 1);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.user_id,
             'depth', n.depth,
             'name', case when n.depth = 0 then 'You' else p.display_name end,
             'institute', p.institute,
             'role_label', p.role_label,
             'role_kind', p.role_kind,
             'photo_url', p.photo_url,
             'theme_ids', coalesce((select jsonb_agg(t.theme_id order by t.rank) from public.net_profile_themes t
                                    where t.user_id = n.id), '[]'::jsonb),
             'session_id', case when n.depth <= 1 then p.session_id end,
             'degree', (select count(*) from public.net_connections c
                        where (c.a = n.id or c.b = n.id) and c.removed_at is null),
             'mutual', case when n.depth = 0 then 0 else (select count(*) from public.net__mutual_ids(me, n.id)) end,
             'ask_text', e.ask_text,
             'offer_text', e.offer_text
           ) order by n.depth, p.display_name), '[]'::jsonb)
    into nodes
    from pg_temp.net_tmp_nodes n
    join public.net_people p on p.user_id = n.id
    left join public.net_profile_ext e on e.user_id = n.id;

  -- Only edges touching you or a direct connection, so friends-of-friends' own ties are not exposed.
  select coalesce(jsonb_agg(jsonb_build_object(
           'a', c.a, 'b', c.b, 'source', c.source,
           'sim', public.net__sim(c.a, c.b),
           'direct', (c.a = me or c.b = me))), '[]'::jsonb)
    into edges
    from public.net_connections c
    join pg_temp.net_tmp_nodes na on na.id = c.a
    join pg_temp.net_tmp_nodes nb on nb.id = c.b
   where c.removed_at is null and least(na.depth, nb.depth) <= 1;

  return jsonb_build_object('me', me, 'nodes', nodes, 'edges', edges, 'truncated', total > cap, 'total', total);
end $$;

-- Counts and a small preview for the Network home card (no graph library needed).
create or replace function public.net_get_my_network_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  direct_n int;
  second_n int;
  preview jsonb;
  legend jsonb;
begin
  select count(*) into direct_n from public.net__direct_ids(me);
  select count(*) into second_n from public.net__second_ids(me);

  with d as (select id from public.net__direct_ids(me) id order by id limit 6),
  s as (
    select distinct on (o.id) o.id, d.id as parent
    from d join public.net_connections c on (c.a = d.id or c.b = d.id) and c.removed_at is null
    cross join lateral (select case when c.a = d.id then c.b else c.a end as id) o
    where o.id in (select public.net__second_ids(me))
    limit 12
  )
  select coalesce(jsonb_agg(x.j), '[]'::jsonb) into preview from (
    select jsonb_build_object('id', d.id, 'depth', 1, 'parent', me,
             'colour', (select t.colour from public.net_profile_themes pt join public.net_themes t on t.id = pt.theme_id
                        where pt.user_id = d.id and pt.rank = 1)) as j from d
    union all
    select jsonb_build_object('id', s.id, 'depth', 2, 'parent', s.parent,
             'colour', (select t.colour from public.net_profile_themes pt join public.net_themes t on t.id = pt.theme_id
                        where pt.user_id = s.id and pt.rank = 1)) from s
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label, 'colour', t.colour) order by q.n desc), '[]'::jsonb)
    into legend
    from (select pt.theme_id, count(*) n from public.net_profile_themes pt
          where pt.rank = 1 and (pt.user_id in (select public.net__direct_ids(me)) or pt.user_id in (select public.net__second_ids(me)))
          group by pt.theme_id order by count(*) desc limit 3) q
    join public.net_themes t on t.id = q.theme_id;

  return jsonb_build_object('direct', direct_n, 'within_two', direct_n + second_n, 'preview', preview, 'legend', legend);
end $$;

-- Population for overlap. 'network': people in your graph. 'event': discoverable people you may see.
create or replace function public.net__overlap_population(p_me uuid, p_scope text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select x from public.net__direct_ids(p_me) x where p_scope = 'network'
  union
  select x from public.net__second_ids(p_me) x where p_scope = 'network'
  union
  select p.user_id from public.net_people p
  join public.net_profile_ext e on e.user_id = p.user_id and e.discoverable
  where p_scope = 'event' and p.user_id <> p_me and public.net__can_see(p_me, p.user_id)
$$;

-- Region code from a person's selected-theme membership: A, B, C, AB, AC, BC, ABC (null when none).
create or replace function public.net__region_of(p_user uuid, p_theme_ids int[])
returns text language sql stable security definer set search_path = '' as $$
  select nullif(
    case when exists (select 1 from public.net_profile_themes t where t.user_id = p_user and t.theme_id = p_theme_ids[1]) then 'A' else '' end ||
    case when cardinality(p_theme_ids) >= 2 and exists (select 1 from public.net_profile_themes t where t.user_id = p_user and t.theme_id = p_theme_ids[2]) then 'B' else '' end ||
    case when cardinality(p_theme_ids) >= 3 and exists (select 1 from public.net_profile_themes t where t.user_id = p_user and t.theme_id = p_theme_ids[3]) then 'C' else '' end,
  '')
$$;

create or replace function public.net_venn_counts(p_theme_ids int[], p_scope text default 'network')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  regions jsonb;
  total_scope int;
  total_network int;
  total_event int;
begin
  if not public.net__flag('overlap') then return jsonb_build_object('paused', true); end if;
  if p_theme_ids is null or cardinality(p_theme_ids) not between 1 and 3 then
    return jsonb_build_object('error', 'max_three_themes');
  end if;
  if p_scope not in ('network', 'event') then return jsonb_build_object('error', 'bad_scope'); end if;

  select jsonb_object_agg(r.region, r.n), sum(r.n) into regions, total_scope from (
    select public.net__region_of(x, p_theme_ids) region, count(*) n
    from public.net__overlap_population(me, p_scope) x
    group by 1 having public.net__region_of(x, p_theme_ids) is not null) r;

  select count(*) into total_network from public.net__overlap_population(me, 'network') x
   where public.net__region_of(x, p_theme_ids) is not null;
  select count(*) into total_event from public.net__overlap_population(me, 'event') x
   where public.net__region_of(x, p_theme_ids) is not null;

  return jsonb_build_object(
    'theme_ids', to_jsonb(p_theme_ids), 'scope', p_scope,
    'regions', coalesce(regions, '{}'::jsonb), 'total', coalesce(total_scope, 0),
    'totals', jsonb_build_object('network', total_network, 'event', total_event));
end $$;

create or replace function public.net_list_region(p_theme_ids int[], p_region text, p_scope text default 'network',
                                                  p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if not public.net__flag('overlap') then return jsonb_build_object('paused', true); end if;
  if p_theme_ids is null or cardinality(p_theme_ids) not between 1 and 3 then
    return jsonb_build_object('error', 'max_three_themes');
  end if;
  if p_scope not in ('network', 'event') then return jsonb_build_object('error', 'bad_scope'); end if;
  return jsonb_build_object('people', coalesce((
    select jsonb_agg(public.net__list_item(me, q.id) order by q.name)
    from (select x as id, p.display_name as name
          from public.net__overlap_population(me, p_scope) x
          join public.net_people p on p.user_id = x
          where public.net__region_of(x, p_theme_ids) = p_region
          order by p.display_name, x
          limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) q
  ), '[]'::jsonb));
end $$;

-- Small row for lists (search, regions): directory-level fields only, never contact.
create or replace function public.net__list_item(p_me uuid, p_o uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.user_id, 'name', p.display_name, 'institute', p.institute, 'role_label', p.role_label,
    'role_kind', p.role_kind, 'photo_url', p.photo_url, 'paper_title', p.paper_title, 'session_id', p.session_id,
    'headline', e.headline, 'themes', public.net__themes_json(p.user_id),
    'connected', public.net__met(p_me, p.user_id))
  from public.net_people p left join public.net_profile_ext e on e.user_id = p.user_id
  where p.user_id = p_o limit 1
$$;

create or replace function public.net_search_people(p_q text default null, p_theme_ids int[] default null,
                                                    p_institute text default null, p_role_kind text default null,
                                                    p_session_id text default null, p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.net__uid();
  q text := nullif(trim(coalesce(p_q, '')), '');
begin
  return jsonb_build_object('people', coalesce((
    select jsonb_agg(public.net__list_item(me, r.user_id) order by r.display_name) from (
      select p.user_id, p.display_name
      from public.net_people p
      left join public.net_profile_ext e on e.user_id = p.user_id
      where p.user_id <> me
        and (q is null or p.display_name ilike '%' || q || '%' or p.institute ilike '%' || q || '%'
             or p.paper_title ilike '%' || q || '%' or e.headline ilike '%' || q || '%'
             or exists (select 1 from unnest(coalesce(e.interests, '{}')) i where i ilike '%' || q || '%'))
        and (p_theme_ids is null or cardinality(p_theme_ids) = 0 or exists (
             select 1 from public.net_profile_themes t where t.user_id = p.user_id and t.theme_id = any(p_theme_ids)))
        and (p_institute is null or p.institute = p_institute)
        and (p_role_kind is null or p.role_kind = p_role_kind)
        and (p_session_id is null or p.session_id = p_session_id)
        and public.net__can_see(me, p.user_id)
      order by p.display_name
      limit least(greatest(coalesce(p_limit, 30), 1), 50)
    ) r), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- similarity (K-50)
-- S = 0.40 J(themes) + 0.25 cos(interests) + 0.20 J(starred) + 0.15 min(1, mutual/5)
-- Without starred sessions: 0.50, 0.3125, 0.1875 (same ratios renormalised).

create or replace function public.net__sim_weights()
returns real[] language sql stable set search_path = '' as $$
  select case when public.net_has_starred_sessions()
              then array[0.40, 0.25, 0.20, 0.15]::real[]
              else array[0.50, 0.3125, 0.0, 0.1875]::real[] end
$$;

create or replace function public.net__jaccard(p_x text[], p_y text[])
returns real language sql immutable set search_path = '' as $$
  select case when u = 0 then 0 else i::real / u end
  from (select (select count(*) from (select unnest(p_x) intersect select unnest(p_y)) q) i,
               (select count(*) from (select unnest(p_x) union select unnest(p_y)) q) u) z
$$;

create or replace function public.net__cosine(p_x text[], p_y text[])
returns real language sql immutable set search_path = '' as $$
  select case when nx = 0 or ny = 0 then 0 else i / sqrt(nx::real * ny) end::real
  from (select (select count(*) from (select unnest(p_x) intersect select unnest(p_y)) q) i,
               (select count(distinct v) from unnest(p_x) v) nx,
               (select count(distinct v) from unnest(p_y) v) ny) z
$$;

-- Candidate pairs share a theme, an interest, a starred session or a connection. p_user limits to one person.
create or replace function public.net__similarity_pairs(p_user uuid default null)
returns table (a uuid, b uuid, score real)
language sql stable security definer set search_path = '' as $$
  -- Set-based: shared counts per pair come from grouped self-joins; no per-pair function calls.
  with w as (select public.net__sim_weights() as w),
  tr as (select t.user_id u, t.theme_id::text v from public.net_profile_themes t),
  ir as (select distinct e.user_id u, lower(x) v from public.net_profile_ext e, unnest(e.interests) x),
  sr as (select distinct s.user_id u, s.session_id v from public.net_starred_sessions s),
  adj as (select c.a x, c.b y from public.net_connections c where c.removed_at is null
          union all select c.b, c.a from public.net_connections c where c.removed_at is null),
  nt as (select u, count(*) n from tr group by u),
  ni as (select u, count(*) n from ir group by u),
  ns as (select u, count(*) n from sr group by u),
  pairs as (
    select least(r1.u, r2.u) a, greatest(r1.u, r2.u) b, count(*) st, 0::bigint si, 0::bigint ss, 0::bigint m
      from (select * from tr where p_user is null or u = p_user) r1 join tr r2 on r1.v = r2.v
       and ((p_user is null and r1.u < r2.u) or (p_user is not null and r1.u <> r2.u)) group by 1, 2
    union all
    select least(r1.u, r2.u), greatest(r1.u, r2.u), 0, count(*), 0, 0
      from (select * from ir where p_user is null or u = p_user) r1 join ir r2 on r1.v = r2.v
       and ((p_user is null and r1.u < r2.u) or (p_user is not null and r1.u <> r2.u)) group by 1, 2
    union all
    select least(r1.u, r2.u), greatest(r1.u, r2.u), 0, 0, count(*), 0
      from (select * from sr where p_user is null or u = p_user) r1 join sr r2 on r1.v = r2.v
       and ((p_user is null and r1.u < r2.u) or (p_user is not null and r1.u <> r2.u)) group by 1, 2
    union all
    select least(j1.x, j2.x), greatest(j1.x, j2.x), 0, 0, 0, count(*)
      from (select * from adj where p_user is null or x = p_user) j1 join adj j2 on j1.y = j2.y
       and ((p_user is null and j1.x < j2.x) or (p_user is not null and j1.x <> j2.x)) group by 1, 2
  ),
  agg as (select p.a, p.b, sum(p.st) st, sum(p.si) si, sum(p.ss) ss, sum(p.m) m from pairs p group by p.a, p.b)
  select g.a, g.b, least(1.0, greatest(0.0,
      w.w[1] * coalesce(g.st::real / nullif(coalesce(ta.n, 0) + coalesce(tb.n, 0) - g.st, 0), 0)
    + w.w[2] * coalesce(g.si::real / nullif(sqrt(coalesce(ia.n, 0)::real * coalesce(ib.n, 0)), 0), 0)
    + w.w[3] * coalesce(g.ss::real / nullif(coalesce(sa.n, 0) + coalesce(sb.n, 0) - g.ss, 0), 0)
    + w.w[4] * least(1.0, g.m / 5.0)))::real
  from agg g cross join w
  left join nt ta on ta.u = g.a left join nt tb on tb.u = g.b
  left join ni ia on ia.u = g.a left join ni ib on ib.u = g.b
  left join ns sa on sa.u = g.a left join ns sb on sb.u = g.b
$$;

-- Keep the top 8 edges per person among the given pairs.
create or replace function public.net__store_top8(p_user uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_user is null then
    delete from public.net_similarity_edges;
  else
    delete from public.net_similarity_edges s where s.a = p_user or s.b = p_user;
  end if;
  insert into public.net_similarity_edges (a, b, score)
  select distinct on (r.a, r.b) r.a, r.b, r.score from (
    select p.a, p.b, p.score,
           row_number() over (partition by p.a order by p.score desc, p.b) ra,
           row_number() over (partition by p.b order by p.score desc, p.a) rb
    from public.net__similarity_pairs(p_user) p where p.score > 0
  ) r
  where r.ra <= 8 or r.rb <= 8
  on conflict (a, b) do update set score = excluded.score, computed_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.net_refresh_similarity(p_user uuid)
returns int language sql security definer set search_path = '' as $$ select public.net__store_top8(p_user) $$;

-- Nightly sweep (pg_cron) or by hand.
create or replace function public.net_refresh_similarity_all()
returns int language sql security definer set search_path = '' as $$ select public.net__store_top8(null) $$;

-- P2 K-55: suggestions among discoverable, unconnected people (cut-order step 1; cheap, so shipped behind 'galaxy').
create or replace function public.net_suggest_people(p_limit int default 10)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.net__uid();
begin
  if not public.net__flag('galaxy') then return jsonb_build_object('paused', true); end if;
  return jsonb_build_object('people', coalesce((
    select jsonb_agg(public.net__list_item(me, q.id) order by q.score desc) from (
      select case when s.a = me then s.b else s.a end id, s.score
      from public.net_similarity_edges s
      join public.net_profile_ext e on e.user_id = (case when s.a = me then s.b else s.a end) and e.discoverable
      where (s.a = me or s.b = me)
        and not public.net__met(me, case when s.a = me then s.b else s.a end)
        and public.net__can_see(me, case when s.a = me then s.b else s.a end)
      order by s.score desc limit least(greatest(coalesce(p_limit, 10), 1), 10)) q), '[]'::jsonb));
end $$;

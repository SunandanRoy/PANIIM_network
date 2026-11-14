-- Non-functional checks (acceptance-tests.md section 3, K-41, K-50):
--   net_get_ego_graph p95 < 400 ms at ~150 nodes; net_get_profile_by_token p95 < 400 ms at 2,000 profiles;
--   similarity for 2,000 profiles < 60 s.
do $$
declare
  hub uuid; ids uuid[]; i int; j int; t0 timestamptz; ms numeric[] := '{}'; p95 numeric; res jsonb; sim_ms numeric;
  interests text[] := array['logistics','msme','esg','carbon','supply chains','fintech','pricing','retail','hr analytics',
                            'leadership','ai','platforms','healthcare','policy','gender','startups','innovation','csr'];
begin
  perform nettest.reset();
  for i in 1..2000 loop
    ids := ids || nettest.person('Person ' || i, i % 3 = 0, 'S' || (i % 40));
  end loop;
  insert into public.net_profile_ext (user_id, visibility_scope, second_degree, discoverable, interests, headline)
  select u, case when random() < 0.7 then 'presenters' else 'all' end, random() < 0.6, random() < 0.5,
         array[interests[1 + floor(random() * 18)::int], interests[1 + floor(random() * 18)::int]], 'Headline'
  from unnest(ids) u;
  insert into public.net_profile_themes (user_id, theme_id, rank)
  select u, t, r from unnest(ids) u, lateral (
    select x.t, row_number() over () r from (select distinct 1 + floor(random() * 10)::int t from generate_series(1, 3)) x) z;
  -- ~6 random connections each
  insert into public.net_connections (a, b, initiator, source)
  select distinct least(x, y), greatest(x, y), x, 'tap' from (
    select ids[i2] x, ids[1 + floor(random() * 2000)::int] y from generate_series(1, 2000) i2, generate_series(1, 3)) q
  where x <> y on conflict do nothing;
  -- hub: 25 direct connections whose friends make a ~150-node neighbourhood
  hub := ids[3];  -- a presenter
  for j in 2..41 loop perform nettest.connect(hub, ids[j * 7]); end loop;
  update public.net_profile_ext set visibility_scope = 'all', second_degree = true where user_id = any(ids[1:1200]);
  perform nettest.card(hub, 'PERF0000HVB00001', 'PERF22');

  t0 := clock_timestamp();
  perform public.net_refresh_similarity_all();
  sim_ms := extract(epoch from clock_timestamp() - t0) * 1000;
  perform nettest.ok(sim_ms < 60000, 'K-50 similarity for 2,000 profiles took ' || round(sim_ms) || ' ms');

  t0 := clock_timestamp();
  perform public.net_refresh_similarity(ids[10]);
  perform nettest.ok(clock_timestamp() - t0 < interval '2 seconds', 'single-user similarity refresh on profile save is fast');
  raise notice 'ok perf: single-user similarity refresh % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);

  res := nettest.call(hub, 'public.net_get_ego_graph(2)');
  for i in 1..20 loop
    t0 := clock_timestamp();
    perform nettest.call(hub, 'public.net_get_ego_graph(2)');
    ms := ms || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
  end loop;
  select percentile_cont(0.95) within group (order by x) into p95 from unnest(ms) x;
  perform nettest.ok(p95 < 400, 'K-41 ego graph p95 ' || round(p95) || ' ms');
  raise notice 'ok perf: ego graph % nodes, p95 % ms; similarity % ms', jsonb_array_length(res -> 'nodes'), round(p95), round(sim_ms);

  delete from public.net_tap_events;
  perform nettest.ok(nettest.call(ids[600], 'public.net_get_profile_by_token(''PERF0000HVB00001'')') ->> 'state' = 'active', 'perf token resolves to an active card');
  ms := '{}';
  for i in 1..25 loop
    delete from public.net_tap_events;
    t0 := clock_timestamp();
    perform nettest.call(ids[500 + i], 'public.net_get_profile_by_token(''PERF0000HVB00001'')');
    ms := ms || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
  end loop;
  select percentile_cont(0.95) within group (order by x) into p95 from unnest(ms) x;
  perform nettest.ok(p95 < 400, 'profile by token p95 ' || round(p95) || ' ms');
  raise notice 'ok perf: profile by token p95 % ms at 2,000 profiles', round(p95, 1);

  ms := '{}';
  for i in 1..10 loop
    t0 := clock_timestamp();
    perform nettest.call(hub, 'public.net_venn_counts(array[1,2,3], ''event'')');
    ms := ms || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
  end loop;
  select percentile_cont(0.95) within group (order by x) into p95 from unnest(ms) x;
  raise notice 'ok perf: venn counts (event scope, 2,000 people) p95 % ms', round(p95);
  perform nettest.ok(p95 < 400 * 3, 'venn counts p95 ' || round(p95) || ' ms');
end $$;

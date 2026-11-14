-- K-33 / docs/spec/privacy-matrix.md section 5: 3 scopes x 8 toggle combinations x 4 relationships = 96 cases,
-- each asserted on the six functions that can return a person. The expected values below are an independent
-- oracle written from the matrix, not from the implementation.
do $$
declare
  v uuid; o uuid; m uuid;
  tok constant text := 'MATR1XT0KEN00001';
  scopes text[] := array['presenters', 'all', 'met'];
  rels text[] := array['stranger', 'met', 'accepted', 'blocked'];
  s text; r text; bits int; share boolean; second boolean; disc boolean;
  can_scope boolean; visible_dir boolean; in_graph boolean;
  lvl_tap text; lvl_dir text; contact_tap boolean; contact_dir boolean;
  res jsonb; res2 jsonb; node jsonb; venn jsonb; lst jsonb;
  base text[] := array['id','name','institute','role_label','role_kind','photo_url','headline','key_finding','themes','ask_text','offer_text','is_presenter'];
  nonsecond text[] := array['bio','paper_title','paper_url','slides_url','session_id','session_title','session_start','room'];
  metplus text[] := array['interests','ask_me_about','open_to'];
  expect text[];
  n_cases int := 0; n_asserts int := 0;
  label text;
begin
  perform nettest.reset();
  v := nettest.person('Viewer Vee', false);        -- registered delegate, not a presenter
  o := nettest.person('Owner Oh', true, '3B');     -- presenter
  m := nettest.person('Mutual Em', true);          -- bridge: connected to both, visible to friends of friends
  perform nettest.card(o, tok, 'K7QX2M');
  insert into public.net_profile_ext (user_id, visibility_scope, second_degree) values (m, 'all', true);

  foreach s in array scopes loop
    for bits in 0..7 loop
      share := (bits & 1) = 1; second := (bits & 2) = 2; disc := (bits & 4) = 4;
      foreach r in array rels loop
        n_cases := n_cases + 1;
        label := format('[case %s scope=%s share=%s second=%s disc=%s rel=%s]', n_cases, s, share, second, disc, r);

        -- reset per-case state
        delete from public.net_connections; delete from public.net_contact_grants; delete from public.net_blocks;
        delete from public.net_meetings; delete from public.net_tap_events; delete from public.net_profile_themes;
        delete from public.net_profile_ext where user_id = o;
        insert into public.net_profile_ext (user_id, visibility_scope, share_on_tap, second_degree, discoverable,
                                            contact_fields, headline, interests)
        values (o, s, share, second, disc, '{email}', 'Owner headline', '{logistics}');
        insert into public.net_profile_themes values (o, 1, 1), (o, 2, 2);
        perform nettest.connect(v, m);
        perform nettest.connect(m, o);
        if r in ('met', 'accepted') then perform nettest.connect(v, o); end if;
        if r = 'accepted' then insert into public.net_contact_grants (owner, viewer, source) values (o, v, 'manual'); end if;
        if r = 'blocked' then
          if n_cases % 2 = 0 then insert into public.net_blocks values (o, v); else insert into public.net_blocks values (v, o); end if;
        end if;

        -- oracle
        can_scope := case s when 'presenters' then false when 'all' then true else false end;  -- viewer is not a presenter
        visible_dir := r in ('met', 'accepted') or (r = 'stranger' and can_scope);
        in_graph := r in ('met', 'accepted') or (r = 'stranger' and second and can_scope);
        lvl_tap := case r when 'accepted' then 'accepted' when 'met' then 'met' else 'tap' end;
        lvl_dir := case r when 'accepted' then 'accepted' when 'met' then 'met' else 'directory' end;
        contact_tap := r = 'accepted' or share;
        contact_dir := r = 'accepted';

        -- 1. net_get_profile_by_token (tap path: scope is overridden, block is not)
        res := nettest.call(v, format('public.net_get_profile_by_token(%L)', tok));
        if r = 'blocked' then
          res2 := nettest.call(v, 'public.net_get_profile_by_token(''ZZZZZZZZZZZZZZZZ'')');
          perform nettest.ok(res = '{"state":"unknown"}'::jsonb and res = res2, label || ' token: blocked identical to unknown, got ' || res);
        else
          expect := base || nonsecond || case when lvl_tap in ('met','accepted') then metplus else '{}' end
                         || case when contact_tap then array['contact'] else '{}' end;
          perform nettest.ok(res ->> 'state' = 'active', label || ' token: active');
          perform nettest.ok(nettest.keys(res -> 'person') = (select array_agg(x order by x) from unnest(expect) x),
                             label || ' token fields ' || array_to_string(nettest.keys(res -> 'person'), ','));
          if contact_tap then
            perform nettest.ok(nettest.keys(res -> 'person' -> 'contact') = array['email'], label || ' token contact is email only');
          end if;
          perform nettest.ok((res ->> 'mutual_count')::int = 1, label || ' token mutual count');
        end if;
        n_asserts := n_asserts + 1;

        -- 2. net_get_profile_detail
        res := nettest.call(v, format('public.net_get_profile_detail(%L)', o));
        if visible_dir then
          expect := base || nonsecond || case when lvl_dir in ('met','accepted') then metplus else '{}' end
                         || case when contact_dir then array['contact'] else '{}' end;
          perform nettest.ok(nettest.keys(res -> 'person') = (select array_agg(x order by x) from unnest(expect) x),
                             label || ' detail fields ' || array_to_string(nettest.keys(res -> 'person'), ','));
          perform nettest.ok((res -> 'mutual' ? 'people') = (lvl_dir in ('met','accepted')), label || ' detail mutual names only when met');
          perform nettest.ok(res -> 'path_to_me' is not null and jsonb_typeof(res -> 'path_to_me') = 'array', label || ' detail path');
        else
          res2 := nettest.call(v, format('public.net_get_profile_detail(%L)', gen_random_uuid()));
          perform nettest.ok(res is null and res2 is null, label || ' detail: hidden identical to non-existent');
        end if;
        n_asserts := n_asserts + 1;

        -- 3. net_get_ego_graph
        res := nettest.call(v, 'public.net_get_ego_graph(2)');
        select n into node from jsonb_array_elements(res -> 'nodes') n where n ->> 'id' = o::text;
        perform nettest.ok((node is not null) = in_graph, label || ' graph presence');
        if node is not null then
          perform nettest.ok((node ->> 'depth')::int = case when r = 'stranger' then 2 else 1 end, label || ' graph depth');
          perform nettest.ok(not (node ? 'contact' or node ? 'email' or node ? 'phone'), label || ' graph never has contact');
          perform nettest.ok((node ->> 'depth')::int = 1 or node ->> 'session_id' is null, label || ' second-degree has no session');
        end if;
        node := null;
        n_asserts := n_asserts + 1;

        -- 4. net_search_people
        res := nettest.call(v, 'public.net_search_people(''Owner'')');
        select n into node from jsonb_array_elements(res -> 'people') n where n ->> 'id' = o::text;
        perform nettest.ok((node is not null) = visible_dir, label || ' search presence');
        perform nettest.ok(node is null or not (node ? 'contact' or node ? 'email'), label || ' search never has contact');
        node := null;
        n_asserts := n_asserts + 1;

        -- 5. net_venn_counts (themes 1 and 2: owner sits in region AB)
        venn := nettest.call(v, 'public.net_venn_counts(array[1,2], ''event'')');
        perform nettest.ok(coalesce((venn -> 'regions' ->> 'AB')::int, 0) = case when disc and visible_dir then 1 else 0 end,
                           label || ' venn event ' || venn);
        perform nettest.ok((venn -> 'totals' ->> 'network')::int = case when in_graph then 1 else 0 end, label || ' venn network total');
        perform nettest.ok((venn ->> 'total')::int = (select coalesce(sum(value::int), 0) from jsonb_each_text(venn -> 'regions')),
                           label || ' venn regions sum to total');
        n_asserts := n_asserts + 1;

        -- 6. net_list_region matches the counts, both scopes
        lst := nettest.call(v, 'public.net_list_region(array[1,2], ''AB'', ''event'')');
        perform nettest.ok(jsonb_array_length(lst -> 'people') = coalesce((venn -> 'regions' ->> 'AB')::int, 0), label || ' list = count (event)');
        venn := nettest.call(v, 'public.net_venn_counts(array[1,2], ''network'')');
        lst := nettest.call(v, 'public.net_list_region(array[1,2], ''AB'', ''network'')');
        perform nettest.ok(jsonb_array_length(lst -> 'people') = coalesce((venn -> 'regions' ->> 'AB')::int, 0), label || ' list = count (network)');
        perform nettest.ok((lst -> 'people') @> jsonb_build_array(jsonb_build_object('id', o)) = in_graph, label || ' region list presence');
        n_asserts := n_asserts + 1;
      end loop;
    end loop;
  end loop;

  perform nettest.ok(n_cases = 96, 'expected 96 cases');
  raise notice 'ok privacy matrix: % cases x 6 functions = % function checks passed', n_cases, n_asserts;
end $$;

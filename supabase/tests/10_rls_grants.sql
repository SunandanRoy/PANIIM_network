-- K-63 / R3: every net_ table has RLS on, zero policies, and no access for anon or authenticated.
-- Only listed functions are executable; anon only net_resolve_token.
do $$
declare
  r record;
  n_tables int := 0;
  u uuid;
  denied boolean;
  allowed_auth text[] := array[
    'net_get_feature_flags','net_list_themes','net_resolve_token','net_get_profile_by_token','net_connect_via_card',
    'net_undo_connection','net_record_meeting','net_activate_card','net_report_lost_card','net_get_my_pass',
    'net_issue_digital_pass','net_get_my_settings','net_set_consent','net_update_profile_ext','net_withdraw_all',
    'net_grant_contact','net_revoke_contact','net_get_profile_detail','net_set_note','net_remove_connection',
    'net_list_connections','net_block_user','net_unblock_user','net_report_user','net_log_event','net_get_ego_graph',
    'net_get_my_network_summary','net_venn_counts','net_list_region','net_search_people','net_suggest_people',
    'net_admin_whoami','net_admin_find_delegate','net_admin_bind_card','net_admin_unbind_card','net_admin_revoke_card',
    'net_admin_swap_lost_card','net_admin_list_cards','net_admin_import_cards','net_admin_list_reports',
    'net_admin_resolve_report','net_admin_metrics','net_admin_set_flag','net_admin_export_reminders'];
begin
  perform nettest.reset();
  u := nettest.person('Probe User');

  for r in select c.oid, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'net\_%' and c.relkind = 'r'
  loop
    n_tables := n_tables + 1;
    perform nettest.ok(r.relrowsecurity, r.relname || ' has RLS enabled');
    perform nettest.ok((select count(*) from pg_policy p where p.polrelid = r.oid) = 0, r.relname || ' has zero policies');
    perform nettest.ok(not has_table_privilege('anon', r.oid, 'select,insert,update,delete,truncate,references,trigger'),
                       r.relname || ': anon has no privilege');
    perform nettest.ok(not has_table_privilege('authenticated', r.oid, 'select,insert,update,delete,truncate,references,trigger'),
                       r.relname || ': authenticated has no privilege');

    -- Try it for real as each role.
    foreach denied in array array[true] loop
      begin
        perform nettest.call(null, format('(select count(*)::text::jsonb from public.%I)', r.relname));
        raise exception 'FAIL: anon could select %', r.relname;
      exception when insufficient_privilege then null;
      end;
      begin
        perform nettest.call(u, format('(select count(*)::text::jsonb from public.%I)', r.relname));
        raise exception 'FAIL: authenticated could select %', r.relname;
      exception when insufficient_privilege then null;
      end;
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
        execute 'set local role authenticated';
        execute format('delete from public.%I', r.relname);
        execute 'reset role';
        raise exception 'FAIL: authenticated could delete from %', r.relname;
      exception when insufficient_privilege then execute 'reset role';
      end;
      begin
        execute 'set local role authenticated';
        execute format('update public.%I set %I = %I', r.relname,
          (select a.attname from pg_attribute a where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped order by a.attnum limit 1),
          (select a.attname from pg_attribute a where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped order by a.attnum limit 1));
        execute 'reset role';
        raise exception 'FAIL: authenticated could update %', r.relname;
      exception when insufficient_privilege then execute 'reset role';
      end;
      begin
        execute 'set local role anon';
        execute format('insert into public.%I default values', r.relname);
        execute 'reset role';
        raise exception 'FAIL: anon could insert into %', r.relname;
      exception when insufficient_privilege then execute 'reset role';
      end;
    end loop;
  end loop;
  perform nettest.ok(n_tables = 19, 'expected 19 net_ tables, found ' || n_tables);

  -- Views and sequences.
  perform nettest.ok(not has_table_privilege('authenticated', 'public.net_people', 'select'), 'net_people not readable by clients');
  perform nettest.ok(not has_table_privilege('anon', 'public.net_people', 'select'), 'net_people not readable by anon');
  for r in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'net\_%' and c.relkind = 'S'
  loop
    perform nettest.ok(not has_sequence_privilege('authenticated', r.oid, 'usage,select,update'), r.relname || ' sequence closed');
  end loop;

  -- Functions: exact allow-lists; every one is SECURITY DEFINER with search_path=''.
  for r in select p.oid, p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'net\_%'
  loop
    perform nettest.ok(has_function_privilege('authenticated', r.oid, 'execute') = (r.proname = any(allowed_auth)),
                       r.proname || ': authenticated execute matches allow-list');
    perform nettest.ok(has_function_privilege('anon', r.oid, 'execute') = (r.proname = 'net_resolve_token'),
                       r.proname || ': anon execute only for net_resolve_token');
    if r.proname = any(allowed_auth) then
      perform nettest.ok(r.prosecdef, r.proname || ' is SECURITY DEFINER');
    end if;
    perform nettest.ok(r.proconfig is not null and 'search_path=""' = any(r.proconfig), r.proname || ' pins search_path');
  end loop;

  -- anon can resolve, but nothing else.
  perform nettest.ok(nettest.call(null, 'public.net_resolve_token(''0000000000000000'')') = '{"state":"unknown"}', 'anon resolve works');
  begin
    perform nettest.call(null, 'public.net_get_my_pass()');
    raise exception 'FAIL: anon called net_get_my_pass';
  exception when insufficient_privilege then null;
  end;
  begin
    perform nettest.call(u, 'public.net_retention_delete(false, true)');
    raise exception 'FAIL: authenticated called net_retention_delete';
  exception when insufficient_privilege then null;
  end;

  raise notice 'ok RLS and grants: % tables, % functions checked', n_tables,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'net\_%');
end $$;

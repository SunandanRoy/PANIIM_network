-- pan-iim-network: grants (K-63). Runs last.
-- 1. No direct table, view or sequence access for anon or authenticated (Supabase grants them by default).
-- 2. No function is executable unless listed below. anon may call only net_resolve_token.

do $$
declare r record;
begin
  for r in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'net\_%' and c.relkind in ('r', 'v', 'S', 'm')
  loop
    execute format('revoke all on %s public.%I from public, anon, authenticated',
                   case when r.relkind = 'S' then 'sequence' else 'table' end, r.relname);
  end loop;

  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'net\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

do $$
declare
  fn text;
  client_fns text[] := array[
    'net_get_feature_flags', 'net_list_themes', 'net_resolve_token',
    'net_get_profile_by_token', 'net_connect_via_card', 'net_undo_connection', 'net_record_meeting',
    'net_activate_card', 'net_report_lost_card', 'net_get_my_pass', 'net_issue_digital_pass',
    'net_get_my_settings', 'net_set_consent', 'net_update_profile_ext', 'net_withdraw_all',
    'net_grant_contact', 'net_revoke_contact', 'net_get_profile_detail', 'net_set_note',
    'net_remove_connection', 'net_list_connections', 'net_block_user', 'net_unblock_user', 'net_report_user',
    'net_log_event', 'net_get_ego_graph', 'net_get_my_network_summary', 'net_venn_counts', 'net_list_region',
    'net_search_people', 'net_suggest_people',
    'net_admin_whoami', 'net_admin_find_delegate', 'net_admin_bind_card', 'net_admin_unbind_card',
    'net_admin_revoke_card', 'net_admin_swap_lost_card', 'net_admin_list_cards', 'net_admin_import_cards',
    'net_admin_list_reports', 'net_admin_resolve_report', 'net_admin_metrics', 'net_admin_set_flag',
    'net_admin_export_reminders'
  ];
begin
  foreach fn in array client_fns loop
    execute format('grant execute on function public.%I to authenticated', fn);
  end loop;
  execute 'grant execute on function public.net_resolve_token to anon';
end $$;

insert into public.net_schema_version (version) values (1) on conflict (version) do nothing;

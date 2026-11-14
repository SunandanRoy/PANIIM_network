-- Behaviour of the RPCs, mapped to docs/spec/acceptance-tests.md (T2..T19) and ticket acceptance criteria.
do $$
#variable_conflict use_variable
declare
  a uuid; b uuid; c uuid; staff uuid; res jsonb; res2 jsonb; n int; card uuid;
  tok_a constant text := 'AAAA0000BBBB1111';
  tok_unbound constant text := 'CCCC2222DDDD3333';
  tok_spare constant text := 'EEEE4444FFFF5555';
begin
  perform nettest.reset();
  a := nettest.person('Meera Iyer', true, '3B');
  b := nettest.person('Arjun Mehta', false, '3B');
  c := nettest.person('Sana Qureshi', true);
  staff := nettest.person('Desk Volunteer', false);
  perform nettest.card(a, tok_a, 'K7QX2M');
  insert into public.net_cards (token_hash, printed_code) values (public.net__hash_token(tok_unbound), 'HJ4N9P');
  insert into public.net_cards (token_hash, printed_code) values (public.net__hash_token(tok_spare), 'WXYZ23');

  -- T1 signed out: resolve works without personal data
  res := nettest.call(null, format('public.net_resolve_token(%L)', tok_a));
  perform nettest.ok(res = '{"state":"active"}', 'T1 anon resolve active, no personal data: ' || res::text);
  perform nettest.ok(nettest.call(null, format('public.net_resolve_token(%L)', lower(tok_a))) = '{"state":"active"}', 'token is case-insensitive');

  -- K-22: the GET path writes nothing to the graph
  res := nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_a));
  perform nettest.ok(res ->> 'state' = 'active' and res -> 'connection' ->> 'state' = 'none', 'T2 profile shown, not connected yet');
  perform nettest.ok((res ->> 'in_your_session')::boolean, 'T2 in your session tag');
  perform nettest.ok(not (res -> 'person' ? 'contact'), 'T2 no contact fields');
  perform nettest.ok((select count(*) from public.net_connections) = 0, 'K-22 viewing writes no connection');

  -- T2 connect after render
  res := nettest.call(b, format('public.net_connect_via_card(%L, ''tap'', ''3B'')', tok_a));
  perform nettest.ok((res ->> 'created')::boolean and (res ->> 'other_id')::uuid = a, 'T2 connection created');
  perform nettest.ok((select session_id from public.net_connections) = '3B', 'K-28 live session tagged');

  -- T5 again: idempotent, one row
  res := nettest.call(b, format('public.net_connect_via_card(%L)', tok_a));
  perform nettest.ok(not (res ->> 'created')::boolean, 'T5 second connect is not new');
  perform nettest.ok((select count(*) from public.net_connections) = 1, 'T5 exactly one row for the pair');
  res := nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_a));
  perform nettest.ok(res -> 'connection' ->> 'state' = 'connected', 'T5 connected badge state');

  -- T3 undo within 8 s by initiator; non-initiator cannot
  res := nettest.call(a, format('public.net_undo_connection(%L)', b));
  perform nettest.ok(res ->> 'error' = 'expired', 'undo refused for the non-initiator');
  res := nettest.call(b, format('public.net_undo_connection(%L)', a));
  perform nettest.ok((res ->> 'ok')::boolean, 'T3 undo within 8 s');
  perform nettest.ok(not public.net__met(a, b), 'T3 connection removed');

  -- T4 undo after 8 s refused
  perform nettest.call(b, format('public.net_connect_via_card(%L)', tok_a));
  update public.net_connections set created_at = now() - interval '12 seconds';
  res := nettest.call(b, format('public.net_undo_connection(%L)', a));
  perform nettest.ok(res ->> 'error' = 'expired', 'T4 undo after 8 s refused');

  -- T6 self tap
  res := nettest.call(a, format('public.net_connect_via_card(%L)', tok_a));
  perform nettest.ok(res ->> 'error' = 'self', 'T6 self tap refused');
  res := nettest.call(a, format('public.net_get_profile_by_token(%L)', tok_a));
  perform nettest.ok(res ->> 'state' = 'self', 'T6 self state');

  -- T7 activation: wrong code, right code, second active card refused
  res := nettest.call(c, format('public.net_get_profile_by_token(%L)', tok_unbound));
  perform nettest.ok(res = '{"state":"unbound"}', 'T7 unbound state');
  res := nettest.call(c, format('public.net_activate_card(''ZZZZZZ'', ''all'', %L)', tok_unbound));
  perform nettest.ok(res ->> 'error' = 'bad_code', 'T7 wrong code fails');
  res := nettest.call(c, format('public.net_activate_card(''K7QX2M'', ''all'', %L)', tok_unbound));
  perform nettest.ok(res ->> 'error' = 'bad_code', 'T7 code of another card fails');
  res := nettest.call(c, format('public.net_activate_card(''hj4-n9p'', ''all'', %L)', tok_unbound));
  perform nettest.ok((res ->> 'ok')::boolean, 'T7 correct code binds (typed loosely)');
  perform nettest.ok((select visibility_scope from public.net_profile_ext where user_id = c) = 'all', 'T7 scope chosen at activation');
  perform nettest.ok(exists (select 1 from public.net_consents where user_id = c and key = 'visibility_scope'), 'K-24 consent captured');
  perform nettest.ok(exists (select 1 from public.net_audit where action = 'activate_card'), 'K-24 audit row');
  res := nettest.call(c, 'public.net_activate_card(''WXYZ23'', ''all'')');
  perform nettest.ok(res ->> 'error' = 'already_active', 'T7 second active card refused');
  -- codes never resolve unbound cards
  perform nettest.ok(nettest.call(b, 'public.net_get_profile_by_token(''WXYZ23'')') = '{"state":"unknown"}', 'E-08 code does not reveal an unbound card');
  -- code resolves an active card like a token
  res := nettest.call(b, 'public.net_get_profile_by_token(''K7QX2M'')');
  perform nettest.ok(res ->> 'state' = 'active' and res -> 'person' ->> 'id' = a::text, 'E-08 printed code resolves the same profile');

  -- T10 share on tap: email only
  update public.net_profile_ext set share_on_tap = true, contact_fields = '{email}' where user_id = c;
  res := nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_unbound));
  perform nettest.ok(nettest.keys(res -> 'person' -> 'contact') = array['email'], 'T10 share-on-tap shows email only');
  perform nettest.call(b, format('public.net_connect_via_card(%L)', tok_unbound));
  perform nettest.ok(public.net__granted(c, b), 'E-13 share-on-tap tap writes a grant');

  -- T11 no share on tap; grant later
  perform nettest.ok(not (nettest.call(b, format('public.net_get_profile_detail(%L)', a)) -> 'person' ? 'contact'), 'T11 no contact before grant');
  res := nettest.call(a, format('public.net_grant_contact(%L, ''manual'')', b));
  perform nettest.ok((res ->> 'ok')::boolean, 'T11 owner grants');
  res := nettest.call(b, format('public.net_get_profile_detail(%L)', a));
  perform nettest.ok(res -> 'person' -> 'contact' ->> 'email' is not null, 'T11 email visible after grant');
  perform nettest.ok((res -> 'relation' ->> 'contact_granted_to_me')::boolean, 'T11 grant state');
  perform nettest.call(a, format('public.net_revoke_contact(%L)', b));
  perform nettest.ok(not (nettest.call(b, format('public.net_get_profile_detail(%L)', a)) -> 'person' ? 'contact'), 'withdrawal takes effect on next request');

  -- T12 / T13 scope met: tap passes, directory does not
  update public.net_profile_ext set visibility_scope = 'met', share_on_tap = false where user_id = c;
  insert into public.net_profile_ext (user_id, visibility_scope) values (a, 'met') on conflict (user_id) do update set visibility_scope = 'met';
  delete from public.net_connections;
  res := nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_a));
  perform nettest.ok(res ->> 'state' = 'active', 'T12 physical tap overrides scope');
  perform nettest.ok(not (nettest.call(b, 'public.net_search_people(''Meera'')') -> 'people') @> jsonb_build_array(jsonb_build_object('id', a)), 'T13 absent from directory');

  -- T14 block: disappears both ways, card unknown, connection removed
  perform nettest.call(b, format('public.net_connect_via_card(%L)', tok_a));
  perform nettest.ok(public.net__met(a, b), 'precondition connected');
  perform nettest.call(b, format('public.net_block_user(%L)', a));
  perform nettest.ok(not public.net__met(a, b), 'T14 block removes connection');
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_a)) = '{"state":"unknown"}', 'T14 blocked card is unknown');
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_detail(%L)', a)) is null, 'T14 blocked detail null');
  perform nettest.ok(nettest.call(a, format('public.net_get_profile_detail(%L)', b)) is null, 'T14 hidden for the blocked side too');
  perform nettest.ok(nettest.call(b, format('public.net_connect_via_card(%L)', tok_a)) ->> 'error' = 'unknown', 'T14 cannot reconnect');
  perform nettest.ok(nettest.call(a, format('public.net_record_meeting(%L, ''coffee'')', b)) ->> 'error' = 'unknown', 'T14 cannot record meeting');
  perform nettest.call(b, format('public.net_unblock_user(%L)', a));

  -- T15 report reaches staff queue; non-staff denied (T18)
  perform nettest.call(b, format('public.net_report_user(%L, ''spam'', ''test note'')', a));
  begin
    perform nettest.call(b, 'public.net_admin_list_reports(''open'')');
    raise exception 'FAIL: non-staff read the report queue';
  exception when raise_exception then
    perform nettest.ok(sqlerrm = 'net:forbidden', 'T18 non-staff denied: ' || sqlerrm);
  end;
  insert into public.net_staff values (staff, 'desk');
  res := nettest.call(staff, 'public.net_admin_list_reports(''open'')');
  perform nettest.ok(jsonb_array_length(res -> 'reports') = 1 and res -> 'reports' -> 0 ->> 'reason' = 'spam', 'T15 report in queue');
  perform nettest.call(staff, format('public.net_admin_resolve_report(%L, ''warned'')', (res -> 'reports' -> 0 ->> 'id')));
  perform nettest.ok((select status from public.net_reports) = 'resolved', 'report resolved');

  -- T16 consent log append-only; scope change appends a row
  n := (select count(*) from public.net_consents where user_id = b);
  perform nettest.call(b, 'public.net_set_consent(''visibility_scope'', ''"all"'')');
  perform nettest.call(b, 'public.net_set_consent(''discoverable'', ''true'')');
  perform nettest.call(b, 'public.net_set_consent(''contact_fields'', ''["email","phone"]'')');
  perform nettest.ok((select count(*) from public.net_consents where user_id = b) = n + 3, 'T16 each change appends a row');
  perform nettest.ok((select bool_and(text_version = public.net__consent_version()) from public.net_consents where user_id = b), 'T16 text version recorded');
  perform nettest.ok(nettest.call(b, 'public.net_set_consent(''contact_fields'', ''["email","fax"]'')') ->> 'error' = 'bad_value', 'bad contact field rejected');
  perform nettest.ok(nettest.call(b, 'public.net_set_consent(''visibility_scope'', ''"everyone"'')') ->> 'error' = 'bad_value', 'bad scope rejected');
  begin
    update public.net_consents set value = 'false' where user_id = b;
    raise exception 'FAIL: consent updated';
  exception when raise_exception then
    perform nettest.ok(sqlerrm = 'net:consents_append_only', 'consents reject UPDATE');
  end;
  begin
    delete from public.net_consents where user_id = b;
    raise exception 'FAIL: consent deleted';
  exception when raise_exception then
    perform nettest.ok(sqlerrm = 'net:consents_append_only', 'consents reject DELETE');
  end;

  -- T17 lost card, desk swaps a spare; old token revoked at once
  res := nettest.call(staff, format('public.net_admin_swap_lost_card(%L, ''WXYZ23'')', a));
  perform nettest.ok((res ->> 'ok')::boolean, 'T17 swap ok: ' || res::text);
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_a)) = '{"state":"revoked"}', 'T8/T17 old token revoked');
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_spare)) ->> 'state' = 'active', 'T17 new token works');
  perform nettest.ok((select count(*) from public.net_audit where action like 'admin_%') >= 2, 'T18 staff actions audited');

  -- T18 desk bind / unbind / revoke
  card := (select id from public.net_cards where printed_code = 'K7QX2M');
  perform nettest.ok(nettest.call(staff, format('public.net_admin_bind_card(%L, ''K7QX2M'')', b)) ->> 'error' = 'card_revoked', 'cannot bind a revoked card');
  insert into public.net_cards (token_hash, printed_code) values (public.net__hash_token('GGGG6666HHHH7777'), 'PQRS45');
  perform nettest.ok((nettest.call(staff, format('public.net_admin_bind_card(%L, ''PQRS45'')', b)) ->> 'ok')::boolean, 'T18 desk bind');
  card := (select id from public.net_cards where printed_code = 'PQRS45');
  perform nettest.ok((nettest.call(staff, format('public.net_admin_unbind_card(%L)', card)) ->> 'ok')::boolean, 'T18 desk unbind');
  perform nettest.ok((nettest.call(staff, format('public.net_admin_revoke_card(%L)', card)) ->> 'ok')::boolean, 'T18 desk revoke');
  res := nettest.call(staff, 'public.net_admin_list_cards()');
  perform nettest.ok(jsonb_array_length(res -> 'cards') = 4, 'list cards for CSV export');
  res := nettest.call(staff, format('public.net_admin_import_cards(%L)', jsonb_build_array(
    jsonb_build_object('token_hash', encode(public.net__hash_token('JJJJ8888KKKK9999'), 'hex'), 'printed_code', 'ABCD23', 'batch', 'B1'),
    jsonb_build_object('token_hash', encode(public.net__hash_token('JJJJ8888KKKK9999'), 'hex'), 'printed_code', 'ABCD24', 'batch', 'B1'))));
  perform nettest.ok((res ->> 'inserted')::int = 1 and (res ->> 'skipped')::int = 1, 'import skips duplicates: ' || res::text);

  -- T19 kill switch: paused, nothing written
  perform nettest.call(staff, 'public.net_admin_set_flag(''tap'', false)');
  n := (select count(*) from public.net_tap_events);
  perform nettest.ok(nettest.call(null, format('public.net_resolve_token(%L)', tok_spare)) = '{"state":"paused"}', 'T19 resolve paused');
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_by_token(%L)', tok_spare)) = '{"state":"paused"}', 'T19 profile paused');
  perform nettest.ok(nettest.call(b, format('public.net_connect_via_card(%L)', tok_spare)) ->> 'error' = 'paused', 'T19 connect paused');
  perform nettest.ok((select count(*) from public.net_tap_events) = n, 'T19 no writes while paused');
  perform nettest.call(staff, 'public.net_admin_set_flag(''map'', false)');
  perform nettest.ok((nettest.call(b, 'public.net_get_ego_graph()') ->> 'paused')::boolean, 'K-62 map paused');
  update public.net_feature_flags set enabled = true where key in ('tap', 'map');

  -- K-22 rate limit: 30 profile resolves per minute per user
  delete from public.net_tap_events;
  for n in 1..30 loop perform nettest.call(c, format('public.net_get_profile_by_token(%L)', tok_spare)); end loop;
  perform nettest.ok(nettest.call(c, format('public.net_get_profile_by_token(%L)', tok_spare)) = '{"state":"limited"}', 'K-22 31st resolve limited');
  delete from public.net_tap_events;

  -- E-07 record_meeting: one-sided coffee draws no edge; reciprocal does; table never does
  delete from public.net_connections; delete from public.net_meetings;
  res := nettest.call(b, format('public.net_record_meeting(%L, ''coffee'')', c));
  perform nettest.ok((res ->> 'recorded')::boolean and not (res ->> 'edge')::boolean, 'E-07 one-sided coffee: no edge');
  res := nettest.call(c, format('public.net_grant_contact(%L, ''coffee'')', b));
  perform nettest.ok(public.net__met(b, c), 'E-07 owner accepting coffee completes the edge');
  perform nettest.ok((select source from public.net_connections) = 'coffee', 'edge source coffee');
  res := nettest.call(a, format('public.net_record_meeting(%L, ''table'', ''Sustainability table'')', c));
  res := nettest.call(c, format('public.net_record_meeting(%L, ''table'', ''Sustainability table'')', a));
  perform nettest.ok(not (res ->> 'edge')::boolean and not public.net__met(a, c), 'D-5 table is context, not an edge');
  perform nettest.ok(nettest.call(a, format('public.net_record_meeting(%L, ''lunch'')', c)) ->> 'error' = 'bad_source', 'K-28 only the six sources');
  res := nettest.call(c, format('public.net_get_profile_detail(%L)', a));
  perform nettest.ok(res -> 'shared_sessions' ? 'Both at Sustainability table', 'shared context shown: ' || (res -> 'shared_sessions')::text);

  -- similarity: in [0,1], weights sum to 1, top 8 per person
  perform nettest.ok(abs((select sum(x) from unnest(public.net__sim_weights()) x) - 1.0) < 1e-6, 'K-50 weights sum to 1');
  insert into public.net_profile_themes values (a, 2, 1), (b, 2, 1), (c, 2, 1), (b, 3, 2) on conflict do nothing;
  update public.net_profile_ext set interests = '{logistics,msme}' where user_id in (a, b, c);
  perform public.net_refresh_similarity_all();
  perform nettest.ok((select count(*) from public.net_similarity_edges) > 0, 'K-50 edges computed');
  perform nettest.ok((select bool_and(score between 0 and 1) from public.net_similarity_edges), 'K-50 scores in [0,1]');
  perform nettest.ok(abs(public.net__jaccard(array['1','2'], array['2','3']) - (1.0/3)) < 1e-6, 'jaccard');
  perform nettest.ok(abs(public.net__cosine(array['a','b'], array['b']) - (1/sqrt(2))) < 1e-6, 'cosine');

  -- profile editor (K-30/K-31): max 3 themes, length checks
  res := nettest.call(b, 'public.net_update_profile_ext(''{"headline":"Carbon disclosure","theme_ids":[2,3,5],"interests":["ESG"]}'')');
  perform nettest.ok(jsonb_array_length(res -> 'themes') = 3, 'K-31 three themes saved');
  res := nettest.call(b, 'public.net_update_profile_ext(''{"theme_ids":[1,2,3,4]}'')');
  perform nettest.ok(res ->> 'error' = 'too_many_themes', 'K-31 at most 3 themes');
  res := nettest.call(b, format('public.net_update_profile_ext(%L)', jsonb_build_object('headline', repeat('x', 81))));
  perform nettest.ok(res ->> 'error' = 'invalid', 'headline max 80');

  -- notes are author-only
  perform nettest.call(b, format('public.net_set_note(%L, ''Send questionnaire'')', c));
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_detail(%L)', c)) ->> 'note' = 'Send questionnaire', 'note visible to author');
  perform nettest.ok(nettest.call(c, format('public.net_get_profile_detail(%L)', b)) ->> 'note' is null, 'note hidden from subject');

  -- digital pass (E-09) and My pass
  res := nettest.call(c, 'public.net_get_my_pass()');
  perform nettest.ok(res -> 'card' ->> 'status' = 'active', 'my pass shows active card');
  delete from public.net_cards where user_id = staff;
  res := nettest.call(staff, 'public.net_issue_digital_pass()');
  perform nettest.ok((res -> 'card' ->> 'virtual')::boolean and res -> 'card' ->> 'printed_code' ~ '^[2-9A-HJKMNP-Z]{6}$', 'E-09 digital pass issued');
  perform nettest.ok(nettest.call(b, format('public.net_get_profile_by_token(%L)', res -> 'card' ->> 'printed_code')) ->> 'state' = 'active', 'digital pass code resolves');

  -- withdraw all (T16)
  res := nettest.call(b, 'public.net_withdraw_all()');
  perform nettest.ok((res ->> 'ok')::boolean, 'T16 withdraw all');
  perform nettest.ok(not exists (select 1 from public.net_connections x where x.a = b or x.b = b), 'T16 connections gone');
  perform nettest.ok(not exists (select 1 from public.net_person_notes where author = b), 'T16 notes gone');
  perform nettest.ok(not exists (select 1 from public.net_cards where user_id = b and status = 'active'), 'T16 card link gone');
  perform nettest.ok(exists (select 1 from public.net_consents where user_id = b and key = 'withdraw_all'), 'withdrawal logged');

  -- retention (K-64): dry run counts, refuses before the date, then deletes with force
  res := public.net_retention_delete(true);
  perform nettest.ok((res ->> 'dry_run')::boolean and (res -> 'would_delete' ->> 'consents')::int > 0, 'K-64 dry run counts');
  perform nettest.ok(public.net_retention_delete(false) ->> 'error' = 'before_retention_date', 'K-64 refuses before 29 Dec');
  res := public.net_retention_delete(false, true);
  perform nettest.ok((select count(*) from public.net_consents) = 0 and (select count(*) from public.net_connections) = 0
                     and (select count(*) from public.net_profile_ext) = 0, 'K-64 deletes module data');
  perform nettest.ok((select count(*) from public.net_aggregates) > 0, 'K-64 aggregates kept');
  perform nettest.ok((select count(*) from nettest.people) = 4, 'K-64 host data untouched');

  raise notice 'ok behaviour: T1-T19, K-22, K-24, K-28, K-31, K-50, K-62, K-64, E-07, E-08, E-09 passed';
end $$;

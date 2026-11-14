-- ============================================================================================================
-- DEMO DATA ONLY. NEVER RUN ON A REAL PROJECT. NOT PART OF dist/network_install.sql.
-- Requires the test fixture (supabase/tests/01_fixture.sql), which fakes the host's people table.
-- Names follow the wireframe's sample people; everything else is invented. Loaded by `pnpm db:setup`.
-- ============================================================================================================
do $$
declare
  you uuid; meera uuid; arjun uuid; sana uuid; rahul uuid; kavya uuid; tenzin uuid; desk uuid; admin uuid; stranger uuid;
  ids uuid[] := '{}';
  first_names text[] := array['Aditi','Rohan','Ishaan','Neha','Priya','Vikram','Ananya','Karan','Meghna','Siddharth','Tara','Dev',
                              'Lakshmi','Nikhil','Pooja','Rahul','Sneha','Arnav','Divya','Farhan','Gauri','Harsh','Isha','Jai',
                              'Kiran','Leela','Manav','Nisha','Omkar','Pallavi','Qasim','Ritu','Samar','Tanvi','Uday','Vani'];
  last_names text[] := array['Sharma','Rao','Das','Bose','Nair','Menon','Iyer','Khan','Singh','Gupta','Kulkarni','Reddy'];
  insts text[] := array['IIM Ahmedabad','IIM Bangalore','IIM Calcutta','IIM Lucknow','IIM Kozhikode','IIM Indore','IIM Shillong',
                        'IIM Ranchi','IIM Rohtak','IIM Udaipur','IIM Trichy','IIM Raipur'];
  roles text[] := array['Associate Professor, Strategy','PhD scholar','Assistant Professor, Finance','PhD scholar','Professor, Operations','Industry researcher'];
  i int; u uuid; j int;
begin
  perform nettest.reset();
  you    := nettest.person('Demo You', true, '3B');
  meera  := nettest.person('Dr. Meera Iyer', true, '3B');
  arjun  := nettest.person('Arjun Mehta', true, '3B');
  sana   := nettest.person('Sana Qureshi', true, '3B');
  rahul  := nettest.person('Rahul Bhattacharya', true, '2A');
  kavya  := nettest.person('Kavya Nair', true, '1C');
  tenzin := nettest.person('Tenzin Dorji', false);
  desk   := nettest.person('Desk Volunteer', false);
  admin  := nettest.person('Organiser Admin', false);
  stranger := nettest.person('Unbound Tester', false);

  update nettest.people set role_label = 'Associate Professor, Operations', institute = 'IIM Kozhikode',
    paper_title = 'Green logistics adoption among Indian MSMEs', key_finding = 'Firms that share trucks cut emissions per tonne by a fifth.',
    session_title = 'Sustainability · Session 3B', session_start = '2026-11-28 06:00:00+00', room = 'C-2',
    paper_url = 'https://example.invalid/abstract', slides_url = 'https://example.invalid/slides.pdf' where user_id = meera;
  update nettest.people set role_label = 'PhD scholar', institute = 'IIM Lucknow', paper_title = 'Carbon disclosure and the cost of capital in NSE firms',
    session_title = 'Sustainability · Session 3B', session_start = '2026-11-28 06:00:00+00' where user_id = arjun;
  update nettest.people set role_label = 'PhD scholar', institute = 'IIM Ranchi', paper_title = 'Circular supply chains in Northeast handloom clusters' where user_id = sana;
  update nettest.people set role_label = 'Professor, HR', institute = 'IIM Indore', paper_title = 'Survey design for HR research' where user_id = rahul;
  update nettest.people set role_label = 'Assistant Professor, Operations', institute = 'IIM Bangalore' where user_id = kavya;
  update nettest.people set role_label = 'Faculty, Strategy', institute = 'IIM Shillong', paper_title = 'Platform strategy in regional retail', session_title = 'Strategy · Session 3B' where user_id = you;

  insert into public.net_profile_ext (user_id, headline, interests, ask_me_about, open_to, visibility_scope, second_degree, discoverable, share_on_tap, contact_fields, ask_text, offer_text) values
    (you,   'Platforms and regional retail', '{platforms,retail,strategy}', '{Platform strategy}', '{Co-authoring}', 'presenters', true, true, false, '{email}', null, null),
    (meera, 'Green logistics for small firms', '{logistics,msme,esg}', '{Green logistics,MSME operations,Structural equation modelling,Field surveys,Last-mile delivery}', '{Co-authoring,Mentoring PhDs,Industry projects}', 'presenters', true, true, false, '{email,phone}', null, 'Happy to share my MSME survey instrument'),
    (arjun, 'Carbon disclosure and finance', '{esg,carbon,finance}', '{ESG disclosure}', '{Co-authoring}', 'all', true, true, false, '{email}', 'Looking for NSE ESG data', null),
    (sana,  'Circular supply chains', '{supply chains,handloom,esg}', '{Field work in the Northeast}', '{Co-authoring,Reviewing drafts}', 'all', true, true, true, '{email,linkedin}', null, null),
    (rahul, 'Validated HR scales', '{hr analytics,surveys}', '{Scale validation}', '{Mentoring PhDs}', 'all', true, true, false, '{email}', null, 'Validated scale for psychological safety'),
    (kavya, 'MSME operations', '{msme,surveys,logistics}', '{MSME survey data}', '{Co-authoring}', 'all', false, true, false, '{email}', 'Co-author with MSME survey access', null),
    (tenzin,'Retail tech field studies', '{retail,platforms}', '{}', '{Industry projects}', 'met', false, false, false, '{email}', null, null);
  insert into public.net_profile_themes values
    (you, 1, 1), (you, 9, 2),
    (meera, 2, 1), (meera, 5, 2),
    (arjun, 3, 1), (arjun, 2, 2),
    (sana, 2, 1), (sana, 1, 2),
    (rahul, 6, 1), (kavya, 5, 1), (kavya, 3, 2), (tenzin, 1, 1);

  -- 36 more delegates
  for i in 1..36 loop
    u := nettest.person(first_names[i] || ' ' || last_names[1 + (i % 12)], i % 3 <> 0, case when i % 5 = 0 then '3B' end);
    update nettest.people set institute = insts[1 + (i % 12)], role_label = roles[1 + (i % 6)],
      role_kind = case when roles[1 + (i % 6)] like 'PhD%' then 'phd' when roles[1 + (i % 6)] like 'Industry%' then 'industry' else 'faculty' end
     where user_id = u;
    insert into public.net_profile_ext (user_id, headline, interests, visibility_scope, second_degree, discoverable)
    values (u, 'Research on ' || (array['ESG reporting','supply chains','pricing','fintech','leadership','platforms'])[1 + (i % 6)],
            array[(array['esg','logistics','pricing','fintech','leadership','platforms'])[1 + (i % 6)], (array['msme','surveys','ai'])[1 + (i % 3)]],
            (array['presenters','all','all'])[1 + (i % 3)], i % 4 <> 0, i % 2 = 0);
    insert into public.net_profile_themes values (u, (array[2,3,1,5,6,7,4,8])[1 + (i % 8)], 1);
    if i % 3 = 0 then insert into public.net_profile_themes values (u, (array[1,2,3])[1 + (i % 3)], 2) on conflict do nothing; end if;
    ids := ids || u;
  end loop;

  -- You met Meera, Arjun, Sana and Rahul (the wireframe's "4 connections").
  insert into public.net_connections (a, b, initiator, source, context, session_id, created_at) values
    (least(you, meera), greatest(you, meera), you, 'coffee', 'Café terrace', '3B', now() - interval '3 hours'),
    (least(you, arjun), greatest(you, arjun), you, 'scan', 'Lunch · Table T2', null, now() - interval '2 hours'),
    (least(you, sana),  greatest(you, sana),  you, 'tap',  'Research circle', null, now() - interval '1 hour'),
    (least(you, rahul), greatest(you, rahul), rahul, 'tap', 'Office hours', null, now() - interval '30 minutes');
  insert into public.net_contact_grants (owner, viewer, source) values (meera, you, 'coffee'), (sana, you, 'share_on_tap');
  insert into public.net_person_notes (author, about, body) values
    (you, meera, 'Send her my MSME questionnaire draft.'), (you, arjun, 'Sharing cab back to Guwahati.'),
    (you, sana, 'Possible joint paper on NE clusters.'), (you, rahul, 'Ask for the validated scale.');
  insert into public.net_meetings (actor, other, source, context) values (you, kavya, 'table', 'Sustainability table'), (kavya, you, 'table', 'Sustainability table');

  -- Their connections (second degree for you) and a few links between them.
  for j in 1..36 loop
    u := ids[j];
    insert into public.net_connections (a, b, initiator, source)
    values (least(u, (array[meera, arjun, sana, rahul])[1 + (j % 4)]), greatest(u, (array[meera, arjun, sana, rahul])[1 + (j % 4)]), u, 'tap')
    on conflict do nothing;
    if j % 5 = 0 then
      insert into public.net_connections (a, b, initiator, source) values (least(u, ids[1 + ((j + 7) % 36)]), greatest(u, ids[1 + ((j + 7) % 36)]), u, 'scan') on conflict do nothing;
    end if;
  end loop;
  insert into public.net_connections (a, b, initiator, source) values (least(meera, rahul), greatest(meera, rahul), meera, 'coffee') on conflict do nothing;
  insert into public.net_connections (a, b, initiator, source) values (least(arjun, kavya), greatest(arjun, kavya), arjun, 'tap') on conflict do nothing;

  -- Cards. Raw demo tokens are printed here on purpose: they are fake and only work in the local harness.
  perform nettest.card(meera, 'MEERA000DEM00001', 'K7QX2M');
  perform nettest.card(arjun, 'ARJVN000DEM00002', 'ARJ234');
  perform nettest.card(sana,  'SANA0000DEM00003', 'SAN456');
  perform nettest.card(kavya, 'KAVYA000DEM00004', 'KAV789');
  perform nettest.card(tenzin,'TENZ1N00DEM00005', 'TEN234');
  insert into public.net_cards (token_hash, printed_code, batch) values
    (public.net__hash_token('VNB0VND0DEM00006'), 'HJ4N9P', 'demo'),
    (public.net__hash_token('SPARE000DEM00007'), 'WXYZ23', 'demo'),
    (public.net__hash_token('SPARE000DEM00008'), 'PQRS45', 'demo');
  insert into public.net_cards (token_hash, printed_code, status, revoked_at, batch)
    values (public.net__hash_token('REV0KED0DEM00009'), 'RVK234', 'revoked', now(), 'demo');

  insert into public.net_staff values (desk, 'desk'), (admin, 'admin');
  insert into public.net_reports (reporter, reported, reason, note) values (kavya, tenzin, 'spam', 'Sent the same message three times.');
  perform public.net_refresh_similarity_all();
  raise notice 'ok demo seed: % people', (select count(*) from nettest.people);
end $$;

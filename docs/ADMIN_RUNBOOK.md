# Admin runbook

For organisers, desk leads and the on-call engineer. SQL runs in the Supabase SQL editor of the host project
(which runs as `postgres`). Nothing here needs the service-role key in a browser.

## 1. Card batch (K-11, K-12): due end of Sun 15 Nov

1. Confirm N (delegates plus speakers plus volunteers) with the organisers (D-4). Quantity is `ceil(1.1 × N)`.
2. Generate the manifest in this repo:
   ```bash
   node tools/card-manifest/cli.mjs --count <N> --batch B1 --chip ntag213 --origin https://paniim.planos.in
   ```
   Output goes to `out/B1/` (git-ignored):
   - `vendor.csv` contains **raw tokens**. Send it to the vendor only, over their secure upload. Each row has the
     NDEF URI to encode, the same URL for the printed QR, the 6-character code for the back, and
     `lock_after_write=yes`.
   - `import.json` and `import.sql` contain hashes only, safe to keep.
   - `summary.txt` has counts and checksums, and the NDEF size (43 bytes, which fits NTAG213's 144).
3. Ask the vendor to confirm in writing: one locked, read-only NDEF URI record per card, QR and code printed,
   and the ship date (no later than 18 Nov).
4. Import the hashes. Either paste `out/B1/import.sql` into the SQL editor, or use the desk console:
   Cards → Import, then choose `import.json`.
5. After goods-in (step 3), delete `vendor.csv` from every machine. The database never had the raw tokens.

**Pre-bound passes (D-2 alternative).** Add `--roster names.txt` (one name per line, in print order). The vendor
CSV then carries `printed_name`, and the desk binds each card to its named delegate.

## 2. Staff for the desk console

```sql
-- desk volunteers can search, bind, unbind, revoke and see reports; admins can also flip the kill switch
insert into public.net_staff (user_id, role)
select id, 'desk' from auth.users where email in ('volunteer1@example.org', 'volunteer2@example.org')
on conflict (user_id) do update set role = excluded.role;

insert into public.net_staff (user_id, role)
select id, 'admin' from auth.users where email = 'organiser@example.org'
on conflict (user_id) do update set role = excluded.role;
```

Staff open `/network/desk`. Every action is written to `net_audit`.

## 3. Goods-in (K-15)

1. Count the boxes against `summary.txt` (`cards total`).
2. Read-test at least 10% (pick from every box). Tap each one on an iPhone and an Android: it must open
   `https://paniim.planos.in/t/…` and show "Activate your pass" when signed in.
3. Put failures in quarantine and replace them from the spares. Log them. The batch passes if fewer than 2% fail.
4. In the console under Cards, the batch should show N + 10% `unbound`.

## 4. Desk binding (K-24, K-60): target 30 seconds per delegate

1. Desk console → Bind → type the delegate's name or email → select them.
2. Ask: "Who should see you: other presenters, all delegates, or only people you meet?" The default is
   presenters, and the delegate can change it later in the app.
3. Type the 6-character code from the back of the card → **Bind card**.

Delegates can also self-activate by tapping their own card and typing the code.

## 5. Lost or stolen card (K-27): target under 60 seconds

- **Delegate on their own phone**: My pass → "Lost your card?" → Deactivate. The old card stops working at once.
- **At the desk**: Bind → find the delegate → type a spare card's code → **Lost card: swap to this spare**.
  This revokes the old card and binds the spare in one step. Connections are kept.
- If cards run out, the delegate can use My pass → "Use a digital pass" (a QR on their phone).

## 6. Event days: monitoring and rollback (K-61, K-62, K-75)

- Desk console → Metrics shows taps in the last hour, connections, activations, completion, map opens, errors,
  rate-limited calls and open reports. It refreshes every 30 seconds.
- **Kill switch** (admin role): Metrics → turn off "Taps and scans" and/or "Network map". This takes effect
  on the next request for everyone, with no deploy. Nothing is deleted, and the tap screen says
  "Taps are paused for a moment."
  The same from SQL:
  ```sql
  update public.net_feature_flags set enabled = false where key in ('tap', 'map');  -- pause
  update public.net_feature_flags set enabled = true  where key in ('tap', 'map');  -- resume
  ```
- **Rollback drill**: once on staging before Thu 26 Nov, pause, check that a tap shows the paused screen,
  resume, and check that a tap works again.
- **Reports**: Desk console → Reports. Resolve each with no action, spoke to them, or escalate. A blocked person
  is already hidden from the reporter.

## 7. Scheduled jobs

Similarity edges refresh when someone saves their profile. A nightly sweep keeps everyone's top 8 edges fresh,
and old tap events are pruned.

**If `pg_cron` is enabled** (Supabase dashboard → Database → Extensions):

```sql
select cron.schedule('net-similarity-nightly', '30 21 * * *', $$select public.net_refresh_similarity_all()$$); -- 03:00 IST
select cron.schedule('net-prune-daily',        '45 21 * * *', $$select public.net_prune()$$);
select cron.schedule('net-retention-29dec', '0 0 29 12 *', $$select public.net_retention_delete(false)$$);       -- 05:30 IST 29 Dec
```

**If not**, run the same `select` statements by hand in the SQL editor: similarity each night of the event,
and the retention deletion on 29 Dec (section 9).

## 8. After the conference (K-83)

- Delegates export their own contacts (accepted connections only) from My connections.
- On 30 Nov, the organisers export the follow-up list (Desk console → Metrics → "Export follow-up reminder list")
  and send the reminder email through their usual mailer.
- Organiser export of all cards: Desk console → Cards → Export CSV.

## 9. Retention deletion: Tue 29 Dec 2026 (K-64, K-76)

1. Dry run, which changes nothing:
   ```sql
   select public.net_retention_delete(true);
   ```
   This returns the row counts that would be deleted.
2. Real run, on or after 29 Dec:
   ```sql
   select public.net_retention_delete(false);
   ```
   This deletes connections, meetings, grants, notes, tap events, similarity edges, consents, blocks, reports,
   network profiles and metrics events, unlinks every card, and keeps only aggregate counts in `net_aggregates`.
   Host profile data is not touched. Before 29 Dec it refuses unless called as
   `net_retention_delete(false, true)`. Use that only for the staging dry run (K-64).
3. Verify (K-76): `select count(*) from public.net_connections;` returns 0, and
   `select * from public.net_aggregates;` shows the totals.
4. Optional, full removal: run `dist/network_uninstall.sql`.

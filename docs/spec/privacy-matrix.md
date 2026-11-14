# Privacy matrix and test plan

Source: PRD v0.2 section 6.3. Enforced in SQL functions only.

## 1. Order of evaluation

1. **Block.** If either user blocked the other: return `null` (or `{state:'unknown'}` for token resolution). Never reveal that a block exists.
2. **Scope.** Is the viewer allowed to see the owner at all?

   | Owner scope | Viewer may see owner if |
   |---|---|
   | `presenters` (default) | viewer `is_presenter`, or relation is `met` or `accepted` |
   | `all` | viewer `is_registered`, or relation is `met` or `accepted` |
   | `met` | relation is `met` or `accepted` |

   Exception (assumption, owner to confirm): a **physical tap or scan of an active card** by a signed-in user always passes the scope check, because the owner handed over the card. It never passes a block.
3. **Field rules** by relationship and access path.

## 2. Access paths

`tap` (token), `directory` (search, session-mates), `graph` (ego graph node), `overlap` (counts and region lists), `detail` (profile detail RPC).

## 3. Fields by relationship

| Field | Tap viewer (stranger via card) | Met | Accepted | Second-degree node on map |
|---|---|---|---|---|
| Name, institute, role | Yes | Yes | Yes | Yes, only if owner `second_degree` is true |
| Photo, headline, key finding | Yes | Yes | Yes | Yes |
| Themes | Yes | Yes | Yes | Yes |
| Interests, ask-me-about, open-to | No | Yes | Yes | No |
| Paper, session, slides | Yes | Yes | Yes | No |
| Ask and offer text | Yes | Yes | Yes | Yes |
| Email, phone, LinkedIn | **No**, unless `share_on_tap` is true (then only the fields in `contact_fields`) | No | Only fields in `contact_fields` | No |
| Mutual connections | Count only | Names where each mutual's scope allows | Same | Count only |
| Path to me | No | Yes (each hop allowed) | Yes | Yes (each hop allowed) |
| Private note | Author only | Author only | Author only | Author only |

## 4. Settings

- `visibility_scope`: `presenters` (default), `all`, `met`.
- Optional toggles, all default **off**: `share_on_tap`, `second_degree`, `discoverable`.
- `contact_fields`: subset of email, phone, linkedin; default email.
- `discoverable` is required to appear in **Event** overlap counts, suggestions and the Galaxy.
- `second_degree` is required to appear as a friend-of-friend node.

## 5. Test plan (the 96 cases)

Generate programmatically (pgTAP or plain SQL asserts run in a loop):

- Owner scope (3) x optional toggles (2^3 = 8) x viewer relationship (4: stranger, met, accepted, blocked) = **96** combinations.
- For each combination assert, for **every** function that can return a person (`net_get_profile_by_token`, `net_get_profile_detail`, `net_get_ego_graph`, `net_search_people`, `net_list_region`, `net_venn_counts`): the returned fields equal the expected set from the table above, and no contact field is present unless allowed.
- Also assert: blocked returns identical output to a non-existent user; counts in `net_venn_counts` equal the length of the matching `net_list_region` results summed; `anon` gets no rows from any table and can call only `net_resolve_token`; an `authenticated` user cannot `INSERT`, `UPDATE`, `DELETE` or `SELECT` on any `net_` table; a user cannot call `net_admin_*` unless `net_is_staff()`; `net_consents` rejects UPDATE and DELETE; undo fails after 8 seconds and for a non-initiator.

## 6. Separate probe

`tools/rls-probe`: takes a project URL and an anon key, attempts `select`, `insert`, `update`, `delete` on every `net_` table through the REST API and calls every RPC without a session. Passes only if every table returns zero rows or an error and only `net_resolve_token` succeeds. Run it against the local database in CI and by the integrator against the real project after install.

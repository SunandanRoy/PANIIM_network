**PAN-IIM WMC 2026**

Network: tap card, constellation and overlap map

Product requirements document, version 0.2. Integrates the NFC pass, the connection graph and the theme overlap view into the wireframed Network page.

| **Item**            | **Detail**                                                                            |
|---------------------|---------------------------------------------------------------------------------------|
| **Event**           | Pan-IIM WMC 2026, IIM Shillong, 27 to 29 November 2026                                |
| **Product**         | Extension of the community app at paniim.planos.in                                    |
| **Version**         | 0.2 draft, 13 November 2026. Supersedes the HTML PRD v0.1 of the same day.            |
| **Basis**           | Six-page wireframe PDF "Network page sample UIs", plus the v0.1 recon of the live app |
| **Status**          | For organizer and engineering review. Nothing here is signed off.                     |
| **Delivery window** | Sat 14 Nov to Thu 26 Nov build, event Fri 27 to Sun 29 Nov (13 build days)            |
| **Companion files** | Kanban board (60 tickets) and kanban.csv, regenerated for this version                |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>How to read this document</strong></p>
<p>Sections 1 to 4 say what changed and why. Sections 5 and 6 are the product specification. Sections 7 and 8 are for engineering. Section 9 is the plan and its honest limits. Section 10 lists the decisions I need from you.</p>
<p>Anything marked <strong>proposed</strong> is my recommendation, not something the wireframes show. Anything marked <strong>estimate</strong> is my own sizing and not a vendor or team figure.</p></td>
</tr>
</tbody>
</table>

# Contents

1 Summary

2 What the wireframes show

3 How the wireframes change v0.1

4 Scope: what this PRD covers and what it does not

5 Product specification

6 Cards, connections and privacy

7 Architecture and data

8 Non-functional requirements

9 Requirements, plan and capacity

10 Risks and open decisions

11 Sources

Appendix A Ticket list

## Version history

| **Version** | **Date**    | **Change**                                                                                                                                                                                                                                                                                       |
|-------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0.1         | 13 Nov 2026 | First PRD as an HTML page, written from the live app and the brief. No wireframes were available.                                                                                                                                                                                                |
| 0.2         | 13 Nov 2026 | Rebuilt around the six wireframe screens. Contact reveal changed to accept-based. Visibility scope added. Report and block added. Edge sources widened. Network home and profile screen specified against the wireframes. Tickets rebuilt: 60 tickets, 69.5 ideal-days (v0.1: 56 tickets, 61.5). |

**Dependency changes disclosed.** To keep the 13-day plan feasible I re-modelled four dependencies: the tap result screen (K-23) no longer waits for the profile schema, and K-33, K-41 and K-53 now name the migration (K-20) and the sign-off (K-05) explicitly. The wireframed profile and visibility scope also lengthen four tickets on the software chain (K-30, K-32, K-33, K-34). The result is zero float on both chains, where v0.1 had one day on the software chain.

# 1 Summary

## 1.1 What we are building

Every participant gets a card with an NFC chip. Tapping it on another phone opens that person on the Pan-IIM platform, using the same profile screen the Network page already wireframes. The tap also records that the two people met. Those meetings form a graph, and the Network page shows it two ways: a force-directed constellation of you, your connections and their connections, and an overlap view that splits the same people by theme (for example finance, sustainability, strategy). Tapping any dot opens that person's full profile.

## 1.2 What the wireframes changed

- **The Network page already exists on paper.** It is a mobile page with a visibility banner, search, theme chips, three quick actions, session-mates, asks and offers, office hours, tables and outings, and a connections row. We add to it; we do not replace it.

- **Contact details are accept-based.** The wireframe says email and phone are shared only after the person accepts a request. v0.1 auto-connected and showed contact fields. v0.2 follows the wireframe.

- **Visibility has a scope.** The banner says "You're visible to other presenters", so the unit of privacy is who can see you, not only which fields. v0.2 adds a three-value scope that the map and the overlap view must honour.

- **A connection can come from more than a tap.** Coffee requests, office hours, tables and circles are all ways people meet. The graph needs one contract for recording any of them.

- **Report or block is wireframed**, and v0.1 had no such feature. It is now a P0 ticket.

## 1.3 Findings you should know before reading further

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Four things the plan cannot hide</strong></p>
<p><strong>1. Two front-end engineers cannot deliver P0.</strong> P0 front-end work is 23.0 ideal-days, which is 2.53 people at 70% focus over 13 days. v0.1 said about 2.3.</p>
<p><strong>2. Three front-end engineers fit only after cuts.</strong> P0 plus P1 needs 30.5 days (3.35 people). Three people supply 27.3. Cutting steps 1 to 3 in section 9.4 leaves 27.0, a margin of 0.3 days, which is effectively none.</p>
<p><strong>3. The card order has zero float.</strong> It must be placed by the end of Sun 15 Nov, and the vendor ship date must be confirmed in writing first. The software chain also has zero float now.</p>
<p><strong>4. The wireframed host modules are not in this plan.</strong> Coffee requests, the asks board, office hours and tables are outside the 60 tickets. My estimate for building them is 17 ideal-days (section 4.2). If they are not already built, they need their own team.</p></td>
</tr>
</tbody>
</table>

# 2 What the wireframes show

The PDF has six mobile screens. I read each one at 130 dpi and the page text with pdftotext. Where a label was clipped in the export I say so rather than guess.

## 2.1 Screen inventory

| **\#** | **Screen**                  | **What it contains**                                                                                                                                                                                                                                                                                                                                      | **Relevance to this PRD**                                                                                               |
|--------|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| 1      | Network home                | Banner "You're visible to other presenters. Contact details stay hidden until you accept." with Edit. Search delegates. Theme chips. Scan a pass, Post an ask, Join a table. Session-mates (with a coffee button each). Asks and offers carousel. Office hours today. Tables and outings. My connections row: "4 connections, 2 coffee requests waiting". | Host page. The map and overlap entry points attach here. The QR icon top right and Scan a pass are the NFC touchpoints. |
| 2      | Profile screen              | Avatar, name, role, institute, "In your session" tag. Request a 15-min coffee. Follow, Ask a question, Save. Presenting block with session and room. Key finding in one line. Read abstract, Download slides. Ask me about, Open to, Office hours. Footer: "Email and phone are shared only after Meera accepts a request. Report or block."              | Becomes the single profile screen opened by tap, search, session-mates and map nodes.                                   |
| 3      | New request                 | "Coffee with Meera, 15 minutes, in person." Why would you like to meet (chips). Times you're both free from both calendars, gaps between sessions only. Where. Send request. Note that contact is shared only if she accepts.                                                                                                                             | Defines the accept rule and a non-tap way two people become connected.                                                  |
| 4      | Asks and offers             | Post as Ask or Offer, filters All / Asks / Offers, cards with theme tag, author, reply count and an "I can help" button.                                                                                                                                                                                                                                  | Source of the ask and offer badge on the profile and node tooltip.                                                      |
| 5      | Tables, circles and outings | Lunch tables with seats left, outings with headcounts, joining flows.                                                                                                                                                                                                                                                                                     | Shared context and another way to meet.                                                                                 |
| 6      | Connections and follow-up   | List of accepted people, coffee requests waiting, an office-hours entry with a note, and an "After the conference" box: "Take your contacts with you, and get a reminder to follow up." with two buttons. The first reads Export contacts; the second is clipped in the export, roughly "Email me a digest/direct…".                                      | The connections list the graph is built from. The export respects accept-based contact.                                 |

## 2.2 Design language to match

- Off-white page, deep-green primary buttons and links, white cards with a thin warm-grey border and large radii.

- Pill chips; the active chip is near-black. Tag colours: pale green, tan and lavender.

- Initials in pastel circles in place of photos in lists. Names in bold, institute in grey, one-line research title beneath.

- Uppercase letter-spaced eyebrows for section kinds (LUNCH TABLE, OUTING, PRESENTING). Plain-sentence privacy notes under actions.

The mockups in section 5 follow these conventions. They are built from the wireframe's own sample names and are **illustrative**: counts and people are invented to show layout.

## 2.3 What the wireframes do not say

- The QR icon on Network home is unlabelled. I read it as "my pass". If it is a scanner, the pass moves into My connections and nothing else changes (**proposed**, Q-9).

- Nothing in the PDF mentions NFC, the constellation or the overlap view. This PRD adds them. The wireframes were drawn for the page, not for these features.

- The wireframes do not show the empty state of Network home for someone with no session or no connections.

- Who "other presenters" are is not defined. I assume it means registered delegates whose paper is on the programme.

# 3 How the wireframes change v0.1

Each row is a v0.1 assumption that the wireframes contradict or extend, and what v0.2 does about it.

| **Topic**       | **v0.1 said**                                                                  | **Wireframes say**                                                                        | **v0.2 decision**                                                                                                                                              |
|-----------------|--------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Contact reveal  | Tap auto-connected; contact fields shown to connections the owner switched on. | Email and phone shared only after the person accepts a request.                           | Tap records "met" and shows the profile. Contact appears only after accept, or instantly if the owner turned on share-on-tap (default off). Open decision D-3. |
| Visibility      | Fields gated by five toggles; discoverability off by default.                  | "Visible to other presenters" banner with Edit.                                           | Add scope: presenters (default), all delegates, people I've met. Map and overlap respect it. Toggles reduce to three optional.                                 |
| Edge sources    | Tap only (QR as a fallback).                                                   | Coffee requests, office hours, tables and circles also bring people together.             | One record_meeting function with six sources: tap, scan, coffee, circle, office_hours, table. Which ones create an edge is open (D-5).                         |
| Passes          | Unbound cards activated by the delegate with a printed code.                   | Page says "Scan a pass" and implies registered presenters.                                | Keep unbound cards plus desk bulk-binding. Pre-bound passes stay possible from the manifest (D-2).                                                             |
| Safety          | No report or block.                                                            | "Report or block" on the profile screen.                                                  | New P0 ticket K-81: block, report, admin queue.                                                                                                                |
| Domains         | Called domains; 8 to 12 seeded from paper tracks.                              | Called themes: Strategy and Innovation, Sustainability.                                   | Rename to themes. Seed from tracks and chips. Same maximum of 3 per person.                                                                                    |
| Profile screen  | Own design in K-34.                                                            | Full layout including presenting block, key finding, Ask me about, Open to, office hours. | K-34 follows the wireframe, then adds mutual connections, path to me, shared sessions and a note. Effort 2.0 to 3.0 days.                                      |
| Entry points    | A new Network tab.                                                             | Network is already a page.                                                                | No new tab. Add a map preview card and a Map button on the connections row.                                                                                    |
| After the event | Export and deletion only.                                                      | "After the conference" box with export and a reminder.                                    | K-83 added. Export includes only accepted connections.                                                                                                         |

# 4 Scope: what this PRD covers and what it does not

## 4.1 In scope

- **NFC pass and card operations:** manifest, ordering, activation, desk console, lost-card flow, QR fallback, scan sheet.

- **Tap flow:** the /t/\<token\> route, tap result screen, connection creation with undo, report and block.

- **Network home additions:** map preview card, Map button, My pass, visibility scope editor.

- **Profile:** schema extension, visibility enforcement, the wireframed profile screen with the extra graph fields.

- **Constellation and overlap:** the two views, filters, list view, empty states, similarity.

- **Admin, security, QA and rollout** for all of the above.

## 4.2 Wireframed but outside the 60 tickets

These modules appear on the wireframes. I do not know which already exist in the live app. If any do not, they are separate work and must not be assumed to fit in this plan. The sizes below are **my estimate** at roughly ±50% and are not in the board.

| **Module**                         | **What it needs**                                                                                                         | **Front end (days)** | **Back end (days)** |
|------------------------------------|---------------------------------------------------------------------------------------------------------------------------|----------------------|---------------------|
| Directory search and session-mates | Search by name, institute, topic; theme chips; "In your session" matching from the programme.                             | 2.0                  | 1.0                 |
| Coffee requests                    | Request sheet, both-calendars free slots, accept, decline, suggest another time, waiting count, contact reveal on accept. | 3.0                  | 2.5                 |
| Asks and offers board              | Post, filter, replies, "I can help".                                                                                      | 2.0                  | 1.0                 |
| Office hours                       | Listing for today, join.                                                                                                  | 1.0                  | 0.5                 |
| Tables, circles and outings        | Seats, join, headcount, shared context.                                                                                   | 2.5                  | 1.5                 |
| **Total (estimate)**               |                                                                                                                           | **10.5**             | **6.5**             |

The network extension needs only one thing from these modules: a call to record_meeting when two people meet through them (section 6.2). It does not depend on them being finished.

## 4.3 Out of scope

- Payments, ticketing, programme editing and anything unrelated to people discovery.

- Native iOS or Android apps. Web NFC is not relied on (section 6.1).

- Recommendation of who to meet beyond the similarity score (P2 suggested connections is the only exception).

- Legal advice. The privacy design follows the DPDP rules, but counsel must confirm the data-fiduciary question (Q-3).

# 5 Product specification

## 5.1 Network home: what changes

Everything on the wireframe stays, in the same order. Four things are added.

<img src="media/ecf3e3bf491cc63c2444d6fa36371751cf6383b5.png" title="Figure 1. Network home with the four additions outlined. Illustrative content." style="width:6.5in;height:6.88542in" alt="Figure 1. Network home with the four additions outlined. Illustrative content." />

*Figure 1. Network home with the four additions outlined. Illustrative content.*

| **\#** | **Addition**                  | **Behaviour**                                                                                                                                                                                                              |
|--------|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | My pass                       | The QR icon opens the participant's own pass: card status (unbound, active, revoked), the printed 6-character code, a QR for the same URL and a share-link button. Proposed; see Q-9.                                      |
| 2      | Visibility banner             | Existing copy kept. Edit opens a sheet with the scope selector and the three optional toggles. The banner text follows the scope: "You're visible to other presenters", "to all delegates" or "only to people you've met". |
| 3      | Network map preview           | New card after the quick actions. A 150-pixel static preview, the connection and two-step counts, and theme legend chips. Opens the full map. If the person has no connections, shows the empty state instead of a graph.  |
| 4      | Map button on connections row | The wireframed row (avatars, count, "2 coffee requests waiting") gains a Map button. Tapping the row still opens the list.                                                                                                 |

**Scan a pass** (wireframed quick action) opens the scan sheet: camera QR scan and a field for the 6-character code. Both resolve to the same profile screen as an NFC tap. This is the main answer for older phones and for iPhones that do not read tags in the current state (section 6.1).

## 5.2 Tap result

<img src="media/b4b62b906be7d0b443ab53dd467f5c5f66ba2c24.png" title="Figure 2. Left: tap result for an active card. Right: first tap of an unbound card. Illustrative content; copy is proposed." style="width:6.5in;height:4.73958in" alt="Figure 2. Left: tap result for an active card. Right: first tap of an unbound card. Illustrative content; copy is proposed." />

*Figure 2. Left: tap result for an active card. Right: first tap of an unbound card. Illustrative content; copy is proposed.*

A tap opens https://paniim.planos.in/t/\<token\> in the phone's browser. The state machine is:

| **State**          | **What the viewer sees**                                                                                                                                                                                                                                                           |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Signed out         | Sign in, then return to the same token URL. The target is 2 taps or fewer on iOS Safari and in the installed app (K-29 spike).                                                                                                                                                     |
| Active card        | Compact profile card with the person's name, role, institute, session tag, mutual-connection count and research line, per the wireframe. The connection is created after the page renders, with an 8-second undo bar. Buttons: Request a 15-min coffee, Full profile, Show on map. |
| Already connected  | Same card with a Connected badge and no toast.                                                                                                                                                                                                                                     |
| Unbound card       | Activation screen: enter the printed code, confirm the visibility choice, link. A desk volunteer can bind it from the console instead.                                                                                                                                             |
| Revoked card       | "This pass was replaced. Ask the desk." No profile.                                                                                                                                                                                                                                |
| Unknown token      | "We couldn't read this pass." with Scan a pass.                                                                                                                                                                                                                                    |
| Blocked either way | Behaves as an unknown token. Neither side learns the other blocked.                                                                                                                                                                                                                |

**A tap never changes anything by itself.** The GET only reads. The connection comes from an authenticated call made after render, so a link preview or a crawler cannot create connections.

**Contact details are never on the tap result** unless the owner turned on share-on-tap (D-3). The footer line from the wireframe stays: "Email and phone are shared only after Meera accepts a request."

## 5.3 Profile screen

One screen serves tap, search, session-mates, connections and the map. It follows the wireframe in full: header, coffee request, Follow, Ask a question, Save, Presenting block, key finding, abstract and slides, Ask me about, Open to, office hours, privacy footer, Report or block. The constellation adds four things, placed under the header so the wireframed content keeps its order below them:

- **Mutual connections:** names or a count, depending on each person's scope.

- **Path to me:** "You, Arjun, Sana, Meera" with each name opening its own profile. Hidden when the path would pass through someone whose scope does not allow it.

- **Shared sessions:** sessions both people starred or attended.

- **Private note:** visible only to the author.

On phones it is a full screen with a back arrow. On desktop it opens as a side panel beside the map. Ask and offer text appears as a badge (P2, K-79).

## 5.4 Constellation map

<img src="media/4f16eb7db932baac27c9ff655a073d50c62c023e.png" title="Figure 3. The constellation. Node colour is the person&#39;s first theme; the ring marks the selected person. Illustrative layout, not data." style="width:6.5in;height:5.14583in" alt="Figure 3. The constellation. Node colour is the person&#39;s first theme; the ring marks the selected person. Illustrative layout, not data." />

*Figure 3. The constellation. Node colour is the person's first theme; the ring marks the selected person. Illustrative layout, not data.*

| **Element**    | **Specification**                                                                                                                                                                                                                                                                 |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Nodes          | You, your connections, and their connections (depth 2) who allow second-degree visibility and whose scope permits you. Hard cap of 300 nodes. If more qualify, the nearest by similarity are kept.                                                                                |
| Colour         | First theme of the person. A small inner dot shows a second theme. The third theme appears in the profile only. Theme name is always repeated in the legend and the profile, so colour is never the only cue.                                                                     |
| Size and edges | Node radius grows with connection count. Edge width carries similarity. Direct connections are drawn solid; second-degree ones lighter.                                                                                                                                           |
| Layout         | Force-directed (d3-force on canvas, lazy-loaded). Links pull friends together, nodes repel, a radial force keeps depth rings, and a pull toward theme anchors gives the hulls. The layout is pre-settled for a short time before first paint, so the user never sees it scramble. |
| Interaction    | Pinch or scroll to zoom, drag to pan, drag a node to pin it. Tap a node: peek card, neighbours highlighted, path to you drawn. Open raises the profile screen. Esc closes it and returns focus to the node.                                                                       |
| Controls       | Theme chips (reusing the wireframed chips), 1 or 2 steps, zoom buttons. Search with fly-to-node. Filter by institute, role or session (P1).                                                                                                                                       |
| Fallbacks      | A list view with the same filters (P1). A static layout when the phone asks for reduced motion. Designed empty states for zero, one or two connections.                                                                                                                           |
| Performance    | 30 fps or more at 150 nodes on a mid-range Android phone. Graph code is a separate chunk of 100 kB gzipped or less, fetched only when the map opens.                                                                                                                              |

**Similarity.** S = 0.40 x J(themes) + 0.25 x cos(interests) + 0.20 x J(starred sessions) + 0.15 x min(1, mutual / 5), where J is the Jaccard index and cos is cosine similarity of interest-tag vectors. The target link distance is 40 + 120 x (1 - S) pixels. A nightly job and a save-triggered job keep the top 8 edges per person (K-50).

## 5.5 Overlap view (Venn-style)

<img src="media/31242c9f7c455ce140e488be7c84a5be2b1d8122.png" title="Figure 4. Overlap mode with three themes selected. Illustrative counts; the seven regions add to 23." style="width:6.5in;height:5.20833in" alt="Figure 4. Overlap mode with three themes selected. Illustrative counts; the seven regions add to 23." />

*Figure 4. Overlap mode with three themes selected. Illustrative counts; the seven regions add to 23.*

- Pick up to **three** themes. Three themes make exactly seven regions. Four would need 15, which does not read on a phone, so a fourth is not offered.

- Scope toggle: **My network** counts people in your graph; **Event** counts every discoverable delegate.

- Tap a region to list the people in it. Each row opens the profile screen.

- Counts include only people whose scope lets you see them. Region counts add up to the number of in-scope people holding at least one selected theme, and the screen says so.

- The same theme chips filter both views, so the person never sets them twice.

**Event Galaxy** (P2) is the Cinemetrica-style star field of all discoverable delegates, each linked to its five nearest by similarity. It is first in the cut order.

# 6 Cards, connections and privacy

## 6.1 The NFC card

| **Question**        | **Specification and reasoning**                                                                                                                                                                                                                                                                                                                                     |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| What is on the chip | One locked, read-only NDEF URI record: https://paniim.planos.in/t/\<16-character token\>. The token is 80 bits (Crockford base32); only its SHA-256 is stored. 43 bytes with framing, which fits NTAG213 (144 bytes) with room to spare.                                                                                                                            |
| Chip tier           | **Tier A (recommended): NTAG213/215.** Static, cheap, widely available. **Tier B: NTAG 424 DNA** adds an AES-128 signed, counter-based URL that resists cloning, but only if the vendor confirms in writing it can pre-encode it in time (K-04). Tier A is the default because the downside of a cloned card is an unwanted connection, which the owner can remove. |
| Phones              | iPhone XS and later read tags in the background, except when the camera is in use, airplane mode is on, Wallet is in use, a Core NFC session is active, or the phone has not been unlocked since boot. Android reads NFC when the screen is on and unlocked. **Web NFC works only in Chrome for Android, so we do not rely on it.**                                 |
| Fallbacks           | The card face carries a QR with the same URL and a 6-character code. Scan a pass handles both.                                                                                                                                                                                                                                                                      |
| Bound or unbound    | **Proposed:** unbound cards with the printed code, self-activated or desk-bound. A pre-bound pass (name on card) is possible from the manifest but locks the printing to the registration list on Sun 15 Nov, which is a risk for late registrants. D-2.                                                                                                            |
| Quantity            | ceil(1.1 x N): 550 for 500 delegates, 1,100 for 1,000, 2,200 for 2,000. N is needed from the organizers (D-4).                                                                                                                                                                                                                                                      |

## 6.2 What counts as a connection

A connection is one row per pair, mutual, with a source and a context label. Everything that records a meeting goes through one function, record_meeting(a, b, source, context), so the graph stays consistent whatever feature the meeting came from.

| **Source**    | **Trigger**                                  | **Notes**                                                             |
|---------------|----------------------------------------------|-----------------------------------------------------------------------|
| tap           | Authenticated call after a card tap renders. | Context is the live session, if any. Eight-second undo. Rate limited. |
| scan          | Same, via the scan sheet.                    | Identical result to tap.                                              |
| coffee        | Accepted coffee request.                     | Also the moment contact details become visible.                       |
| office_hours  | Attended an office-hours slot together.      | **Proposed:** not an edge on its own (D-5).                           |
| table, circle | Shared a table or circle.                    | **Proposed:** shown as shared context, not an edge (D-5).             |

**Proposed default:** only tap, scan and accepted coffee requests create edges. Co-attendance is shown on the profile as "Both at Sustainability table" but does not draw a line, because a table of eight would otherwise add 28 lines nobody chose. D-5.

## 6.3 Who can see what

Visibility has three layers, checked in this order by the server:

1.  **Block.** If either side blocked the other, nothing is returned.

2.  **Scope.** The owner's scope (presenters, all delegates, people I've met) must include the viewer, or the person is not returned at all. They do not appear in the map, the overlap counts, search or suggestions.

3.  **Field rules.** Fields returned depend on the relationship below.

| **Field**                      | **Tap viewer** | **Met**     | **Accepted**                    | **Second-degree on map** |
|--------------------------------|----------------|-------------|---------------------------------|--------------------------|
| Name, institute, role          | Yes            | Yes         | Yes                             | If second-degree on      |
| Photo, headline, research line | Yes            | Yes         | Yes                             | Yes                      |
| Themes, interests              | Themes         | Both        | Both                            | Themes                   |
| Paper, session, slides         | Yes            | Yes         | Yes                             | No                       |
| Ask and offer                  | Yes            | Yes         | Yes                             | Yes                      |
| Email, phone, LinkedIn         | No             | No          | Fields the owner made available | No                       |
| Private note                   | Author only    | Author only | Author only                     | Author only              |

This matrix is enforced in server functions, never in the browser. A client that asks for more than it may have receives less, silently.

### Settings (replaces the v0.1 five toggles)

| **Setting**                           | **Default** | **What it does**                                                        |
|---------------------------------------|-------------|-------------------------------------------------------------------------|
| Visibility scope                      | Presenters  | Who can see you at all: presenters, all delegates, or people I've met.  |
| Share contact on tap                  | Off         | Skips the accept step for the contact fields you made available.        |
| Show me to friends of friends         | Off         | Lets two-step connections see you as a node.                            |
| Discoverable                          | Off         | Lets you appear in Event overlap counts, suggestions and the Galaxy.    |
| Contact fields available after accept | Email on    | Choose among email, phone, LinkedIn. This is profile data, not consent. |

Every grant and withdrawal appends a row with the consent-text version and a timestamp. Nothing is updated in place. Withdrawal takes effect on the next request.

## 6.4 Law and retention

India's DPDP Rules were notified in November 2025 with phased commencement. Sources disagree by a day on the notification date, and place the consent-manager provisions around mid-November 2026 and the main obligations around May 2027. During this event the full notice and consent duties are therefore not yet in force, but the design above follows them because it costs little now. Two questions need counsel, not me: who is the data fiduciary (IIM Shillong or the committee) and whether PlanOS is a processor (Q-3). This is not legal advice.

**Retention (proposed):** delete connections, notes, tap events, similarity edges and consent rows on Tue 29 Dec 2026 (29 Nov plus 30 days). Keep aggregate counts without identifiers. Delegates can delete their own network data at any time. Photos follow the existing app's rule (Q-8).

# 7 Architecture and data

## 7.1 The stack, and how confident I am

The live app looks like a React single-page app on a hosted Postgres backend of the Supabase kind, in the style of Lovable or GPT-Engineer builds. The evidence is indirect (an OG image in a gpt-engineer-file-uploads bucket and the page structure), so my confidence is **medium to low**. K-03 asks the PlanOS team to confirm in writing by Sat 14 Nov.

To make the plan survive a wrong guess, every server action is specified as a named function with typed inputs and outputs. If the backend differs, only the layer behind those names changes. The client never talks to tables directly.

## 7.2 Tables

| **Table**           | **Purpose and key columns**                                                                     |
|---------------------|-------------------------------------------------------------------------------------------------|
| themes              | Renamed from domains. slug, label, colour. 8 to 12 rows.                                        |
| profile_themes      | Join: profile_id, theme_id, rank (max 3 per person).                                            |
| profiles (extended) | Adds headline, bio, photo_url, ask_text, offer_text, visibility_scope, contact_fields.          |
| nfc_cards           | token_hash, printed_code, chip, status (unbound, active, revoked), profile_id, batch, last_ctr. |
| connections         | a, b (a \< b), initiator, source, context, card_id, session_id, removed_at. Unique on the pair. |
| blocks              | blocker, blocked, created_at. Reports reference it.                                             |
| consents            | Append-only: profile_id, key, value, text_version, at.                                          |
| person_notes        | author, about, body. Author only.                                                               |
| tap_events          | Audit and rate limiting: viewer, token_hash, at, result.                                        |
| similarity_edges    | Top 8 per person, refreshed nightly and on profile save.                                        |
| feature_flags       | Kill switch for tap and map.                                                                    |

Row-level security is on for every table, with no write policies. All writes go through security-definer functions. The public key must return nothing from any table, and K-63 proves it with a probe script. A reported misconfiguration pattern in these generated stacks is why that ticket is P0.

## 7.3 Functions (the server contract)

| **Function**                             | **Behaviour**                                                                                                |
|------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| get_profile_by_token(token)              | Resolves a card. Read-only. Applies block and scope. Never returns contact fields.                           |
| connect_via_card(token)                  | Idempotent. Creates the pair if absent, tagged with source and live session. Self-tap blocked. Rate limited. |
| record_meeting(a, b, source, context)    | Single write path for every source. Accepts only the six listed sources.                                     |
| undo_connection(id)                      | Allowed for 8 seconds by the initiator. Sets removed_at.                                                     |
| activate_card(code)                      | Binds an unbound card to the caller after the visibility choice.                                             |
| admin_bind / unbind / revoke_card        | Desk console. Writes an audit row.                                                                           |
| set_consent(key, value)                  | Appends a consent row; takes effect next request.                                                            |
| get_profile_detail(id)                   | Applies block, scope and field rules. Includes mutual, path and shared sessions.                             |
| get_ego_graph(depth, limit)              | Depth 2, cap 300 nodes, p95 under 400 ms at 150 nodes.                                                       |
| venn_counts(theme_ids, scope)            | Up to 3 themes; seven region counts; honours scope.                                                          |
| block_user(id) / report_user(id, reason) | Block hides both ways. Reports reach the admin queue.                                                        |
| get_galaxy()                             | P2. All discoverable delegates with top 5 neighbours.                                                        |

## 7.4 Delivery

- Graph code is lazy-loaded so the rest of the app does not grow. The Network route loads it only when the map opens.

- A feature flag disables tap and the map without a deploy. Rollback is rehearsed once on staging (K-75).

- No service key ever reaches the client bundle; K-63 greps for it.

# 8 Non-functional requirements

| **Area**      | **Requirement**                                                                                                                             |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Speed         | Tap to rendered profile: median 2.0 s or less on 4G with a warm session. Map settles in 3 s or less. Overlap counts return in under 400 ms. |
| Load          | 500 taps per minute with p95 under 800 ms and no 5xx. 2,000-node Galaxy renders on a mid-range Android (P2).                                |
| Devices       | At least 8 devices in the matrix: iPhone XS or later, iPhone 11 to 15, Pixel, Samsung, Xiaomi, NFC off, Safari versus installed app.        |
| Accessibility | Every map action has a list or keyboard equivalent. Tap targets 44 px or larger. Colour is never the only cue. Reduced motion respected.    |
| Connectivity  | Small payloads, skeleton loading, a local retry queue for connect, and the last profile cached for the venue's weak signal.                 |
| Privacy       | Section 6.3 rules enforced server-side. Consent append-only. Deletion on 29 Dec 2026 with a dry run on staging.                             |
| Observability | Admin tile with taps, unique connections, activations, completion, map opens and errors. Hypercare rota 07:00 to 23:00 on 27 to 29 Nov.     |
| Security      | RLS on all tables, anon-key probe passing, rate limits, kill switch, audit log on card admin actions.                                       |

# 9 Requirements, plan and capacity

## 9.1 Requirements and traceability

There are 40 requirements. Every ticket except the two completed documents (K-01, K-02) maps to exactly one requirement, and each requirement takes the highest priority of its tickets. The check is run by script on every rebuild.

| **ID**                               | **Requirement**                                                                                                                                                                                                                 | **Pri.** | **Tickets**      |
|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|------------------|
| **Cards and desk**                   |                                                                                                                                                                                                                                 |          |                  |
| FR-01                                | Each card holds one locked, read-only NDEF URI record, https://paniim.planos.in/t/\<16-char token\> (43 bytes). Tokens come from a generator that outputs N plus 10% spares with no duplicates.                                 | P0       | K-12, K-13, K-14 |
| FR-02                                | Card face carries the event mark, a tap symbol, a QR with the same URL and a 6-character activation code. Order placed by end of Sun 15 Nov.                                                                                    | P0       | K-10, K-11, K-17 |
| FR-03                                | Goods-in: count the delivery and read-test at least 10% before release. Desk kit prepared with signage and spare cards.                                                                                                         | P0       | K-15, K-16       |
| FR-04                                | Activation binds a card to a signed-in delegate after the printed code and the visibility choice. Desk volunteers can bind on a delegate's behalf.                                                                              | P0       | K-24             |
| FR-05                                | Desk console: search a delegate, bind, unbind, revoke, see batch status, export CSV. Binding takes 30 seconds or less.                                                                                                          | P0       | K-60             |
| FR-06                                | A delegate can report a card lost; the old token deactivates at once and a spare binds in under 60 seconds.                                                                                                                     | P1       | K-27             |
| FR-07                                | My pass (the QR icon on Network home) shows the card state, a QR for the same URL and a share-link button.                                                                                                                      | P0       | K-25             |
| FR-08                                | Scan a pass: in-app QR scan and 6-character code entry resolve to the same profile screen as a tap, for phones without background NFC.                                                                                          | P1       | K-77             |
| **Tap and connections**              |                                                                                                                                                                                                                                 |          |                  |
| FR-10                                | /t/:token renders distinct screens for unbound, active, revoked and unknown cards. A signed-out viewer signs in and returns to the same URL. iOS Safari versus installed-app sessions are tested; sign-in takes 2 taps at most. | P0       | K-21, K-29       |
| FR-11                                | Opening the URL changes nothing. The connection is created by an authenticated call after render and shown with an 8-second undo. A tap never reveals contact details on its own.                                               | P0       | K-22, K-23       |
| FR-12                                | One connection row per pair, mutual, self-tap blocked, tagged with its source (tap, scan, coffee, circle, office hours, table) and the session that was live. Non-tap sources are written through record_meeting.               | P0       | K-20, K-28       |
| FR-13                                | Rate limits on resolve and connect, and a kill switch that disables tap and map without a deploy.                                                                                                                               | P0       | K-62             |
| FR-14                                | My connections (wireframed row) opens a list with search, a private note and Remove.                                                                                                                                            | P1       | K-26             |
| FR-15                                | Report or block from the profile screen. A blocked person disappears from the other's map, Venn, directory and search; reports reach an admin queue.                                                                            | P0       | K-81             |
| **Profile, visibility and consent**  |                                                                                                                                                                                                                                 |          |                  |
| FR-20                                | Profile gains headline, bio, photo, role, up to 3 themes, interest tags, ask and offer text and a visibility scope, edited in onboarding step 2. Existing registrant data is untouched.                                         | P0       | K-30, K-31       |
| FR-21                                | Visibility banner and settings: scope selector (presenters, all delegates, people I've met), share-on-tap, second-degree and discoverable toggles, versioned append-only log, one-tap withdraw.                                 | P0       | K-32             |
| FR-22                                | Scope, accept and block rules are enforced in the server function, never in the client (matrix in section 6.3). Contact details are returned only to a person the owner has accepted.                                           | P0       | K-33             |
| FR-23                                | One profile screen following the wireframe, extended with mutual connections, path to me, shared sessions and a private note. Used by tap, directory, session-mates and map.                                                    | P0       | K-34             |
| FR-24                                | Completion banner on Home and an email to all registered delegates.                                                                                                                                                             | P1       | K-35             |
| FR-25                                | Theme list of 8 to 12 entries seeded from the paper tracks and the wireframe theme chips, with a colour each.                                                                                                                   | P0       | K-06             |
| FR-26                                | Ask and offer text appears as a badge on the profile and in the node tooltip.                                                                                                                                                   | P2       | K-79             |
| **Constellation and Venn**           |                                                                                                                                                                                                                                 |          |                  |
| FR-30                                | The existing Network page gains a map preview and entry points; the graph code is a lazy chunk of 100 kB gzipped or less. Wireframed sections keep their order.                                                                 | P0       | K-47             |
| FR-31                                | Force-directed map of you, your connections and consenting second-degree people, capped at 300 nodes, on canvas at 30 fps or more for 150 nodes.                                                                                | P0       | K-40, K-41, K-42 |
| FR-32                                | Tapping a node shows a peek card and opens the profile screen, highlights neighbours and the path to you. Fully keyboard operable.                                                                                              | P0       | K-43             |
| FR-33                                | Theme layer: anchors, translucent hulls, multi-theme people placed in the overlap.                                                                                                                                              | P0       | K-51             |
| FR-34                                | Filters by theme, institute, role and session; search with fly-to. Reuses the wireframed theme chips.                                                                                                                           | P1       | K-44             |
| FR-35                                | List view equivalent of the map; static layout under reduced motion.                                                                                                                                                            | P1       | K-45             |
| FR-36                                | Designed empty states for zero, one and two connections.                                                                                                                                                                        | P1       | K-46             |
| FR-37                                | Overlap mode for up to 3 themes with 7 region counts and lists, scope My network or Event.                                                                                                                                      | P1       | K-52, K-53       |
| FR-38                                | Similarity score per section 7.3 and the top 8 edges per person.                                                                                                                                                                | P1       | K-50             |
| FR-39                                | Suggested connections among discoverable people.                                                                                                                                                                                | P2       | K-55             |
| FR-40                                | Event Galaxy of all discoverable delegates.                                                                                                                                                                                     | P2       | K-54             |
| **Platform, quality and operations** |                                                                                                                                                                                                                                 |          |                  |
| FR-50                                | Admin metrics tile: taps, unique connections, activations, completion, map opens, errors.                                                                                                                                       | P1       | K-61             |
| FR-51                                | RLS and secrets audit on every new table with the public key; no service key in the bundle.                                                                                                                                     | P0       | K-63             |
| FR-52                                | Export, and deletion of all network data on Tue 29 Dec 2026; retrospective and deletion verification.                                                                                                                           | P1       | K-64, K-76       |
| FR-53                                | Device matrix of at least 8 devices and a load test at 500 taps per minute.                                                                                                                                                     | P0       | K-70, K-71       |
| FR-54                                | A 30-second how-to-tap clip, Home banner and message text for volunteers and delegates.                                                                                                                                         | P1       | K-74             |
| FR-55                                | Feature freeze on Wed 25 Nov, UAT and go/no-go on Thu 26 Nov, hypercare rota 27 to 29 Nov with a rollback drill.                                                                                                                | P0       | K-72, K-73, K-75 |
| FR-56                                | Stack, chip tier, headcount and privacy defaults confirmed in writing by Sun 15 Nov.                                                                                                                                            | P0       | K-03, K-04, K-05 |
| FR-57                                | After the conference: export my contacts (accepted connections only) and a follow-up reminder, as wireframed.                                                                                                                   | P1       | K-83             |

## 9.2 Schedule by date

13 build days from Sat 14 Nov to Thu 26 Nov, then the event. Each date lists the tickets due, and gates are in bold in the milestone column.

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 24%" />
<col style="width: 64%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Date</strong></th>
<th><strong>Milestone</strong></th>
<th><strong>Tickets due</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Fri 13 Nov</strong></td>
<td>Recon, PRD v0.1 and v0.2</td>
<td><p>K-01 (P0) Recon of Pan-IIM app, PlanOS site and Cinemetrica reference</p>
<p>K-02 (P0) Draft PRD v0.1</p></td>
</tr>
<tr class="even">
<td><strong>Sat 14 Nov</strong></td>
<td>Stack and chip tier decided</td>
<td><p>K-03 (P0) Confirm stack, repo access, staging and deploy path with the PlanOS team</p>
<p>K-04 (P0) Decide chip tier (A: NTAG21x static, B: NTAG 424 DNA) from vendor quotes and lead times</p></td>
</tr>
<tr class="odd">
<td><strong>Sun 15 Nov</strong></td>
<td><strong>G0: card order placed</strong></td>
<td><p>K-05 (P0) Organizer sign-off on headcount, privacy defaults, retention and fiduciary wording</p>
<p>K-10 (P0) Card artwork: logo, QR, printed 6-char code, tap-here mark; vendor spec sheet</p>
<p>K-12 (P0) Token generator, card manifest CSV and pre-bound pass list (80-bit tokens, printed codes, name on card)</p>
<p>K-11 (P0) Place card order with 10% spares (quantity = ceil(1.1 x N))</p></td>
</tr>
<tr class="even">
<td><strong>Mon 16 Nov</strong></td>
<td>Test tags in engineers' hands</td>
<td><p>K-06 (P0) Seed theme taxonomy (domains) from the paper tracks and wireframe themes</p>
<p>K-13 (P0) Dev test tags: write 20 blank NTAG tags with test URLs for engineers</p></td>
</tr>
<tr class="odd">
<td><strong>Tue 17 Nov</strong></td>
<td>Schema and RLS on staging</td>
<td><p>K-20 (P0) Migration and RLS: nfc_cards, connections (with source and context), blocks, tap_events, consents</p>
<p>K-30 (P0) Profile schema: headline, bio, photo, role, institute, themes (max 3), interest tags, ask and offer, visibility scope</p></td>
</tr>
<tr class="even">
<td><strong>Wed 18 Nov</strong></td>
<td>Tap routes, editor and visibility on staging</td>
<td><p>K-21 (P0) Route /t/:token: states (unbound, active, revoked, unknown) and sign-in with return path</p>
<p>K-22 (P0) RPCs get_profile_by_token and connect_via_card (idempotent, undo, rate limited)</p>
<p>K-29 (P0) iOS spike: Safari tab vs installed PWA sign-in state, and one-tap return path</p>
<p>K-28 (P1) Connection rules: unique pair, self-tap block, source and session tagging, record_meeting() for non-tap sources</p>
<p>K-31 (P0) Profile editor in onboarding step 2: domain picker, interests, photo upload, contact fields</p>
<p>K-32 (P0) Visibility banner and settings: scope selector, share-on-tap, discoverable, versioned log, one-tap withdraw</p>
<p>K-40 (P0) Graph spike: d3-force on canvas with 150 synthetic nodes, measure fps</p></td>
</tr>
<tr class="odd">
<td><strong>Thu 19 Nov</strong></td>
<td><strong>G1: tap works end to end on dev tags</strong></td>
<td><p>K-23 (P0) Tap result screen: compact profile card, connect with 8 s undo, already-connected state, contact on accept</p>
<p>K-24 (P0) Card activation: self-activate after sign-in; desk bind and unbind</p>
<p>K-25 (P0) QR on digital pass and share-link fallback (same /t/:token URL)</p>
<p>K-33 (P0) Profile detail RPC applying scope, accept and block rules</p>
<p>K-41 (P0) RPC get_ego_graph (depth 2, cap 300 nodes, scope and block rules honoured)</p>
<p>K-62 (P0) Rate limits, abuse guard and feature kill-switch on resolve and connect RPCs</p></td>
</tr>
<tr class="even">
<td><strong>Fri 20 Nov</strong></td>
<td>Sprint 1 closes; samples shipped</td>
<td><p>K-14 (P1) Vendor pre-production sample: 5 encoded cards air-shipped</p>
<p>K-26 (P1) People I've met: list in Me with search, private note, remove connection</p>
<p>K-27 (P1) Lost or stolen card: revoke and reissue</p>
<p>K-47 (P0) Network page: add map entry points to wireframed home, lazy-loaded graph chunk</p></td>
</tr>
<tr class="odd">
<td><strong>Sat 21 Nov</strong></td>
<td>Desk console, block and report</td>
<td><p>K-60 (P0) Admin card console: batches, search delegate, bind, unbind, revoke, CSV export</p>
<p>K-81 (P0) Block and report: RPCs, profile menu, admin review queue</p></td>
</tr>
<tr class="even">
<td><strong>Sun 22 Nov</strong></td>
<td>Constellation v1 on staging</td>
<td><p>K-35 (P1) Profile-completion nudge on Home and email to registered delegates</p>
<p>K-42 (P0) Constellation v1: canvas render, zoom, pan, drag, domain colours, size by degree, edge width by similarity</p>
<p>K-50 (P1) Similarity job: weighted score, top 8 edges per person, nightly plus on profile save</p>
<p>K-77 (P1) Scan sheet: in-app QR scan and 6-char code entry for phones without background NFC</p></td>
</tr>
<tr class="odd">
<td><strong>Mon 23 Nov</strong></td>
<td>Profile screen, filters, list view</td>
<td><p>K-34 (P0) Profile screen per wireframe plus constellation extras (mutual, path to me, shared sessions, note, report)</p>
<p>K-44 (P1) Filters: domain chips, institute, role, met-at-session, search with fly-to</p>
<p>K-45 (P1) Accessible list view, reduced-motion static layout, text alternative</p>
<p>K-46 (P1) Empty and low-connection states</p>
<p>K-53 (P1) RPC venn_counts(theme_ids up to 3, scope) honouring visibility scope</p></td>
</tr>
<tr class="even">
<td><strong>Tue 24 Nov</strong></td>
<td>Node interactions, Overlap, audit, load test</td>
<td><p>K-43 (P0) Node tap opens profile panel; neighbour highlight; path-to-me; keyboard navigation</p>
<p>K-51 (P0) Domain Venn layer: anchors, translucent hulls, multi-domain nodes pulled between anchors</p>
<p>K-63 (P0) RLS and secrets audit: anon-key probe on every new table, no service key in client bundle</p>
<p>K-61 (P1) Event metrics: taps, unique connections, completion rate, graph opens, errors</p>
<p>K-64 (P1) Data export and post-event deletion job (scheduled for 29 Dec 2026)</p>
<p>K-71 (P1) Load test: 500 taps per minute on resolve and connect; 2,000-node graph render</p>
<p>K-74 (P1) Delegate and volunteer onboarding: 30-second how-to-tap clip, Home banner, WhatsApp text</p></td>
</tr>
<tr class="odd">
<td><strong>Wed 25 Nov</strong></td>
<td><strong>G2: freeze, cards on campus</strong></td>
<td><p>K-17 (P0) Vendor production and transit to Shillong (external wait, 10 days assumed)</p>
<p>K-52 (P1) Venn mode: pick up to 3 domains, 7-region counts, tap a region for people list</p>
<p>K-55 (P2) Suggested connections: top 10 by score among discoverable, unconnected people</p>
<p>K-54 (P2) Event Galaxy: all discoverable delegates as a star field with kNN links</p>
<p>K-72 (P0) Feature freeze and release candidate on production</p>
<p>K-79 (P2) Ask and offer badges on profile and node tooltip</p>
<p>K-83 (P1) After the conference: export contacts and follow-up reminder</p></td>
</tr>
<tr class="even">
<td><strong>Thu 26 Nov</strong></td>
<td><strong>G3: UAT and go / no-go, goods-in</strong></td>
<td><p>K-15 (P0) Goods-in check: count, read-test 10% sample, quarantine failures</p>
<p>K-16 (P1) Desk kit: signage, volunteer script, spare cards, NFC-capable test phones</p>
<p>K-70 (P0) Device matrix: iPhone XS or later, iPhone 11 to 15, Pixel, Samsung, Xiaomi, NFC off, Safari vs PWA</p>
<p>K-75 (P0) Hypercare rota for 27 to 29 Nov, incident runbook, rollback drill</p>
<p>K-73 (P0) On-campus UAT with 20 volunteers using dev tags and sample cards; go or no-go</p></td>
</tr>
<tr class="odd">
<td><strong>Fri 27 Nov</strong></td>
<td>Event day 1: Hypercare; hotfixes only</td>
<td>No tickets</td>
</tr>
<tr class="even">
<td><strong>Sat 28 Nov</strong></td>
<td>Event day 2: Hypercare; adoption check</td>
<td>No tickets</td>
</tr>
<tr class="odd">
<td><strong>Sun 29 Nov</strong></td>
<td>Event day 3: Hypercare; event ends</td>
<td>No tickets</td>
</tr>
<tr class="even">
<td><strong>Wed 2 Dec</strong></td>
<td></td>
<td>K-76 (P2) Retrospective, deletion verification, metrics report</td>
</tr>
<tr class="odd">
<td><strong>Tue 29 Dec</strong></td>
<td>Retention: Deletion job runs (29 Nov + 30 days)</td>
<td>No tickets</td>
</tr>
</tbody>
</table>

## 9.3 Critical path

Two chains have zero float. If either slips by a day, the go/no-go on Thu 26 Nov slips with it.

- **Card chain:** K-03 stack and K-04 chip tier, then K-06, K-10 quotes, K-12 manifest, K-11 order (due end of Sun 15 Nov), a 10-day vendor lead time (K-17), goods-in K-15, UAT K-73. Only K-15 depends on the bulk shipment; the device matrix and UAT use dev tags and sample cards.

- **Software chain:** K-30 profile schema, K-32 visibility, K-33 profile detail RPC, K-34 profile screen, K-43 node interactions, K-70 device matrix, K-73 UAT. v0.1 had one day of float here; the wireframed profile and the scope selector used it up.

## 9.4 Capacity and cut order

Capacity is 13 days at 70% focus, which is 9.1 ideal-days per person.

| **Role**  | **P0** | **P1** | **P2** | **Total** | **People P0** | **People P0+P1** | **People all** |
|-----------|--------|--------|--------|-----------|---------------|------------------|----------------|
| Front end | 23.0   | 7.5    | 4.5    | 35.0      | 2.53          | 3.35             | 3.85           |
| Back end  | 12.5   | 7.0    | 0.0    | 19.5      | 1.37          | 2.14             | 2.14           |
| QA        | 4.0    | 1.0    | 0.0    | 5.0       | 0.44          | 0.55             | 0.55           |
| Design    | 1.0    | 1.5    | 0.0    | 2.5       | 0.11          | 0.27             | 0.27           |
| Ops       | 2.5    | 1.5    | 0.0    | 4.0       | 0.27          | 0.44             | 0.44           |
| PM        | 2.5    | 0.5    | 0.5    | 3.5       | 0.27          | 0.33             | 0.38           |
| All roles | 45.5   | 19.0   | 5.0    | 69.5      |               |                  |                |

**Reading the table.** Front end is the constraint. P0 alone needs 2.53 people, so two engineers (18.2 days) cannot do it. Three engineers supply 27.3 days. Back end is easier: P0 needs 1.37 people and all work needs 2.14, so two engineers cover P0 and nearly all P1.

If scope must shrink, cut in this order. Each step is chosen to leave the personal map and the main tap flow untouched.

| **Step** | **Tickets**      | **What is lost**                                                                                                                                   | **Frees (days)**            | **Total** |
|----------|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|-----------|
| 1        | K-54, K-55, K-79 | Event Galaxy, suggested connections and ask/offer badges. The personal map and Overlap are unaffected.                                             | Front end 4.5               | 4.5       |
| 2        | K-83, K-44, K-46 | Export and reminder, filters and search on the map, designed empty states. Plain empty text and the full map remain.                               | Front end 2.5, Design 0.5   | 3.0       |
| 3        | K-26, K-50       | The My connections list (Remove stays on the profile screen) and the similarity job (edges become one uniform width).                              | Front end 1.0, Back end 2.0 | 3.0       |
| 4        | K-52, K-53       | Overlap mode with exact region counts. Last resort, because Overlap was named in the original brief; the theme hulls still show overlaps visually. | Front end 2.0, Back end 1.0 | 3.0       |

Front-end days remaining after each step: step 1: 30.5; step 2: 28.0; step 3: 27.0; step 4: 25.0. With three engineers (27.3 days), steps 1 to 3 are needed and leave a margin of 0.3 days. That is a plan that fits on paper only. **A fourth front-end engineer, or dropping the wireframed profile extras, is the realistic safety margin.**

The cut order puts Overlap last because it was named in the original brief. If you would rather give up Overlap before the filters or the connections list, reorder steps 2 to 4 and I will re-run the numbers.

# 10 Risks and open decisions

## 10.1 Risks

| **ID** | **Risk**                                                                                                                    | **Likelihood** | **Impact** | **Mitigation**                                                                                                                                             | **Owner and trigger**                                                    |
|--------|-----------------------------------------------------------------------------------------------------------------------------|----------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| R1     | Card lead time slips, or the order goes in after Sun 15 Nov, so cards miss the event                                        | Medium         | High       | Get the ship date in writing before ordering. Fallback: QR printed on badges or stickers from the same manifest. Air-ship the 5 samples.                   | **Ops.** Trigger: No written ship date by Sun 15 Nov 12:00               |
| R2     | The stack is not Supabase-like, so the data layer needs rework                                                              | Medium         | High       | K-03 on day one. All server work is specified as named functions, so only the layer behind them changes.                                                   | **PM.** Trigger: K-03 not answered by Sat 14 Nov evening                 |
| R3     | RLS misconfigured and profiles or contacts leak                                                                             | Medium         | High       | RLS on, no write policies, writes only via functions, anon-key probe on every table (K-63), service key never in the bundle.                               | **QA, Back end.** Trigger: Any table returning a row to the anon key     |
| R4     | Tap opens Safari while the delegate uses the installed app, so they are signed out                                          | High           | Medium     | K-29 spike, email-code and Google sign-in from the tap path, return to the same URL, a hint to add the app to the home screen.                             | **Front end.** Trigger: Sign-in from tap takes more than 2 taps          |
| R5     | Few profiles are completed, so the map looks empty                                                                          | High           | High       | Pre-fill primary theme from paper tracks, completion banner and email (K-35), prompt at the desk during activation, designed low-connection states (K-46). | **PM.** Trigger: Completion under 50% at end of day 1                    |
| R6     | A consent complaint or misunderstanding about what is shared                                                                | Medium         | High       | Scope defaults to presenters, contact hidden until accept, one-tap withdrawal, counsel review of the text (Q3).                                            | **PM.** Trigger: Any complaint                                           |
| R7     | Map is slow on low-end phones                                                                                               | Medium         | Medium     | Canvas, 300-node cap, pre-settled layout, list-view fallback, spike in K-40, test in K-71.                                                                 | **Front end.** Trigger: Under 24 fps in the spike on a mid-range Android |
| R8     | Venue connectivity is poor, so taps fail                                                                                    | Medium         | High       | Small payloads, skeletons, local retry queue for connect, last profile cached. Check campus Wi-Fi and cellular during UAT on site.                         | **PM, Ops.** Trigger: p95 above 4 s in UAT                               |
| R9     | Not enough engineers: P0 front end needs 2.5 people at 70% focus, and P0 plus P1 needs 3.4                                  | High           | High       | Three front-end engineers plus the cut order in section 9.4, or a fourth engineer. Two front-end engineers cannot deliver P0 in 13 days.                   | **PM.** Trigger: Fewer than 3 front-end people on Mon 16 Nov             |
| R10    | Someone claims an unbound card they do not hold                                                                             | Low            | Medium     | Activation needs the printed 6-char code and a signed-in account; desk can unbind and rebind; audit log.                                                   | **Back end.** Trigger: Duplicate activation attempts in the log          |
| R11    | A photographed or cloned card is used to send unwanted connections                                                          | Medium         | Low        | Rate limits, one-tap removal, owner sees who connected, block and report (K-81), Tier B as an upgrade if the vendor can deliver.                           | **Back end.** Trigger: Complaints or repeated connects from one viewer   |
| R12    | Scope grows after the freeze                                                                                                | Medium         | Medium     | Freeze on Wed 25 Nov, only P0 fixes merge, every change logged in the version history.                                                                     | **PM.** Trigger: Any change request after G2                             |
| R13    | The wireframed host modules (coffee requests, asks board, tables, office hours) are not yet built and are pulled into scope | Medium         | High       | Treat them as a separate workstream with its own staffing (section 4.2). The network extension only needs their data hooks (record_meeting).               | **PM.** Trigger: Organizers ask for them inside the 14-day plan          |
| R14    | Accept-based contact reveal makes a tap feel like it did nothing                                                            | Medium         | Medium     | Tap shows the full wireframed profile, the connection is recorded, and the coffee request is one tap away. Share-on-tap is available as an opt-in (D-3).   | **PM.** Trigger: UAT volunteers ask where the phone number is            |

## 10.2 Decisions needed

I have made a default for each so the plan is not blocked, but each one changes tickets.

| **ID** | **Decision**                                                                                 | **My default**                                              | **What it changes**                                  |
|--------|----------------------------------------------------------------------------------------------|-------------------------------------------------------------|------------------------------------------------------|
| D-1    | Chip tier: A (NTAG21x) or B (NTAG 424 DNA).                                                  | A, unless the vendor gives B in writing by Sat 14 Nov.      | K-04, K-12, K-13. B adds a signature check function. |
| D-2    | Pre-bound passes with a name, or unbound cards activated by the delegate.                    | Unbound, plus desk bulk-binding.                            | K-12, K-24, K-60, and the print file.                |
| D-3    | Does a tap reveal contact details, or only after accept?                                     | After accept. Share-on-tap is opt-in, default off.          | K-23, K-33. Wireframe supports this default.         |
| D-4    | Headcount N including volunteers and speakers.                                               | Unknown. Plan at 1,000 until told.                          | Card quantity and cost (K-11).                       |
| D-5    | Which sources create an edge: tap, scan, coffee only, or also tables, circles, office hours? | Tap, scan, accepted coffee only.                            | K-28, graph density, K-41.                           |
| D-6    | Default visibility scope, and whether non-presenters appear at all.                          | Presenters; non-presenters visible only to people they met. | K-30, K-32, K-33.                                    |
| D-7    | Are the wireframed host modules built, and who builds them if not?                           | Assume not in this plan.                                    | Capacity, section 4.2.                               |
| D-8    | Team: how many front-end and back-end engineers, from which day?                             | 3 FE and 2 BE from Mon 16 Nov.                              | Section 9.4. Two FE cannot deliver P0.               |

## 10.3 Open questions

- Q-3. Who is the data fiduciary, and is PlanOS a processor? (counsel)

- Q-8. Does the existing app already retain photos for another purpose after the event?

- Q-9. What is the QR icon on Network home: my pass, or a scanner?

- Q-10. What exactly does the second button in "After the conference" say (label is clipped in the PDF)?

- Q-11. Do session-mates and "In your session" come from the programme data the app already holds?

# 11 Sources

Wireframe PDF supplied by the user: "Pan-IIM WMC 2026, Network page sample UIs". The live app and reference pages were read in v0.1.

- Pan-IIM app: https://paniim.planos.in/

- PlanOS: https://planos.in/

- Cinemetrica reference: https://cinemetrica.net/

- Apple: background tag reading: https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading

- MDN: NDEFReader (Web NFC): https://developer.mozilla.org/docs/Web/API/NDEFReader

- Web NFC feature support: https://web-platform-dx.github.io/web-features-explorer/features/web-nfc

- NXP NTAG213/215/216 data sheet: https://nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf

- NTAG 424 DNA summary: https://wiot-group.com/think/en/products/nxp-semiconductors-ntag-424-dna-ntag-424-dna-tagtamper/

- d3-force simulations: https://d3js.org/d3-force/simulation

- Lovable architecture overview: https://www.techaheadcorp.com/blog/inside-lovable-backend-design-system-architecture-ai-agent-orchestration-explained/

- Lovable security notes: https://www.unpwned.io/platforms/lovable

- AZB: DPDP framework in effect: https://www.azbpartners.com/bank/update-indias-digital-personal-data-protection-framework-comes-into-effect/

- Shardul Amarchand Mangaldas: DPDP Rules: https://www.amsshardul.com/?p=17621

- Mondaq: DPDP implications: https://www.mondaq.com/india/privacy-protection/1722126/behind-the-buzzwords-real-world-implications-of-indias-dpdp-law

# Appendix A Ticket list

60 tickets, 69.5 ideal-days. P0 45.5, P1 19.0, P2 5.0. Dependencies are by ticket ID. Zero-float tickets are marked with an asterisk. The interactive board and kanban.csv carry the acceptance criteria.

| **ID**                           | **Title**                                                                                                             | **Pri.** | **Role** | **Days** | **Due**    | **Depends on**                           |
|----------------------------------|-----------------------------------------------------------------------------------------------------------------------|----------|----------|----------|------------|------------------------------------------|
| **E0 Foundations and decisions** |                                                                                                                       |          |          |          |            |                                          |
| K-01                             | Recon of Pan-IIM app, PlanOS site and Cinemetrica reference                                                           | P0       | PM       | 0.5      | Fri 13 Nov | \-                                       |
| K-02                             | Draft PRD v0.1                                                                                                        | P0       | PM       | 0.5      | Fri 13 Nov | K-01                                     |
| K-03 \*                          | Confirm stack, repo access, staging and deploy path with the PlanOS team                                              | P0       | PM       | 0.5      | Sat 14 Nov | K-02                                     |
| K-04 \*                          | Decide chip tier (A: NTAG21x static, B: NTAG 424 DNA) from vendor quotes and lead times                               | P0       | OPS      | 0.5      | Sat 14 Nov | K-02                                     |
| K-05                             | Organizer sign-off on headcount, privacy defaults, retention and fiduciary wording                                    | P0       | PM       | 0.5      | Sun 15 Nov | K-02                                     |
| K-06 \*                          | Seed theme taxonomy (domains) from the paper tracks and wireframe themes                                              | P0       | BE       | 0.5      | Mon 16 Nov | K-03                                     |
| **E1 NFC cards and ops**         |                                                                                                                       |          |          |          |            |                                          |
| K-10 \*                          | Card artwork: logo, QR, printed 6-char code, tap-here mark; vendor spec sheet                                         | P0       | DS       | 1.0      | Sun 15 Nov | K-04                                     |
| K-11 \*                          | Place card order with 10% spares (quantity = ceil(1.1 x N))                                                           | P0       | OPS      | 0.5      | Sun 15 Nov | K-10, K-12                               |
| K-12 \*                          | Token generator, card manifest CSV and pre-bound pass list (80-bit tokens, printed codes, name on card)               | P0       | BE       | 1.0      | Sun 15 Nov | K-04                                     |
| K-13                             | Dev test tags: write 20 blank NTAG tags with test URLs for engineers                                                  | P0       | OPS      | 0.5      | Mon 16 Nov | K-04                                     |
| K-14                             | Vendor pre-production sample: 5 encoded cards air-shipped                                                             | P1       | OPS      | 0.5      | Fri 20 Nov | K-11                                     |
| K-15 \*                          | Goods-in check: count, read-test 10% sample, quarantine failures                                                      | P0       | OPS      | 1.0      | Thu 26 Nov | K-17                                     |
| K-16                             | Desk kit: signage, volunteer script, spare cards, NFC-capable test phones                                             | P1       | OPS      | 1.0      | Thu 26 Nov | K-04                                     |
| K-17 \*                          | Vendor production and transit to Shillong (external wait, 10 days assumed)                                            | P0       | OPS      | 0.0      | Wed 25 Nov | K-11                                     |
| **E2 Tap flow and connections**  |                                                                                                                       |          |          |          |            |                                          |
| K-20                             | Migration and RLS: nfc_cards, connections (with source and context), blocks, tap_events, consents                     | P0       | BE       | 2.0      | Tue 17 Nov | K-03                                     |
| K-21                             | Route /t/:token: states (unbound, active, revoked, unknown) and sign-in with return path                              | P0       | FE       | 1.5      | Wed 18 Nov | K-20                                     |
| K-22                             | RPCs get_profile_by_token and connect_via_card (idempotent, undo, rate limited)                                       | P0       | BE       | 1.5      | Wed 18 Nov | K-20                                     |
| K-23                             | Tap result screen: compact profile card, connect with 8 s undo, already-connected state, contact on accept            | P0       | FE       | 1.5      | Thu 19 Nov | K-21, K-22                               |
| K-24                             | Card activation: self-activate after sign-in; desk bind and unbind                                                    | P0       | FE       | 1.5      | Thu 19 Nov | K-20, K-21, K-32                         |
| K-25                             | QR on digital pass and share-link fallback (same /t/:token URL)                                                       | P0       | FE       | 0.5      | Thu 19 Nov | K-21                                     |
| K-26                             | People I've met: list in Me with search, private note, remove connection                                              | P1       | FE       | 1.0      | Fri 20 Nov | K-22                                     |
| K-27                             | Lost or stolen card: revoke and reissue                                                                               | P1       | BE       | 1.0      | Fri 20 Nov | K-24                                     |
| K-28                             | Connection rules: unique pair, self-tap block, source and session tagging, record_meeting() for non-tap sources       | P1       | BE       | 1.0      | Wed 18 Nov | K-20                                     |
| K-29                             | iOS spike: Safari tab vs installed PWA sign-in state, and one-tap return path                                         | P0       | FE       | 1.0      | Wed 18 Nov | K-21                                     |
| K-77                             | Scan sheet: in-app QR scan and 6-char code entry for phones without background NFC                                    | P1       | FE       | 1.0      | Sun 22 Nov | K-22                                     |
| **E3 Profile and consent**       |                                                                                                                       |          |          |          |            |                                          |
| K-30 \*                          | Profile schema: headline, bio, photo, role, institute, themes (max 3), interest tags, ask and offer, visibility scope | P0       | BE       | 1.5      | Tue 17 Nov | K-06                                     |
| K-31                             | Profile editor in onboarding step 2: domain picker, interests, photo upload, contact fields                           | P0       | FE       | 2.0      | Wed 18 Nov | K-30                                     |
| K-32 \*                          | Visibility banner and settings: scope selector, share-on-tap, discoverable, versioned log, one-tap withdraw           | P0       | FE       | 2.0      | Wed 18 Nov | K-30, K-05                               |
| K-33 \*                          | Profile detail RPC applying scope, accept and block rules                                                             | P0       | BE       | 1.5      | Thu 19 Nov | K-30, K-32, K-20, K-05                   |
| K-34 \*                          | Profile screen per wireframe plus constellation extras (mutual, path to me, shared sessions, note, report)            | P0       | FE       | 3.0      | Mon 23 Nov | K-33                                     |
| K-35                             | Profile-completion nudge on Home and email to registered delegates                                                    | P1       | PM       | 0.5      | Sun 22 Nov | K-31                                     |
| K-79                             | Ask and offer badges on profile and node tooltip                                                                      | P2       | FE       | 0.5      | Wed 25 Nov | K-30, K-34                               |
| **E4 Constellation graph**       |                                                                                                                       |          |          |          |            |                                          |
| K-40                             | Graph spike: d3-force on canvas with 150 synthetic nodes, measure fps                                                 | P0       | FE       | 1.0      | Wed 18 Nov | \-                                       |
| K-41                             | RPC get_ego_graph (depth 2, cap 300 nodes, scope and block rules honoured)                                            | P0       | BE       | 1.5      | Thu 19 Nov | K-20, K-30, K-05                         |
| K-42                             | Constellation v1: canvas render, zoom, pan, drag, domain colours, size by degree, edge width by similarity            | P0       | FE       | 3.0      | Sun 22 Nov | K-40, K-41                               |
| K-43 \*                          | Node tap opens profile panel; neighbour highlight; path-to-me; keyboard navigation                                    | P0       | FE       | 1.0      | Tue 24 Nov | K-34, K-42                               |
| K-44                             | Filters: domain chips, institute, role, met-at-session, search with fly-to                                            | P1       | FE       | 1.5      | Mon 23 Nov | K-42                                     |
| K-45                             | Accessible list view, reduced-motion static layout, text alternative                                                  | P1       | FE       | 1.0      | Mon 23 Nov | K-42                                     |
| K-46                             | Empty and low-connection states                                                                                       | P1       | DS       | 0.5      | Mon 23 Nov | K-42                                     |
| K-47                             | Network page: add map entry points to wireframed home, lazy-loaded graph chunk                                        | P0       | FE       | 1.0      | Fri 20 Nov | K-03                                     |
| **E5 Overlap and discovery**     |                                                                                                                       |          |          |          |            |                                          |
| K-50                             | Similarity job: weighted score, top 8 edges per person, nightly plus on profile save                                  | P1       | BE       | 2.0      | Sun 22 Nov | K-30                                     |
| K-51                             | Domain Venn layer: anchors, translucent hulls, multi-domain nodes pulled between anchors                              | P0       | FE       | 2.0      | Tue 24 Nov | K-42                                     |
| K-52                             | Venn mode: pick up to 3 domains, 7-region counts, tap a region for people list                                        | P1       | FE       | 2.0      | Wed 25 Nov | K-51, K-53                               |
| K-53                             | RPC venn_counts(theme_ids up to 3, scope) honouring visibility scope                                                  | P1       | BE       | 1.0      | Mon 23 Nov | K-30, K-20, K-05                         |
| K-54                             | Event Galaxy: all discoverable delegates as a star field with kNN links                                               | P2       | FE       | 3.0      | Wed 25 Nov | K-50, K-42                               |
| K-55                             | Suggested connections: top 10 by score among discoverable, unconnected people                                         | P2       | FE       | 1.0      | Wed 25 Nov | K-50                                     |
| **E6 Admin, security and data**  |                                                                                                                       |          |          |          |            |                                          |
| K-60                             | Admin card console: batches, search delegate, bind, unbind, revoke, CSV export                                        | P0       | FE       | 2.0      | Sat 21 Nov | K-24                                     |
| K-61                             | Event metrics: taps, unique connections, completion rate, graph opens, errors                                         | P1       | BE       | 1.0      | Tue 24 Nov | K-22                                     |
| K-62                             | Rate limits, abuse guard and feature kill-switch on resolve and connect RPCs                                          | P0       | BE       | 1.0      | Thu 19 Nov | K-22                                     |
| K-63                             | RLS and secrets audit: anon-key probe on every new table, no service key in client bundle                             | P0       | QA       | 1.0      | Tue 24 Nov | K-41, K-33, K-60, K-81                   |
| K-64                             | Data export and post-event deletion job (scheduled for 29 Dec 2026)                                                   | P1       | BE       | 1.0      | Tue 24 Nov | K-20                                     |
| K-81                             | Block and report: RPCs, profile menu, admin review queue                                                              | P0       | BE       | 1.0      | Sat 21 Nov | K-20                                     |
| **E7 QA, rollout and hypercare** |                                                                                                                       |          |          |          |            |                                          |
| K-70 \*                          | Device matrix: iPhone XS or later, iPhone 11 to 15, Pixel, Samsung, Xiaomi, NFC off, Safari vs PWA                    | P0       | QA       | 2.0      | Thu 26 Nov | K-23, K-43, K-14                         |
| K-71                             | Load test: 500 taps per minute on resolve and connect; 2,000-node graph render                                        | P1       | QA       | 1.0      | Tue 24 Nov | K-22, K-41                               |
| K-72                             | Feature freeze and release candidate on production                                                                    | P0       | PM       | 0.5      | Wed 25 Nov | K-23, K-24, K-43, K-51, K-60, K-63, K-81 |
| K-73 \*                          | On-campus UAT with 20 volunteers using dev tags and sample cards; go or no-go                                         | P0       | QA       | 1.0      | Thu 26 Nov | K-72, K-70                               |
| K-74                             | Delegate and volunteer onboarding: 30-second how-to-tap clip, Home banner, WhatsApp text                              | P1       | DS       | 1.0      | Tue 24 Nov | K-23                                     |
| K-75                             | Hypercare rota for 27 to 29 Nov, incident runbook, rollback drill                                                     | P0       | BE       | 1.0      | Thu 26 Nov | K-72, K-62                               |
| K-76                             | Retrospective, deletion verification, metrics report                                                                  | P2       | PM       | 0.5      | Wed 2 Dec  | K-73                                     |
| K-83                             | After the conference: export contacts and follow-up reminder                                                          | P1       | FE       | 1.0      | Wed 25 Nov | K-33                                     |

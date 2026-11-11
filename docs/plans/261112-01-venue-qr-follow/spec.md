# Venue QR Follow: Spec

Nov 11, 2026 · @Tejovanth

Companion tabs: Copy holds every user-facing string verbatim; Build notes holds conventions, constants, schemas and acceptance criteria for the build agents.

## Summary

Venue QR Follow replaces the paper notice register at sabha halls with a QR code that turns a concert attendee into a follower of the venue, the organiser and the artists, in three taps. v1 is free for venues and organisers. It exists to grow verified Bangalore rasika users and to give sabhas a notice list that fills itself.

**Goals**

- Scan to follow in 3 taps or fewer for a signed-in user
- Pre-print QR stock in batches, then assign each code on site by scanning it
- Support multiple QRs per venue (entrances, halls, ticket desk)
- Followers get a weekly digest and day-before reminders by email and web push
- Sabhas get a dashboard on its own subdomain (sabha.rasika.life) with follower counts, scan stats and a consented follower export

**Non-goals for v1**

- WhatsApp delivery
- Phone OTP or accountless subscribers
- QR assignment by sabhas themselves (moderators assign; sabhas see their codes)
- Importing paper registers
- Hall-level event matching inside a venue

**Decisions locked**

| Decision | Choice |
| --- | --- |
| Event matching | Automatic, by time, at the QR's venue |
| Identity | Google sign-in only (existing `User`) |
| Channels | Email (SES) and web push |
| Triggers | Weekly digest, day-before reminder |
| QR admin | Moderators and admins only |
| Print output | Print-ready PDF sheets |
| Follower data | Public counts, plus export of followers who opted in to share |

## User journeys

**Rasika at a concert**

1. Sees a table tent or sticker at the hall entrance, scans with the phone camera
2. Lands on `rasika.life/q/{code}`, which shows tonight's concert: title, artists, organiser, venue
3. Toggles what to follow: the venue, the organiser, each artist individually ("Follow all" shortcut)
4. Optionally ticks "Share my name, email and WhatsApp number (if I add one) with {Organiser} for event notices" (unticked by default)
5. Taps **Follow**. If signed out, goes through Google sign-in and returns with choices intact
6. Sees confirmation plus two optional asks: enable web push, and "Add to my concert book"

**Moderator generates stock**

1. Opens `admin.rasika.life/qr`, creates a batch: count and print format
2. System mints unassigned codes and renders a print-ready PDF
3. Downloads the PDF and prints stickers or table tents

**Moderator registers a QR on site**

1. Sticks a code at the venue, scans it while signed in as moderator
2. Because the code is unassigned, the page shows an **Assign** form instead of the "not active" message
3. Picks the venue (search), adds a placement label such as "Main entrance", saves
4. The code is live immediately; the venue can hold any number of codes

**Sabha secretary checks the dashboard**

1. Gets an invite from a moderator, signs in with Google at `sabha.rasika.life`
2. Sees follower counts for their organiser and linked venues, scans per QR, and upcoming events
3. Downloads a CSV of followers who opted in to share with them

## Data model

Seven new entities and three counter fields. All follow the existing single-table patterns; no new GSIs beyond gsi1 to gsi3.

**New entities**

| Entity | Purpose | pk / sk | GSIs |
| --- | --- | --- | --- |
| `VenueQr` | One printed code | `QR#${code}` / `#METADATA` | gsi1 byVenue: `VENUE_QRS#${venueId}` / `${createdAt}#${code}`; gsi2 byStatus: `QR_STATUS#${status}` / `${batchId}#${code}` |
| `QrBatch` | One print run | `QR_BATCH#${id}` / `#METADATA` | gsi1 list: `QR_BATCH_LIST` / `${createdAt}#${id}` |
| `QrScanDay` | Daily scan and follow rollup per code | `QR#${code}` / `SCAN_DAY#${yyyy-mm-dd}` | none (same item collection as `VenueQr`) |
| `Follow` | User follows a venue, organiser or artist | `USER#${userId}` / `FOLLOW#${targetType}#${targetId}` | gsi1 byTarget: `FOLLOWERS#${targetType}#${targetId}` / `${createdAt}#${userId}` |
| `PartnerMember` | Grants a user access to a sabha dashboard | `PARTNER#${targetType}#${targetId}` / `USER#${userId}` | gsi1 byUser: `USER_PARTNERS#${userId}` / `${targetType}#${targetId}` |
| `PushSubscription` | One browser's web push endpoint | `USER#${userId}` / `PUSH#${endpointHash}` | none |

**`VenueSpace` (halls)**

- One hall or room inside a venue: pk `VENUE#${venueId}`, sk `SPACE#${spaceId}`, so a venue and its spaces load in one query
- Attributes: `name` ("Main hall", "Mini hall"), `capacity?`, `notes?`
- `VenueQr.spaceId?` and `Event.spaceId?` (+ `spaceName?`) are optional; venues with one hall never need a space
- Managed by moderators in admin and by verified owners in the sabha dashboard

**`VenueQr` attributes**

- `code` (8 chars, Crockford base32, no I/L/O/U), `batchId`, `status` (`unassigned` / `active` / `retired`)
- `venueId?`, `venueName?` (denormalized), `label?` ("Main entrance", "Hall 2 door")
- `assignedBy?`, `assignedAt?`, `retiredAt?`, `scanCount`, `followCount`, `lastScannedAt?`, `createdAt`, `updatedAt`

**`Follow` attributes**

- `userId`, `targetType` (`venue` / `organiser` / `artist`), `targetId`, `targetName` (denormalized)
- `source` (`qr` / `web`), `qrCode?`, `eventId?` (concert they were at when they followed)
- `shareWithTarget` (boolean, venue and organiser only), `shareConsentAt?`, `createdAt`

**`PartnerMember` attributes**

- `userId`, `targetType` (`organiser` / `venue`), `targetId`, `targetName`, `role` (`owner` / `viewer`), `invitedBy`, `createdAt`

**`User` additions (v2 to v3)**

- `notifyDigest` (default true), `notifyReminder` (default true), `notifyEmail` (default true), `notifyPush` (default false)
- `unsubscribeToken` (random, rotated on use), `digestLastSentAt?`

Also on `User`: `whatsappNumber?`, `whatsappConsentAt?`, `whatsappVerifiedAt?`, `whatsappPromptDismissedAt?`.

**Counter fields**

- `followerCount` on `Venue`, `Organiser`, `Artist`, maintained with atomic `ADD` in the same transaction as the `Follow` write, the same way `rsvpCount` works

**Cascades (`cascade.ts`)**

- `mergeVenue`: repoint `VenueQr.venueId` and move `Follow` items to the canonical venue, deduping per user and recomputing `followerCount`
- `mergeOrganiser`, `mergeArtist`: move follows the same way; move `PartnerMember` grants on organiser merge
- Name changes: refresh denormalized `targetName` and `venueName` lazily on next read, or in the existing rename cascade

## Scan resolution

Every printed code encodes `https://rasika.life/q/{code}`. The page resolves the code server-side (loader in a `*.server.ts` file) and renders one of five states.

&#91;embedded content: scan resolution · 3 decisions\]

Only an active code reaches the event check; a rasika never dead-ends, because zero events falls back to venue mode.

**Resolution order**

1. Look up `VenueQr` by code. Not found: 404 page with a link to upcoming events.
2. `unassigned`: if the viewer is a moderator, show the Assign form; otherwise show "This code isn't active yet".
3. `retired`: redirect to the venue page if it had one, else the events page.
4. `active`: if the venue is soft-deleted with `mergedIntoId`, follow the merge. Increment `scanCount` and today's `QrScanDay.scans` (fire and forget).
5. Query `byVenue` (gsi4) for events with `startDateTime` from today 00:00 to 23:59 IST, keep `status = approved` and no `deletedAt`.
6. Classify each event as **live** if now is between start minus 90 minutes and end plus 30 minutes. Missing `endDateTime` defaults to start plus 3 hours.

**Outcomes**

| Matches | Page shows |
| --- | --- |
| 1 live event | Follow screen for that event |
| 2+ live events (multiple halls) | Picker: "Which concert are you at?", then follow screen |
| 0 live, 1+ later today | Today's list at this venue; tapping one opens its follow screen |
| 0 today | Venue mode: follow the venue, plus organisers of its next 3 upcoming events |

The timing windows (90 / 30 minutes, 3 hour default) live in one config constant so the pilot can tune them.

**Spaces**: when the code has a `spaceId`, candidate events are those in that space plus events with no space set. The picker appears only if two or more still match.

**Add a concert happening here**: shown on the "later today" list and in venue mode. It opens the poster upload or a short form prefilled with the venue, space and today's date, needs sign-in, and creates a submitted event for moderation (auto-approved when the user is a verified owner of that organiser). The scanner can still follow the venue right away.

**Abuse and caching**

- Rate limit `/q/*` per IP (60 requests per minute) at the edge
- Do not cache the resolution response; event state changes during the day
- Codes carry 40 bits of randomness, and an unassigned code reveals nothing, so guessing has no payoff

## QR generation and print

Codes are minted in batches ahead of time, unassigned, so a moderator can carry a stack of stickers and register them on site.

**Batch creation (`admin.rasika.life/qr/batches/new`)**

- Inputs: `count` (1 to 200), `format`, optional `note` ("Dec season, Narada Gana Sabha")
- Server mints `count` codes with a CSPRNG, checks each for collision with a conditional put, writes `VenueQr` items (`status = unassigned`) and one `QrBatch` via batched writes
- Enqueues PDF rendering; the batch page polls until `pdfStatus = ready`

**Print formats**

| Format | Size | Per A4 sheet | Use |
| --- | --- | --- | --- |
| `sticker` | 100 x 100 mm | 4 | Doors, pillars, ticket desks |
| `table-tent` | A5 faces, printed on A4 and folded | 1 | Register tables, entrance counters |
| `poster` | A4 | 1 | Notice boards |

**Every printed code carries**

- The QR (error correction level M, quiet zone of 4 modules)
- Call to action in English and Kannada, for example "Scan to get notified about concerts here"
- The human-readable code under the QR (for typing it in if the camera fails)
- rasika.life wordmark
- Crop marks on sticker and tent sheets

**Rendering**

- Lambda in `packages/scripts` or a new `packages/qr` using `qrcode` (SVG output) and `pdf-lib`
- Output to the private bucket at `qr-batches/{batchId}.pdf`; download via a 5 minute presigned URL
- Re-render on demand (for example after a design change) without changing codes
- Kannada glyphs need an embedded font (Noto Sans Kannada); test at sticker size before the first print run

## Admin registration flow

Moderators and admins are the only roles that can assign, reassign or retire a code. Two entry points lead to the same form.

All admin screens for this feature live in a new app at `admin.rasika.life` (`packages/admin`, React Router v7, own SST site), gated to moderators and admins. The existing admin routes on rasika.life move there once this feature ships.

**On site (primary)**

1. Moderator scans an unassigned sticker while signed in
2. `/q/{code}` detects `status = unassigned` and `role >= moderator`, and redirects to `admin.rasika.life/qr/{code}/assign`
3. Form: venue search (typeahead over `venue.list`, with "Create venue" link for moderators), placement label, optional note
4. Save sets `status = active`, `venueId`, `venueName`, `label`, `assignedBy`, `assignedAt`
5. Confirmation shows a **Test scan** link that opens the live rasika view

**From a desk**

- `admin.rasika.life/qr` lists codes filterable by status, batch and venue
- Typing a code into "Assign code" opens the same form
- Bulk assign: select several unassigned codes from one batch, assign all to one venue with numbered labels ("Entrance 1", "Entrance 2")

**Venue QR panel (moderator view of `/venues/:venueid`)**

| Column | Source |
| --- | --- |
| Code and label | `VenueQr` via `byVenue` |
| Scans (7 days, total) | `QrScanDay` rollups, `scanCount` |
| Follows from this code | `followCount` |
| Last scanned | `lastScannedAt` |
| Actions | Edit label, Reassign, Retire |

**Rules**

- A venue can hold any number of active codes
- Reassign moves a code to another venue; past `QrScanDay` rows stay with the code, follows keep their original `qrCode` for attribution
- Retire is one-way. A retired code redirects to the old venue page, so a stale sticker never dead-ends
- Every assign, reassign and retire writes a `ChangeHistory` entry (add `venueQr` to its supported `entityType` values)

## Follow flow UI

One mobile screen, no navigation chrome, readable by a 65-year-old in a dim hall.

**Layout, top to bottom**

1. Event card: title (via `isGenericTitle` fallback), start time, venue, organiser
2. **Follow** list with a toggle per row, nothing pre-ticked:
   - Venue (with label of the QR, for example "You're at: Main entrance")
   - Organiser
   - Each artist from `event.artists`, principal performers first, then accompanists, with role shown
3. "Follow all" link above the list
4. Share consent checkbox, shown only when the venue or organiser is toggled on, unticked: "Share my name, email and WhatsApp number (if I add one) with {Organiser} so they can send event notices"
5. Primary button: **Follow** (signed in) or **Continue with Google** (signed out)

**Sign-in carryover**

- Before redirecting to Google, store the selection in a short-lived signed cookie (`qr_intent`, 15 minutes): code, eventId, target list, share flag
- The auth callback reads the cookie, applies `follow.bulkSet`, clears the cookie and lands on the confirmation
- If the cookie is missing or expired, land back on `/q/{code}` with nothing lost but the ticks

**Confirmation**

- "You're following 4 things" with the list
- Web push prompt as a button, never on page load: "Get a reminder the day before their concerts"
- "Add tonight to my concert book" calls `upsertConcertLog`
- Link to `/me/following` to manage

**WhatsApp number (optional)**

- Optional field on the confirmation screen: "Get concert updates on WhatsApp", country code defaulting to +91
- Its own unticked consent checkbox that states the purpose; Google sign-in gives no phone, so this is the only source
- Stored on `User` as `whatsappNumber`, `whatsappConsentAt`, `whatsappVerifiedAt?` (unverified until the first opt-in message is answered)
- Asked once; a dismissal is remembered so it never nags
- Included in a sabha's export only when the user opted in to share with that sabha, with a Verified column that reads No until we verify the number

**Already following**

- Rows the user already follows show as on with a "Following" label; untoggling unfollows
- A returning scanner who follows everything sees the confirmation directly with the concert book prompt

**Writes**

- `follow.bulkSet` runs a DynamoDB transaction per target: put `Follow` (condition: not exists) plus `ADD followerCount 1` on the target, so retries never double count
- Same request increments `VenueQr.followCount` and `QrScanDay.follows` by the number of new follows

## Notifications

Two scheduled jobs, both computed the same way: start from upcoming approved events, fan out to followers, group per user.

| Job | Schedule (IST) | Window | Channels |
| --- | --- | --- | --- |
| Weekly digest | Sunday 18:00 | Events in the next 14 days | Email only |
| Day-before reminder | Daily 18:00 | Events starting tomorrow | Push if subscribed, else email |

**Matching algorithm (both jobs)**

1. List approved events in the window via `byStatus` (gsi2, sorted by `startDateTime`)
2. For each event, collect targets: `venueId`, `organiserId`, every artist id in `EventArtist`
3. For each target, query `FOLLOWERS#${type}#${id}` (memoize per run; the same sabha appears many times)
4. Build `userId -> [{event, reasons[]}]`, deduping events reached through several follows
5. Apply user preferences and caps, then send

**Ranking and caps**

- Reason weight: RSVP 10, artist follow 3, organiser 2, venue 1; an event's score is the sum
- Digest: up to 15 events, sorted by date, each line shows why ("You follow T.M. Krishna and Narada Gana Sabha")
- Reminder: at most 3 events per user per day, highest score first; the rest are dropped, not delayed. December season will hit this cap
- No reminder for an event the user already logged in their concert book

**RSVPs**: the day-before reminder also covers every event the user RSVPed to, read from the `Rsvp` primary index (`RSVP#${eventId}`). RSVPed events always send and sit outside the cap of 3.

**Email (SES)**

- From `concerts@rasika.life`, plain HTML template, event links with UTM tags
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers for one-click unsubscribe (Gmail requirement for bulk senders)
- Footer links: manage follows, turn off digest, turn off reminders
- Bounce and complaint SNS topics set `notifyEmail = false` on hard bounce or complaint

**Web push**

- VAPID keys in SST secrets; `web-push` library in the sender Lambda
- Service worker in the web package handles `push` and `notificationclick` (opens the event page)
- On `410 Gone`, delete the `PushSubscription`
- iOS needs the site added to the home screen first; the prompt explains this on iOS Safari

**Preferences (`/me/notifications`)**

- Toggles: weekly digest, day-before reminders, email, push
- Signed unsubscribe links work without sign-in

## Sabha dashboard and export

The dashboard lives at `sabha.rasika.life`: read-only stats plus a consented export, for people a moderator has invited.

**Hosting**

- Decided: `packages/sabha`, a separate React Router v7 app on its own SST site, calling the shared tRPC API
- Move it to its own package (as with `classes.rasika.life`) for its own build, deploy and release cadence, and room for a PWA later
- SST: one site resource each for `sabha.rasika.life` and `admin.rasika.life`; the auth session is shared through a cookie scoped to `.rasika.life`

**Access**

- Moderator invites by email from the organiser or venue admin page; creates a `PartnerMember` on first sign-in with that Google account
- `owner` can export and invite viewers; `viewer` sees stats only
- One user can belong to several organisers and venues; a switcher sits in the header

**Verification and self-service**

- Signing in verifies nothing on its own; any Google account can sign in
- Verification is the moderator invite: when the first `owner` accepts, set `verifiedAt` on the organiser (and on each venue it manages). Public pages show a Verified badge
- Verified owners edit their organiser and venue details directly. Each save writes `ChangeHistory` (add `organiser` and `venue` entity types) so a moderator can roll back
- Owners add and edit events for their own organiser. These are auto-approved as a trusted source, appear in a moderator spot-check feed, and a per-organiser switch can turn review back on
- Owners manage the spaces (halls) at their venues

**Screens**

| Screen | Shows |
| --- | --- |
| Overview | Follower count and 30 day trend, scans this week, upcoming events at a glance |
| Profile | Organiser and venue details, editable by verified owners |
| Events | Upcoming and past events; add or edit an event |
| Spaces | Halls at each venue, with the codes placed in each |
| QR codes | Each code with venue, space, label, scans, follows (assignment stays with moderators) |
| Followers | Count, new this month, opted in to share, sharing withdrawn this month |
| Export | CSV download of opted-in followers (owner only) |

**Consent and export rules**

- Public pages show `followerCount` only; never names
- Export includes only `Follow` items with `shareWithTarget = true`: name, email, WhatsApp number with its verified flag, followed at, source
- The consent text names the specific organiser or venue; consent to one never covers another
- A user can withdraw sharing per target in `/me/following`; withdrawn users drop from the next export
- Every export writes an audit row (who, when, row count); exports are presigned links valid for 5 minutes
- Artists get counts only in v1; artist export waits for the `ArtistClaim` flow

Withdrawals reach the sabha only as a monthly count on the Followers screen: no names and no notification. A sabha keeps any CSV it already downloaded, so the export screen asks them to discard older exports when they download a new one.

## tRPC API and web routes

**Core domains** (`packages/core/src/domain/`): `venue-qr`, `follow`, `partner-member`, `push-subscription`, plus `notification` for the two jobs. Browser-safe types go in each domain's `client.ts` with a subpath export.

**Routers**

| Procedure | Type | Auth | Purpose |
| --- | --- | --- | --- |
| `qr.resolve` | query | public | Resolve a code to state, venue, candidate events |
| `qr.createBatch` | mutation | moderator | Mint codes, enqueue PDF |
| `qr.listBatches`, `qr.getBatch` | query | moderator | Batch list, PDF status and download URL |
| `qr.list` | query | moderator | Filter by status, batch, venue |
| `qr.assign`, `qr.bulkAssign` | mutation | moderator | Bind codes to a venue with labels |
| `qr.updateLabel`, `qr.reassign`, `qr.retire` | mutation | moderator | Manage live codes |
| `qr.statsByVenue` | query | moderator or partner | Scans and follows per code |
| `follow.bulkSet` | mutation | protected | Apply the follow screen's choices |
| `follow.toggle` | mutation | protected | Follow buttons on entity pages |
| `follow.status` | query | protected | Which of these targets do I follow |
| `follow.mine` | query | protected | `/me/following` list |
| `follow.setShare` | mutation | protected | Grant or withdraw sharing per target |
| `notify.getPrefs`, `notify.setPrefs` | query, mutation | protected | Preferences |
| `notify.subscribePush`, `notify.unsubscribePush` | mutation | protected | Register browser endpoint |
| `partner.invite`, `partner.revoke` | mutation | moderator | Dashboard access |
| `partner.mine` | query | protected | Dashboards I can open |
| `partner.overview` | query | partner | Dashboard stats |
| `partner.exportFollowers` | mutation | partner owner | CSV to private S3, presigned URL |

Add a `partnerProcedure` that checks a `PartnerMember` for the requested target, next to `protectedProcedure` in `packages/trpc/src/trpc.ts`.

**Web routes**

| Route | Who | Purpose |
| --- | --- | --- |
| `/q/:code` | anyone | Scan landing, follow screen, picker or venue mode |
| `admin.rasika.life/qr/:code/assign` | moderator | Assign form |
| `admin.rasika.life/qr` | moderator | Codes and batches |
| `admin.rasika.life/qr/batches/new`, `admin.rasika.life/qr/batches/:id` | moderator | Create batch, download PDF |
| `/me/following` | signed in | Manage follows and sharing |
| `/me/notifications` | signed in | Notification preferences |
| `/unsubscribe/:token` | anyone | One-click unsubscribe |
| `sabha.rasika.life/` and `/:targetType/:id/*` | partner | Dashboard |

Follow buttons also go on the public venue, organiser and artist pages so following is not QR-only.

## Analytics, edge cases, privacy

**Pilot metrics**

| Metric | Source | Pilot bar |
| --- | --- | --- |
| Scans per concert | `QrScanDay.scans` | 10+ at a mid-size sabha concert |
| Scan to follow conversion | `follows / scans` per code | 30%+ |
| Signed-out drop-off at Google | scan landings vs callback completions | Watch only |
| Digest open rate | SES events | 25%+ |
| Push opt-in among followers | `PushSubscription` count | Watch only |
| Sabha dashboard weekly use | partner sign-ins | 1 of 3 pilot sabhas returns weekly |

**Edge cases**

- Event listed under the wrong venue: rasika sees venue mode, still able to follow; moderator fixes the event
- Event not on rasika.life at all: venue mode, plus a "Is tonight's concert missing?" link to the poster upload flow
- Phone's in-app browser blocks Google OAuth (WhatsApp, Instagram webviews when the link is shared): detect user agent, show "Open in browser"
- Concert runs past midnight: the live window uses start and end times, not the calendar date, so it still resolves
- Sticker swapped or defaced: retire the code; scans of retired codes are still counted so you can spot this
- Followed artist or organiser is merged: cascade moves the follow; a user who followed both ends up with one
- User deletes account: delete all `Follow`, `PushSubscription`, `PartnerMember` items and decrement counters

**Privacy (DPDP Act)**

- Following and sharing are separate, affirmative choices; nothing is pre-ticked
- Store `shareConsentAt` and the exact consent text version on each `Follow`
- Notice on the follow screen links to a short privacy page: what is stored, who sees it, how to withdraw
- Exported CSVs are the sabha's responsibility once downloaded; say so on the export screen

## Build sequence

Data layer first, then the scan page, then admin, then sends. Each phase ships on its own.

1. **Data layer**: `Follow`, `VenueQr`, `QrBatch`, `QrScanDay` entities, counters, merge cascades, tests
2. **Follow everywhere**: `follow.*` router, follow buttons on venue, organiser and artist pages, `/me/following`
3. **Scan page**: `/q/:code` resolution, follow screen, sign-in carryover, concert book prompt
4. **Admin**: admin.rasika.life app, batch minting, PDF render, scan-to-assign, venue QR panel. First print run here
5. **Email**: SES setup, digest and reminder jobs, preferences, one-click unsubscribe
6. **Pilot**: 2 to 3 sabhas for 4 weeks, codes at entrance and register table
7. **Web push**: VAPID, service worker, push for reminders
8. **Sabha dashboard**: subdomain, `PartnerMember`, overview, profile editing, event entry, spaces, consented export

Phases 1 to 6 are the minimum to learn whether rasikas scan and follow. Push and the dashboard only matter once that answer is yes.

## Review decisions

Decided in the 12 Nov review; the sections above already reflect each one.

| Topic | Decision |
| --- | --- |
| Sabha dashboard hosting | Separate app, `packages/sabha` |
| Admin | New `admin.rasika.life` app; existing admin routes move there later |
| Print sizes | Doubled: 100 mm stickers, A5 tents, A4 posters |
| Missing or ad-hoc concerts | "Add a concert happening here" on scan pages with no live event |
| WhatsApp number | Collected optionally; in sabha exports for users who opted in, flagged unverified until verified |
| Sabha verification | Moderator invite accepted by the owner sets `verifiedAt` |
| Sabha self-service | Verified owners edit details, add events, manage spaces |
| Sharing withdrawals | Monthly count on the dashboard, no names, no notification |
| Halls | `VenueSpace`, optional on codes and events |
| Season pinning | Dropped; events already carry the organiser |
| RSVP reminders | Included, always sent, outside the cap |
| Dashboard name | `sabha.rasika.life` |

## Open questions

- [x] Halls: should a venue have sub-spaces so a hall-specific code skips the picker during multi-hall seasons?
- [x] Season pinning: should a code optionally bind to an organiser for a date range (December season at a hired hall), so venue mode shows that sabha first?
- [ ] Digest day and time: Sunday 18:00 IST is a guess; check with pilot sabhas
- [x] Reminders for RSVPed events too, or follows only?
- [x] Dashboard name: `sabha.rasika.life` or something neutral like `partners.rasika.life` for venues that are not sabhas
- [ ] Paper register: once phone OTP exists, import paper entries as pending subscribers?
- [ ] Print vendor and cost per 100 stickers and tents

## Sources

For the dashboard name decision:

- [Sabha (Wikipedia)](https://Www.wikipedia.org/wiki/Sabh%C4%81)
- [Madras Music Season (Wikipedia)](https://en.wikipedia.com/wiki/Madras_Music_Season)
- [The sabha culture of Chennai, Sriram V](https://sriramv.com/2011/11/18/the-sabha-culture-of-chennai/)
- [Listener's choice of classical music, Citizen Matters](https://citizenmatters.in/?p=512)
- [Nadasurabhi Cultural Association listing, HobbyCue](https://hobbycue.com/place/nadasurabhi-cutural-association)

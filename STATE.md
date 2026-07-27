# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** phase 7 is complete and DHH-reviewed (2026-07-27) with every must-fix and should-fix acted on — see "From the phase-7 review" below. **Phase 8 is next**, and its design is settled: read §4.3.1 of the plan (moderator-invited claims) before starting. Nothing collects artist emails yet, so enrichment done before phase 8 needs a second pass to add them.

Phase 7 also adds two things to the pre-deploy list: (1) the OG cache key changed shape, so **every existing `og-images/**` object is orphaned** — harmless, but the prefix can be emptied to reclaim the space. (2) The **degraded-card rule is unverified against a real deploy**: a card that should carry a photo but couldn't fetch one is served and deliberately *not* cached, so watch that a genuinely photo-less artist doesn't cause a render on every request (it shouldn't — no `photoUrl` means not degraded).

### From the phase-7 review (2026-07-27)

One `dhh-code-reviewer` on Opus over the whole phase. It confirmed the risky parts sound — the `featured` round trip end to end (this is what un-deadens the profile Gallery section), the data URI genuinely rendering through librsvg, no SVG injection, and the photo fetch being unable to wedge the Lambda. Three must-fix and six should-fix, all acted on:

- **The reorder could not express a move between photos sharing an `order`.** Swapping two equal values writes each row the value it already had: two 200s, no toast, no movement, and no sequence of clicks recovers. Duplicates are easy to reach — `addArtistPhoto` defaults `order` to 0. `computePhotoReorder` now renumbers by position and returns only rows that changed, which also heals duplicates already in production. The test that asserted the broken output was itself the bug's alibi; it now asserts the move.
- **A partially-failed reorder diverged the UI from the table.** Two independent POSTs, and the catch rolled *local* state back while the server kept half the write. Now one request carrying the whole move, and the reply always returns the stored list — on the error arm too — so the client syncs to truth instead of a guess.
- **One transient photo-fetch timeout poisoned the cache for a year.** The text-only fallback was written to a key hashed over the unchanged `photoUrl`, and the HEAD then served it forever without retrying. A degraded card is now served but not persisted.
- **The truncation ladder let real names under the photo.** It counted characters; SVG text is measured in pixels. "Bombay Jayashri Ramnath" overflowed 6px, synthetic worst cases by up to 371px, and because the photo paints after the text the title was sliced mid-glyph by the photograph. Replaced with one width estimate driving both font size and truncation, plus a `clipPath` as the hard guarantee since Lambda resolves fonts against Amazon Linux and we cannot measure that here. Verified by rendering through Sharp and measuring the rightmost title pixel: worst case now ends at 719 against a panel starting at 760.
- **The raw `fetch` read a session-expiry redirect as success** — `requireModerator` throws a `redirect`, `fetch` follows it, the login page returns 200 HTML, `res.ok` is true. Dissolved by moving to `useFetcher`.
- **`CARD_VERSION` now feeds the cache hash.** The hash covered the content but not the template, so a redesign would leave every existing card frozen for a year with no remedy but emptying the S3 prefix by hand. The hash also gained a field separator, so a rename shifting a character across the title/subtitle boundary no longer collides.
- Smaller: clearing a caption now `remove`s the attribute instead of storing `''` (so "absent" and "present but blank" stop disagreeing); `readOptionalInt` uses `Number` + `isInteger` rather than `parseInt`, which read `'12.7'` as 12; Remove is held during an in-flight move; the dead `content-length` pre-check, the redundant `preserveAspectRatio`, and the "not an error" comment sitting above a `console.error` are gone. `packages/og-image` split into `card.ts` / `request.ts` / `handler.ts`, so a unit test no longer constructs an S3 client and a tRPC client to call `escapeXml`.

**Deliberately deferred, with reasons:**
- **An atomic reorder via a DynamoDB transaction.** The rows share a partition so it is the natural shape, but nothing in core uses ElectroDB transactions yet. Renumbering made a partial failure self-healing rather than permanent, and the reply now reports truth, so the remaining exposure is a brief wrong order — not corruption. Revisit if it bites.
- **Carrying the hash in the OG URL.** Every request now pays one tRPC query before it can HEAD, including cache hits, which is real cost on a crawler-heavy path. The page emitting `og:image` already has the artist loaded, so `/og/artist/{id}/{hash}` would let the Lambda HEAD immediately. Bigger than the rest; the comment in `handler.ts` states the cost honestly rather than claiming it is free.
- **Streaming the photo fetch with a byte counter.** It buffers the whole body before checking size, and `artist.photoUrl` is an unrestricted `z.string().url()`, so it is a mild SSRF surface. Low risk — moderator-only field, 2.5s cap, sharp's own pixel limit — but pinning to the CDN host would close it.
- **A fetcher per gallery row.** One shared update fetcher means an in-flight toggle disables every Feature and Save button in the grid.

### Phase 6, and what it still owes the first deploy (2026-07-26)

Phase 6 is complete and DHH-reviewed (two agents: backend + frontend) with every finding fixed. Profile redesign, gallery subroute, §6.2 denormalization (repertoire + featured), the daily `ArtistDenormRebuildCron` (both sweeps), and anon-only CDN caching all landed. Before/after deploy: (1) **Run the backfills once post-deploy** so the profile isn't empty until the first cron fires — `pnpm prod-cli rebuild-repertoire` and `pnpm prod-cli rebuild-featured`. (2) **Verify the caching segments on auth:** the profile `_index` loader sends `public, s-maxage=120, stale-while-revalidate=600` to anonymous viewers and `private, no-cache` to signed-in ones (subroutes are public and cache unconditionally). Full CDN offload is safe only if the CloudFront **server cache key includes the `rasika_session` cookie** — confirm SST's default does, or add it, else a logged-in viewer can briefly get a cached anon page (cosmetic only: no sensitive data, gated routes enforce auth themselves). (3) None of this is **verified against a running deploy** (`sst` can't run here) — render the profile, confirm the cron bundles, and check the cache behaviour on the first deploy. A full DHH review of phases 1–5 ran earlier (2026-07-25) and is also fixed — see "From the full phases 1–5 review" below.

### From the phase-6 review (2026-07-26)

Two `dhh-code-reviewer` agents (backend + frontend). Both found the risky parts sound — the CDN caching is correct (RR7 header bubbling traced in the installed dist; no auth leak), the repertoire denormalization is clean, JSON-LD/dates/empty-states/links all verified. Two should-fix clusters, both fixed:

- **Featured only ever *grew* correctly.** Every path that should *remove* a featured entry — event soft-delete, un-crediting an artist, merge — left a dangling teaser link, and `rebuild-featured` had no deleted-event filter so it reinstated stale data. Fixed by giving featured the same scheduled, deleted-event-excluding sweep repertoire has: `Artist.rebuildAllFeatured` rebuilds from the live `isFeatured` junction rows, so all three self-heal (un-credit removes the row, merge rewrites it, delete is filtered). The daily cron now runs both sweeps (renamed `ArtistDenormRebuildCron`).
- **The profile route was a layout *and* the index.** Split into `artists.$artistid._index.tsx` (profile body) + a thin `<Outlet/>` layout — no wasted parent-loader work on subroute SSR, no brittle pathname sniffing.

Nits fixed: stable tie-breaks in the repertoire/featured sorts; CLI sweeps delegate to core (no cross-package reach-ins); loader-typed artist (dropped the casts, added `mergedIntoId`/`deletedAt` to the browser type); `capitalize` dedup; gallery meta group-noun; lazy gallery images; public cache headers on the subroutes. Also null-guarded the events/compositions subroute loaders (pre-existing baseline errors).

### Phase 6 progress (2026-07-25)

Done and committed:
- **Foundations:** `formatEventDate` in `web/app/lib/utils.ts` pins the zone to `Asia/Kolkata` (fixes the runtime-TZ off-by-one), tested under `TZ=UTC`; `structured-data.tsx` gained `MusicGroupStructuredData` and an extended `PersonStructuredData` (image/sameAs/award/memberOf).
- **`artists.$artistid.tsx` redesigned** — hero (photo or initial placeholder, honorific, instrument·city, website + socials), About high, Awards, Gurus & lineage (linked, chronological), Compositions teaser, Repertoire, Notable performances (featured), Events, Gallery teaser, Members/Groups (group-aware), Frequent collaborators, Explore. One empty-state rule, one date formatter, names as stored, JSON-LD switches by `isGroup`. Loader parallelizes `getUser`.
- **New `artists.$artistid.gallery.tsx`** — SSR photo grid via `listPhotos`, paginated, canonical + breadcrumb + empty state; teaser "View all" wired.
- **`/events` subroute** now uses `formatEventDate` (was the runtime-TZ bug); `/compositions` needed no change (renders no dates, already uses shared cards).
- **§6.2 read-efficiency denormalization — done.** Repertoire (`topCompositions`/`topRagas`) and featured performances (`featuredPerformances`) are denormalized onto the Artist row; the loader reads them as fields, so it makes **zero** extra queries for either (down from getRepertoire's ~51-query fan-out and getFeaturedEventsByArtist's full-partition scan). `getRepertoire`/`listFeaturedPerformances`/`getFeaturedEventsByArtist` deleted as dead. Repertoire is refreshed by the `rebuild-repertoire` sweep (scheduled, not inline — see the trigger note in the commit); featured is maintained inline by `setEventArtistFeatured` and backfilled by `rebuild-featured`.

Not visually verified yet (typecheck/lint/tests pass).

**Phase 6 kickoff — read the plan first: `docs/plans/260722-01-artist-profile-redesign.md` §6 (page structure), §6.1 (index subroutes), §7 (JSON-LD).**

The main file to rework is `packages/web/app/routes/artists.$artistid.tsx` (the public profile). Everything phase 6 renders already has data and a procedure behind it — reuse them, do not add new backend:

- **Hero** — `artist.photoUrl` (initial-based placeholder if absent), `artist.name` (rendered as stored, no `fromItrans` — see 0c), instrument + city line, honorific/title, `socialLinks`, `website`. OG image already exists (`packages/og-image`, `artistOgImageUrl`).
- **About** — `biography`, `specialisations`, `activeYears`, `birthYear`/`birthPlace` (the main crawlable block; place high).
- **Awards** — `artist.listAwards` (already loaded in the edit route the same way).
- **Gurus / lineage** — `artist.gurus` now carries `fromYear`/`toYear`/`discipline`; render chronologically, each linked. `displayName ?? name` is NOT a thing — names render as stored.
- **Compositions** — `composition.byComposer` (already used on the profile).
- **Events** — `event.byArtist` (already used); featured-past selection via `artist.listFeaturedPerformances`.
- **Gallery teaser** — `artist.listPhotos` (top `featured`, ordered); hidden entirely when no photos.
- **Members / Groups** — group record (`isGroup`): `artist.listMembers`; individual: `artist.listGroups`. Both render single-hop off the junction's denormalized names.
- **Frequent collaborators** — `artist.collaborators` (denormalized on the record; `Collaborator[]` on the browser-safe `@rasika/core/domain/artist/client`). Re-sort in the browser by `strength` — it is stored but decays with wall-clock time (see the phase-4 deferral).
- **Every section hides cleanly when empty** — no bare headers.

**JSON-LD (§7):** `~/components/structured-data.tsx` has a minimal `PersonStructuredData` (name/url only) and NO `MusicGroup` type. Phase 6 adds `MusicGroup` (with `member[]` for groups), extends `Person` (`image` from photoUrl, `sameAs` from socialLinks+website, `award`, `memberOf` from `listGroups`), switching by `isGroup`.

**Index subroutes (§6.1):** `/artists/:id/events` and `/artists/:id/compositions` already exist — restyle only. `/artists/:id/gallery` is new (`artist.listPhotos`, SSR, canonical, breadcrumb, paginated).

**Heed the whole-phase-5 review's lesson:** phase 6 touches many sections at once. Keep one consistent empty-state rule, one date-formatting rule (pin `timeZone: 'Asia/Kolkata'` — the profile currently formats dates in the runtime TZ, which is UTC on the SSR Lambda; the prefill review found this bites), and one link/name-rendering convention across all sections rather than letting each drift.

**Read-efficiency follow-up (plan §6.2, from the pre-phase-6 DDB review):** the rendering reuses existing procedures, but two read paths are wasteful and must be fixed before the profile ships to production, not before building it — `getRepertoire` is a 51-query per-view fan-out, and `getFeaturedEventsByArtist` filters after a full-partition read. Fix both by denormalizing `topCompositions`/`topRagas` and the short featured list onto the Artist row at write time (the `collaborators` pattern), then swap the loader to single-field reads. Add careful CDN caching (anon-only — the page varies on auth). The S3 search-blob pattern is the wrong granularity for a per-artist page; see §6.2 for why.

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | done |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | done |
| 2 | `ArtistMembership` junction | done |
| 3 | `ArtistPhoto` gallery entity | done |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | done |
| 5 | Create/edit wizard (moderator-only, direct write) | done |
| 6 | Presentation redesign + JSON-LD + gallery subroute + §6.2 denorm | done (reviewed 2026-07-26) |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | done (reviewed 2026-07-27) |
| 8 | Claims + verification queue, incl. moderator-invited claims (§4.3.1) | not started |
| 9 | Polish | not started |

### From the full phases 1–5 review (pre-phase-6, 2026-07-25)

One `dhh-code-reviewer` per phase (phase 2 had never had a machine review). All actionable findings fixed across four commits (core, tRPC, web, cleanup). The two sharpest were verified by hand against the code, then fixed:

- **Two silent data-drift bugs from recovering an id by stripping a lowercased key** — the exact sibling of the key-casing bug the phase-3 sweep couldn't catch, invisible to tests because before and after gave the same wrong answer. (1) `cascade.batchGetCompositions` keyed its map by the lowercased pk, so raga/tala rename and merge never matched the mixed-case `compositionId` and skipped the composition `ragas[]`/`talas[]` refresh. (2) `concert-log.listPastRsvpedWithoutLogs` compared a lowercased sk-stripped id against mixed-case `pastEventIds`, so every logged event reappeared as unlogged. Both now read the id attribute; both guarded with mixed-case tests.
- **`createPerformance` featuring ran outside the approval try/catch** — a featuring failure reported the whole call as failed, so a retry created a *second* approved public event. Now tolerated; returns the true `isFeatured`.
- **`cascadeArtistNameUpdate` skipped `ArtistMembership.groupName`/`memberName`** (the merge path handled them); **photo merge** now upserts-before-deletes so a mid-merge crash can't lose a photo; **`rebuildArtistCollaborators` returns the computed list** so the merge fixup no longer under-repairs from an eventually-consistent re-read; **`canonicalRole` dropped `dance → bharatanatyam`** (it mislabelled every other dance form) and gained `tanpura`/`nadaswaram`/`thavil`.
- Smaller: `addAward` and `addMember` give a friendly CONFLICT + verify the artist exists; `addMember` rejects a merged-away tombstone; the wizard Form swallows a bare Enter (was: publish + jump out mid-flow); the editor draft carries the guru `id` so a rename keeps years/discipline; `api.upload.image` uses `Object.hasOwn`; `searchLive` skips sub-2-char scans; `ArtistPhoto` order cap enforced at the entity; a shared `existingKeySet` guards all six merge existence-checks against unprocessed BatchGet keys.
- **Deleted dead/broken tooling:** `scripts/fixGsiKeys.ts` (+ `fix:gsi-keys` CLI) scanned uppercase keys against lowercase rows so it repaired nothing while reporting "healthy"; `core/shared/singleTable.ts` was unimported uppercase-key dead code.

**Deliberately not changed (defensible as-is, not fixes):**
- `listMembers`/`listGroups` stay `publicProcedure` over `pages:'all'` — the public profile must read them and the partitions are tiny (a duo has two members). Bounding the core query would break the merge cascade, which needs all rows.
- `searchLive` does **not** short-circuit the fuzzy scan on an exact hit — a typeahead should still offer alternatives; the sub-2-char guard is the real cost cut.
- `ArtistPhoto` has no per-photo moderation status field — "moderation" in §4.7 is the moderator-gated writes (all photo mutations are `moderatorProcedure`), which exist. No status workflow was specced.
- The pre-existing phase-4 design deferrals below (strength decay, inline-cap dimension, nothing schedules `rebuild-collaborators`, hard-delete leaves junctions) are unchanged — they predate this review and are design calls, not review findings. The one phase-4 deferral this review *did* close: `rebuildArtistCollaborators` no longer returns void.

### Phase 5 slices (it is large, so it is built in vertical slices)

| Slice | What | Status |
|---|---|---|
| wave 1 | Live artist/award search endpoints; `/artists/new` flat form; `EventArtist.isFeatured` setter + procedures | done |
| shell | `/artists/:id/edit` role branch: moderator wizard (Identity, About, Review) writing Artist directly; editor keeps draft form. Reviewed. | done |
| relationships | Guru timeline + group-membership section. Reviewed. | done |
| recognition | Awards + notable-performances + gallery sections. Reviewed. | done |
| prefill | 'Add a performance' path: event.createPerformance creates+approves a single event tagging the artist. Reviewed. | done |

Phase 5 also had a **whole-phase review** after all slices landed — it caught three cross-slice defects (auth policy applied to one mutation not nine; a dead award-search slice; a Review screen that promised a clearing preserve-on-blank never performs) and several consistency items, all fixed. See "From the whole-phase 5 review" below.

Each modal writes to one sub-collection through procedures already built: gurus → `artist.update`, membership → `artist.addMember`/`removeMember`, awards → `artist.addAward`/`removeAward`, performances → `artist.setFeaturedPerformance`, gallery → `artist.addPhoto`/`updatePhoto`/`deletePhoto`. `SearchSelect` (with `createNew`) is the picker; the live endpoints back it.

### What phase 0 landed

- **0a** — `artist.create`/`update` now require editor, `delete` requires moderator and soft-deletes. Previously any logged-in user could hard-delete an artist.
- **0c** — artist and composer names no longer pass through `fromItrans`. Raga names, tala names, composition titles and lyrics still do; the split is per field.
- **0b** — `packages/core/src/domain/artist/dedup.ts` holds the shared find-or-create, now backing the event router's `resolveArtist`. `cascadeArtistMerge` migrates `ArtistAward` rows and rewrites `gurus[]` on other artists. New `cascadeArtistNameUpdate` refreshes `EventArtist.artistName` and `ArtistAward.artistName` on rename.
- **1** — new Artist fields (`instrument`, `city`, `practiceStartYear`, `debutYear`, `photoUrl`, `photoUploadId`, `isGroup`, plus entity-only `claimStatus`/`verifiedAt`), widened `gurus`, `EventArtist.isFeatured`/`featureRank`, `Image` `'artist'` end to end, and the admin CSV columns.

### Resolved: the uppercase-key bug (fixed in code and repaired in prod)

ElectroDB lowercases key values, so the table holds `event#abc` / `#metadata`. Around thirty raw commands hand-wrote `EVENT#abc` / `#METADATA`, addressing rows that do not exist. Both failure modes were silent — `DeleteItem` succeeds having deleted nothing, `UpdateItem` *creates* the row instead of updating the real one. Three GSI key writes were wrong the same way, which is quieter still: the row updates but drops out of that index, so after a merge compositions vanished from `byComposer` and events from their venue and organiser listings.

**Code:** `packages/core/src/db/keys.ts` now holds `keyOfEntity`/`keysOfEntity`, which ask the entity via `conversions.fromComposite.toKeys`. Raw commands remain only where ElectroDB cannot express the operation (atomic counters, nested attribute updates) but no longer build their own keys. Entity mocks in tests take real `conversions`, so key assertions exercise the real derivation rather than agreeing with the test's own literals.

**Production, repaired 2026-07-22:** 30,198 items scanned, 15 phantom rows found. Nine attributes repaired from source rather than by replaying stale phantom values — eight `venueName`s (seven events were displaying a street address instead of "Sri Siddi Ganapathi Temple") and one `rsvpCount` recounted from the actual RSVP rows. All 15 phantoms deleted; a re-scan reports zero. `pnpm cli repair-uppercase-keys` re-runs the scan, dry by default.

Five `EDIT#` phantoms were deleted without repair: those edits are already approved and their real rows still carry `proposedValues`, so the lost write was a superseded update.

### From the whole-phase 5 review

Acted on: the auth policy (all nine wizard mutations now moderatorProcedure, not one), the dead award-search slice (deleted; resolveOrCreate now case-insensitive), the Review-screen dishonesty (blanked preserve-on-blank fields show "(unchanged)"), the anonymous full-scan search endpoint (moderator-gated), the PerformancesEditor dedup guard, and the misleading guru copy.

Still open — one focused follow-up, its own review:

- **The five `/api/artist/*` resource routes are copy-paste** — method-check, `requireModerator`, the `((formData.get(x) as string) || '').trim()` idiom, and a try/catch/`console.error`/`data({error},{status})` block, repeated ~7 sites including `artists.new.tsx` and the edit action. The repetition has already diverged: `api.artist.resolve` returns 500 while the others return 400, and four pass raw `error.message` to the client (fine for TRPCError text, a mild leak on an unexpected fault). A `withModerator(handler)` + `field(formData, name)` helper would collapse them to their logic and single-source the error contract. This is the review's "third cross-cutting pass"; it is a real refactor and should be reviewed on its own.
- The review's named pattern: invariants that live *between* slices (one auth policy, one error contract, one empty-field rule, one verified consumer per endpoint) were owned by no slice, so they drifted. Worth remembering for phase 6, which is even more cross-cutting.

### Deferred from the phase 5 recognition slice

(The recognition and prefill DHH reviews have both been run; findings applied. These are the leftover UI-polish items only.)

- **Per-performance featureRank input was dropped** for reliability — featuring gives an unranked highlight, which `getFeaturedEventsByArtist` orders most-recent-first. The setter and schema support a rank; the UI just doesn't expose it yet. Add a rank input when polishing.
- **Awards use a plain name input, not a picker.** `award.resolveOrCreate` now matches case-insensitively, so it is safe find-or-create; a typeahead would only aid discovery. (Note: the `award.searchLive` endpoint and `/api/search/award-live` route were deleted in the whole-phase review as dead code — a future picker would re-add them.)
- **Gallery reorder is a future item** — photos store an `order` and `updatePhoto` accepts it, but the UI has no reorder control yet (add/delete only). New photos append via `order = current count`.

### Deferred from the phase 5 relationships review

- **specialisations and gurus clear oppositely.** gurus (a managed row list) publishes `[]` when emptied and clears; specialisations (a free-text field) preserves on blank. Left as-is — the controls are visibly different, so "row list clears, text preserves" is a defensible model — but it is an asymmetry a moderator could trip on.
- **Unchecking group on an artist with members orphans the edges.** `updateArtist` writes `isGroup: false` but does not cascade the membership rows; they survive hidden but are still rewritten on merge. This is the deliberately-accepted isGroup trade-off (flip is allowed, stranding is rare and repairable); the wizard now warns rather than fixing it.
- **Browser-only, low priority:** a guru name typed into the picker but neither selected nor "created" leaves the row nameless and is silently dropped on publish; and removing a guru row while its resolve fetcher is in flight can land the resolved id on the re-indexed row (key={i}). Both narrow; confirm/handle in the browser pass.

### Deferred from the phase 5 shell review

- **The venue and organiser edit wizards share the hidden-step validity bug** the artist wizard just fixed: a `required`/`min`/`max`/`type=url` field on a `display:none` step blocks submission with a non-focusable control and no visible error. `venues.$venueid_.edit.tsx` and `organisers.$organiserid_.edit.tsx` want the same step-advance validity gate. Out of scope for the artist slice; worth a small dedicated pass.
- **The moderator wizard cannot clear a field** — blank preserves, by deliberate choice, so there is no way to remove a biography or a specialisation once set. Consistent and predictable now, but if moderators need to clear fields, the fix is dirty-tracking (send only changed fields, with an explicit clear affordance) rather than blank-means-clear.
- `EditorArtistForm` destructures `user` and never uses it — a verbatim carry-over from the original, not introduced here.

### Deferred from the phase 4 code review

Raised, judged real, not yet done:

- **`strength` is stored but decays with wall-clock time.** It is a pure function of `sharedEventCount` and `lastSharedAt`, both stored, so the persisted value and the persisted sort order are stale the moment they are written — and the profile re-sorts in the browser anyway, making it both stored and recomputed. Kept for now only because a naive consumer doing `.slice(0, 12)` without sorting gets roughly-right results from a stored order. Dropping it would shrink the item too, which the 400KB note cares about. Decide deliberately rather than by inertia.
- **The inline cap guards the wrong dimension.** `COLLABORATOR_INLINE_CAP` counts cast size, but the cost is the sum of the cast's *lifetime event counts* — each rebuild walks that artist's whole history, sequentially. Twelve busy accompanists with 300 events each is ~3,600 queries and passes the cap; a 40-artist festival of newcomers is cheap and gets rejected. The guard belongs on event history.
- **Nothing schedules `rebuild-collaborators`.** There is no infra entry, so a skipped festival or a swallowed failure stays stale until someone runs the CLI by hand. `collaboratorsComputedAt` is stored precisely so a sweep could find stale artists by timestamp — but something has to run it.
- **Hard `deleteEvent` leaves junction rows and never recomputes.** Filtered correctly by accident (a missing row is absent from the batch-get result), but no rebuild is triggered.
- ~~`rebuildArtistCollaborators` returns `void`, so `rebuildCollaboratorsAfterMerge` re-reads the artist it just computed.~~ — closed in the phases 1–5 review: it now returns `Collaborator[]` and the merge fixup uses it directly, which also fixes the eventually-consistent stale-read that could under-repair.

### Deferred from the phase 2 self-review

The DHH reviewer failed twice (a stalled stream, then the monthly spend limit), so phase 2 was reviewed by hand against the same questions. Verified sound: the self-membership guards in both merge sweeps are symmetric; the `addMember` `z.union` genuinely rejects both-fields and neither-field payloads, confirmed by parsing rather than reading; `pages: 'all'` on the two membership queries is fine at group sizes.

Fixed on review: `addMember` rejected a non-group target, and a duplicate member now returns `CONFLICT` instead of surfacing an ElectroDB write failure as a 500.

Still open:

- ~~`softDeleteArtist` leaves membership rows behind~~ — closed in phase 3 via `cascadeArtistDeleteToMemberships`. But the phase 3 review made a fair objection that is still open: `softDeleteArtist` is now the only `softDelete*` in the repo that destroys anything, and it is also the `deleteEntity` handler in `edit/registry.ts`, so approving a delete proposal hard-drops membership edges too. The cleaner shape is a `deletedAt` on `ArtistMembership` filtered inside `getGroupMembers`, which already sorts in memory and so pays nothing extra.
- **Phase 2 never got a machine review.** Worth re-running the reviewer over `5ee3234f0..HEAD` when budget allows, since the parts I checked were the parts I already suspected.

### Deferred from the phase 1 code review

- `'venue' | 'organiser' | 'artist'` is written in four places (`image/s3.ts`, `ImageUpload.tsx`, and twice in `api.upload.image.tsx`). A fifth entity means finding all four. Wants a browser-safe `ImageEntityType` in its own subpath — it cannot come from `s3.ts`, which pulls in the AWS SDK.
- `bool()` and `flags()` in `columns.ts` now carry the same truthy/falsy ladder; one `parseFlagCell` would collapse them.
- `json()` has no explicit-clear escape hatch, so `gurus` can never be emptied from CSV — unlike `flags()`, which advertises exactly that. The two conventions now sit in the same column list.
- `bool()` exports `''` for both `false` and unset, so an export can't distinguish "not a group" from "nobody has said".
- `createEventArtistJunctions` (`event/index.ts`) is the third `EventArtistEntity.upsert` and was deliberately not given the `isFeatured` carry-forward, because `updateApprovedEvent` only passes artists not already linked. Nothing records that reasoning, and a refactor that stops filtering would wipe the flag with no test to catch it.

### Carried into later phases

- ~~`isGroup` gating~~ — settled in phase 2: `artist.update` rejects an `isGroup` change from a non-moderator. The admin CSV import bypasses that check by calling `Artist.updateArtist` directly, which is fine since `adminData.import` is `adminProcedure`.
- `claimStatus` and `verifiedAt` exist on the entity but nothing writes them until phase 8.
- `EventArtist.isFeatured`/`featureRank` exist but have no setter yet; the performances modal in phase 5 owns that.

Every wizard picker added later must route through `findOrCreateArtist` rather than calling `createArtist` — that is the guard against multiplying duplicate artists. See 11.2 in the plan. When resolving a batch, fetch `listAllArtistsForMatching()` once and pass it as `candidates`; otherwise each new name sweeps the artist list again.

### Deferred from the phase 0 code review

Raised, judged real, not yet done:

- `cascadeArtistMerge`'s `ArtistAward` block is a copy of its `EventArtist` block with the nouns swapped, verbatim comment included. Both want one `migrateJunctionRows` helper, and `cascadeVenueMerge` probably does too.
- Neither block checks BatchGet `unprocessed`. If keys come back unprocessed the existence check under-reports and the upsert overwrites a canonical `ArtistAward`'s `rank`/`year`/`category`. Pre-existing, inherited by the copy.
- `dedup.ts` imports from `'.'` while `index.ts` re-exports it — a cycle, and the reason the test has to mock the barrel that exports the thing under test.
- `initialsMatch` is exported and tested but no longer called internally; `tokenMatches` absorbed its job.
- Transliteration forks (`Raghunathan`/`Ragunathan`, `Subrahmanyan`/`Subrahmanyam`) are currently rejected as a deliberate false negative. Folding `aa→a`, `ee/ii→i`, `oo/uu→u` and post-stop `h` inside `normalizeArtistName` would catch them without weakening the surname rule. Do not reach for Soundex or Metaphone — they are tuned for English orthography and collide `Krishna` with `Krishnan`.

### Known baselines (so regressions are visible)

Current at end of phase 7. All pre-existing, none caused by this work — a clean run matches these, and any increase is a regression to investigate:

- `packages/core`: **710 tests pass, 3 fail** (`updateArtist`/`updateRaga`/`updateTala` "should throw error when update fails" — all three assert a capitalised message the code emits lowercase); **7 typecheck errors** (6 in `edit/service.ts`, 1 in `event/index.ts:46` — a `festivalId` null). (Grew 688 → 708 → 710 as each review added regression-guard tests.) Measure web-own with: `pnpm typecheck 2>&1 | grep 'error TS' | grep -v '../core' | wc -l`.
- `packages/web`: **32 web-own typecheck errors**; **89 tests pass** (65 → 89 across phase 7). The 32 was written as "≤30" through phase 6 and was stale — the phase-7 review measured the identical count at `e49f666db`, so it is a pre-existing figure, not drift. None of the 32 are in artist or gallery files; the biggest cluster is 12 in `carnatic.compositions.$compositionid.tsx`.
- `packages/og-image`: **25 tests pass**, **0 own typecheck errors** (its `pnpm typecheck` surfaces the same 7 core errors through the `@rasika/trpc` type import — filter with `grep -v 'core/src'`).
- `packages/trpc`: **0 errors under `src/routers/`** (its `npx tsc --noEmit -p .` reports the same 7 core errors, which are not its own).
- Pre-existing lint, do not treat as new: `event.ts` non-null assertion (~line 424), `ImageUpload.tsx` a11y `useKeyWithClickEvents`, and `noArrayIndexKey` warnings (warn-severity per the web override) throughout the wizard.
- Commit messages with inner double-quotes break `git commit -m` shell quoting — commit prose via `git commit -F <file>`.

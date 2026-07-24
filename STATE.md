# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** phase 6 — the presentation redesign. Everything built in phases 1–5 is invisible until the profile renders it: hero photo, bio, gurus with years, collaborators grid, members/groups block, awards, gallery teaser, featured performances, group-aware JSON-LD, and the empty-state handling. This is what a visitor actually sees. **Owed:** a DHH review of the prefill slice (`a1a96ba49`) when convenient.

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
| 6 | Presentation redesign + JSON-LD + gallery subroute | not started |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | not started |
| 8 | Claims + verification queue | not started |
| 9 | Polish | not started |

### Phase 5 slices (it is large, so it is built in vertical slices)

| Slice | What | Status |
|---|---|---|
| wave 1 | Live artist/award search endpoints; `/artists/new` flat form; `EventArtist.isFeatured` setter + procedures | done |
| shell | `/artists/:id/edit` role branch: moderator wizard (Identity, About, Review) writing Artist directly; editor keeps draft form. Reviewed. | done |
| relationships | Guru timeline + group-membership section. Reviewed. | done |
| recognition | Awards + notable-performances + gallery sections. Built directly (agent budget exhausted). **DHH review owed.** | done |
| prefill | 'Add a performance' path: event.createPerformance creates+approves a single event tagging the artist (built proper, not poster-deeplink) | done |

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

### Deferred / owed from the phase 5 recognition slice

- **DHH review not yet run** — the build agent died on the session limit, so I built the slice directly and self-reviewed the load-bearing parts (route auth, the performance toggle round-trip, the backward-compatible ImageUpload change). Run the reviewer over `f7e16f2c9..HEAD` (the award procedure + the slice) when budget resets.
- **Per-performance featureRank input was dropped** for reliability — featuring gives an unranked highlight, which `getFeaturedEventsByArtist` orders most-recent-first. The setter and schema support a rank; the UI just doesn't expose it yet. Add a rank input when polishing.
- **Awards use a plain name input, not a picker.** `award.resolveOrCreate` matches by exact name so it is functionally find-or-create, but a `SearchSelect` over `/api/search/award-live` would aid discovery. Minor.
- **Gallery reorder is a future item** — photos store an `order` and `updatePhoto` accepts it, but the UI has no reorder control yet (add/delete only).

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
- `rebuildArtistCollaborators` returns `void`, so `rebuildCollaboratorsAfterMerge` re-reads the artist it just computed. Returning `Collaborator[]` removes the round-trip.

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

Measured at phase 0 completion. These are pre-existing and not caused by this work:

- `packages/core`: 3 failing tests (`updateArtist`/`updateRaga`/`updateTala` "should throw error when update fails" — all three assert a capitalised message the code emits lowercase), 7 typecheck errors.
- `packages/web`: 35 typecheck errors, tests all pass.
- One pre-existing Biome formatting complaint in `cascade.ts` (`cascadeEventMergeToSetlist`) and one non-null assertion in `event.ts:413`.

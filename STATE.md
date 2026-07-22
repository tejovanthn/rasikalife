# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** phase 4 — the collaborator engine, plus the `rebuild-collaborators` backfill sweep (4.5.1 in the plan) without which the feature ships empty.

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | done |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | done |
| 2 | `ArtistMembership` junction | done |
| 3 | `ArtistPhoto` gallery entity | done |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | next |
| 5 | Create/edit wizard (moderator-only, direct write) | not started |
| 6 | Presentation redesign + JSON-LD + gallery subroute | not started |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | not started |
| 8 | Claims + verification queue | not started |
| 9 | Polish | not started |

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

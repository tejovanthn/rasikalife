# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** fix the uppercase-key bug in `cascade.ts` (see URGENT below) before phase 4. It predates this work and is corrupting data today.

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | done |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | done |
| 2 | `ArtistMembership` junction | done |
| 3 | `ArtistPhoto` gallery entity | done |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | blocked on the key-casing fix |
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

### URGENT: hand-built DynamoDB keys in `cascade.ts` are the wrong case

Found during the phase 3 review, and much larger than phase 3. **ElectroDB lowercases key values.** Verified against the real entities:

```
ArtistEntity.create({id:'a1'}).params().Item.pk   →  "artist#a1"   (not ARTIST#a1)
                                        .Item.sk  →  "#metadata"   (not #METADATA)
CompositionEntity.create(...).Item.pk             →  "composition#c1"
```

`cascade.ts` hand-builds **28** keys in raw commands using uppercase — `pk: \`COMPOSITION#${id}\`, sk: '#METADATA'` and similar. Every one of them addresses a row that does not exist. Split by command:

- **11 `DeleteCommand`** — silently delete nothing. DynamoDB reports success for a delete against a missing key, so these have always looked fine.
- **15 `UpdateCommand`** — worse. `UpdateItem` *creates* the item when the key is absent, so every one of these has been writing a fresh garbage row with an uppercase key instead of updating the real record. `cascadeComposerNameUpdate` has been doing this on every artist rename.

This is very likely the root cause of the "existing merge-related data issues" the plan refers to in 11.3. Merges have been copying rows without removing the originals, and renames have been spraying orphan items into the table.

Phase 3's three new instances are fixed (they now go through `Entity.delete(...)`). **The remaining 25 pre-existing sites are untouched** — the fix is mechanical but the blast radius is the whole cascade layer, the existing tests assert the broken uppercase keys, and it wants its own task with a scan for orphan rows already written to production. Do this before phase 4.

Note the tests could never have caught it: `cascade.test.ts` mocks the entities and asserts on raw command shapes, so it compares the broken key against itself. Assert on `Entity.delete({...})` calls instead.

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

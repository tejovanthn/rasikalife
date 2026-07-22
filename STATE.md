# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** phase 1 — artist attributes, `EventArtist.isFeatured`/`featureRank`, `Image` `'artist'` through all four touchpoints, `artist.getImageUploadUrl`, guru schema widen, and the admin CSV column updates (4.6.1).

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | done |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | next |
| 2 | `ArtistMembership` junction | not started |
| 3 | `ArtistPhoto` gallery entity | not started |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | not started |
| 5 | Create/edit wizard (moderator-only, direct write) | not started |
| 6 | Presentation redesign + JSON-LD + gallery subroute | not started |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | not started |
| 8 | Claims + verification queue | not started |
| 9 | Polish | not started |

### What phase 0 landed

- **0a** — `artist.create`/`update` now require editor, `delete` requires moderator and soft-deletes. Previously any logged-in user could hard-delete an artist.
- **0c** — artist and composer names no longer pass through `fromItrans`. Raga names, tala names, composition titles and lyrics still do; the split is per field.
- **0b** — `packages/core/src/domain/artist/dedup.ts` holds the shared find-or-create, now backing the event router's `resolveArtist`. `cascadeArtistMerge` migrates `ArtistAward` rows and rewrites `gurus[]` on other artists. New `cascadeArtistNameUpdate` refreshes `EventArtist.artistName` and `ArtistAward.artistName` on rename.

Every wizard picker added later must route through `findOrCreateArtist` rather than calling `createArtist` — that is the guard against multiplying duplicate artists. See 11.2 in the plan.

### Known baselines (so regressions are visible)

Measured at phase 0 completion. These are pre-existing and not caused by this work:

- `packages/core`: 3 failing tests (`updateArtist`/`updateRaga`/`updateTala` "should throw error when update fails"), 7 typecheck errors.
- `packages/web`: 35 typecheck errors, tests all pass.
- One pre-existing Biome formatting complaint in `cascade.ts` (`cascadeEventMergeToSetlist`) and one non-null assertion in `event.ts:413`.

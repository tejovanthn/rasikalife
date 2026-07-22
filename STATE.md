# STATE

Single next step, kept current. Everything else lives in `docs/plans/`.

## Active: artist profile redesign

Plan: `docs/plans/260722-01-artist-profile-redesign.md` (revised 2026-07-22 against the codebase).

**Next step:** phase 0b — foundations hardening.

### Phase status

| Phase | What | Status |
|---|---|---|
| 0a | Artist write auth: tighten `create`/`update` to editor, `delete` to moderator + soft delete | done |
| 0b | Shared dedup helper; `mergeArtist` gaps (`ArtistAward`, `gurus[]`); artist-rename name-copy cascade | next |
| 0c | Drop `fromItrans` from artist read paths | done |
| 1 | Artist attributes, `EventArtist.isFeatured`, `Image` 'artist', admin CSV columns | not started |
| 2 | `ArtistMembership` junction | not started |
| 3 | `ArtistPhoto` gallery entity | not started |
| 4 | Collaborator engine + `rebuild-collaborators` backfill sweep | not started |
| 5 | Create/edit wizard (moderator-only, direct write) | not started |
| 6 | Presentation redesign + JSON-LD + gallery subroute | not started |
| 7 | Photo enrichment incl. OG compositing in `packages/og-image` | not started |
| 8 | Claims + verification queue | not started |
| 9 | Polish | not started |

### Why 0b blocks the rest

Phases 2 onward each add an entity that references artists. Three referencing mechanisms are broken or missing today, so they get fixed before anything new leans on them:

- No shared dedup helper. The only artist find-or-create is `resolveArtist` in `packages/trpc/src/routers/event.ts`, which does an exact `getArtistByName` then blind-creates on a miss.
- `cascadeArtistMerge` (`packages/core/src/domain/cascade.ts`) rewrites `EventArtist` and `Composition` composer rows only. `ArtistAward` rows and `gurus[]` entries on other artists already dangle on every merge.
- `updateArtist` cascades a rename to `composer.name` alone. `EventArtist.artistName` and `ArtistAward.artistName` never refresh.

See 11.3 in the plan for the full list of what `mergeArtist` must rewrite, and which entries are gaps versus already done.

# tRPC API Reference

All tRPC procedures live in `packages/trpc/src/routers/`. The root router (`index.ts`) mounts each sub-router under a namespace key (e.g. `event.*`, `concertLog.*`).

## Access Control

Defined in `packages/trpc/src/trpc.ts`. Every procedure is one of:

| Procedure type | Requirement |
|---|---|
| `publicProcedure` | No auth required |
| `protectedProcedure` | Signed-in user (any role) |
| `editorProcedure` | editor, moderator, or admin |
| `moderatorProcedure` | moderator or admin |
| `adminProcedure` | admin only |

`ctx.user` is non-null inside `protectedProcedure` and above.

---

## artist

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `artist.get` | query | public | Fetch single artist by id |
| `artist.list` | query | public | Paginated artist list |
| `artist.create` | mutation | protected | Create new artist |
| `artist.update` | mutation | protected | Update artist data |
| `artist.delete` | mutation | protected | Soft-delete artist |
| `artist.addAward` | mutation | editor | Link an award to an artist |
| `artist.removeAward` | mutation | editor | Unlink an award |
| `artist.listAwards` | query | public | List awards for an artist |
| `artist.getMergeSuggestion` | query | moderator | Returns both entities + suggested canonical for a merge pair |
| `artist.getRepertoire` | query | public | Most performed compositions and ragas for an artist, derived from logged EventSetlist rows joined via EventArtist. Returns `{ topCompositions: {id, title, count}[], topRagas: {id, name, count}[] }`. |

---

## award

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `award.list` | query | public | All awards |
| `award.get` | query | public | Single award by id |
| `award.create` | mutation | editor | New award |
| `award.update` | mutation | editor | Update award |
| `award.delete` | mutation | editor | Soft-delete award |
| `award.getRecipients` | query | public | Artists who received award |
| `award.listByOrganiser` | query | public | Awards by organiser |

---

## composition

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `composition.get` | query | public | Single composition |
| `composition.list` | query | public | Paginated list |
| `composition.create` | mutation | protected | New composition |
| `composition.update` | mutation | protected | Update composition |
| `composition.delete` | mutation | protected | Soft-delete |
| `composition.byComposer` | query | public | Compositions by composer id |
| `composition.byRaga` | query | public | Filter by raga |
| `composition.byTala` | query | public | Filter by tala |
| `composition.byName` | query | public | Search by name |
| `composition.byLanguage` | query | public | Filter by language |
| `composition.getMergeSuggestion` | query | moderator | Merge pair suggestion |
| `composition.listPerformances` | query | public | Paginated logged performances of a composition. Input: `{ compositionId, limit?, nextToken }`. Returns `ConcertLogItem[]` via the sparse `byComposition` GSI. |

---

## concertLog

User's personal concert attendance book. All mutations implicitly scope to `ctx.user.id`.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `concertLog.get` | query | protected | User's log entry for a specific event |
| `concertLog.list` | query | protected | All user's logs, ordered by `eventStartDateTime` desc |
| `concertLog.upsert` | mutation | protected | Add or update a log entry (with optional notes, max 5000 chars). Atomically increments `attendedCount` on the Event on first creation. |
| `concertLog.delete` | mutation | protected | Remove log entry. Atomically decrements `attendedCount`. |
| `concertLog.countForEvent` | query | public | `attendedCount` for a given event |
| `concertLog.upsertWithSetlist` | mutation | protected | Combined upsert of private notes + ordered setlist items (max 50). Replaces all existing items transactionally, then triggers `recomputeEventSetlist` synchronously. Returns `{ log, setlist: EventSetlist[] }`. |
| `concertLog.getMySetlistForEvent` | query | protected | Calling user's ConcertLogItems for an event, ordered. |
| `concertLog.listPastRsvpedWithoutLogs` | query | protected | Past events the user RSVP'd to but hasn't logged. Used to power the backfill prompt on `/my-concerts`. |

---

## content

Static CMS pages. No auth mutations exposed to the frontend (content is managed internally).

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `content.byPath` | query | public | Fetch published content by URL path |
| `content.list` | query | public | Paginated content list |
| `content.allPaths` | query | public | All published paths + timestamps (used for sitemap generation) |

---

## crawl

Instagram scraping pipeline — moderator-only.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `crawl.getStats` | query | moderator | Counts of pending/processed/skipped/failed social posts |
| `crawl.listPosts` | query | moderator | Paginated posts by status |
| `crawl.triggerCrawl` | mutation | moderator | Invoke Lambda to scrape Instagram for artist/organiser/venue |

---

## edit

Community edit proposal workflow. Editors propose changes; moderators approve or reject.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `edit.createDraft` | mutation | protected | Start a new edit proposal |
| `edit.updateDraft` | mutation | protected | Update an existing draft |
| `edit.submit` | mutation | protected | Submit draft for moderator review |
| `edit.withdraw` | mutation | protected | Cancel a submitted proposal |
| `edit.saveChanges` | mutation | protected | Convenience: create-or-update draft in one call |
| `edit.approve` | mutation | moderator | Approve and apply an edit |
| `edit.reject` | mutation | moderator | Reject with a note |
| `edit.requestDeletion` | mutation | moderator | Flag an entity for deletion via the edit system |
| `edit.requestMerge` | mutation | moderator | Request merge of two entities |
| `edit.getById` | query | protected | Fetch edit proposal by id |
| `edit.getUserEdits` | query | protected | User's edits, optionally filtered by status |
| `edit.getEntityEdits` | query | protected | All edits for a given entity |
| `edit.getPendingEdits` | query | moderator | Queue of pending proposals |
| `edit.getActiveEditForEntity` | query | protected | Check if an in-progress edit already exists for an entity |

---

## eventSetlist

Public canonical setlist per event, derived from all contributors.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `eventSetlist.getForEvent` | query | public | Canonical EventSetlist rows + calling user's own ConcertLogItems when authenticated. Returns `{ canonical: EventSetlist[], userOwn: ConcertLogItem[] \| null }`. Mirrors the `rsvp.getForEvent` pattern — one round trip covers both public render and personal prefill. |
| `eventSetlist.recomputeForEvent` | mutation | moderator | Force-recompute the canonical setlist for an event. Debug/admin tool. |

---

## setlistModeration

Moderation tools for the setlist pipeline. All procedures require moderator or admin role.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `setlistModeration.listPendingFreeText` | query | moderator | Paginated queue of free-text items awaiting linking (no `compositionId`, no moderator review). Ordered by `createdAt` asc. |
| `setlistModeration.linkFreeText` | mutation | moderator | Link a free-text item to an existing composition. Fires watch setters, moves item from gsi4 to gsi2, triggers recompute. |
| `setlistModeration.rejectFreeText` | mutation | moderator | Mark a free-text item unlinkable with a reason enum. Removes from pending queue. |
| `setlistModeration.listDisputes` | query | moderator | EventSetlist rows with `status: 'disputed'`. |
| `setlistModeration.resolveDispute` | mutation | moderator | Set canonical value for a disputed field. Sets row to `status: 'verified'`. |
| `setlistModeration.overrideEventSetlist` | mutation | moderator | Directly edit an EventSetlist row (composition, raga, tala, type). Sets `status: 'verified'`. |
| `setlistModeration.unlockVerifiedRow` | mutation | admin | Revert a verified row back to `derived`, re-enabling automatic reconciliation. |
| `setlistModeration.getStats` | query | moderator | Dashboard counts: `{ pendingFreeText: {count, hasMore}, disputes: {count, hasMore} }`. |

---

## event

Most complex router. Handles the full event lifecycle from AI extraction through moderation to publication.

### Queries

| Procedure | Auth | Description |
|---|---|---|
| `event.get` | public | Approved event by id. Warns to logs + throws NOT_FOUND for non-approved. |
| `event.getDraft` | editor | Any event by id regardless of status |
| `event.listUpcoming` | public | Paginated approved upcoming events |
| `event.listPast` | public | Paginated approved past events |
| `event.byFestival` | public | Events in a festival |
| `event.byVenue` | public | Events at a venue |
| `event.byOrganiser` | public | Events by organiser |
| `event.byArtist` | public | Events featuring an artist |
| `event.listByMonth` | public | Approved events for a `YYYY-MM` month |
| `event.byArtForm` | public | Events by art form |
| `event.byTag` | public | Events by tag |
| `event.checkPosterHash` | editor | Duplicate poster detection — see [Derived Data](#derived-data) |
| `event.matchEntities` | editor | Resolve artist/venue/organiser names to IDs — see [Derived Data](#derived-data) |
| `event.listSubmittedEvents` | moderator | Queue of events awaiting moderation |
| `event.getForReview` | moderator | Any event by id (for moderator review) |
| `event.getMergeSuggestion` | moderator | Merge pair with suggested canonical |
| `event.listDraftEvents` | moderator | All draft events |

### Mutations

| Procedure | Auth | Description |
|---|---|---|
| `event.getUploadUrl` | editor | Presigned S3 URL for poster upload |
| `event.extractFromPoster` | editor | Gemini AI extracts event data from uploaded poster image, creates draft(s) |
| `event.extractFromInstagramUrl` | editor | Fetches image via Puppeteer Lambda, then runs AI extraction |
| `event.submitVerified` | editor | Submit verified event(s) — auto-creates missing venues/organisers/artists, resolves merges, auto-approves if user is moderator |
| `event.updatePoster` | moderator | Replace poster on an approved event |
| `event.approveEvent` | moderator | Approve and publish event, triggers search reindex |
| `event.rejectEvent` | moderator | Reject with note, triggers search reindex |
| `event.forceSubmitDraft` | moderator | Submit a draft bypassing normal validation |
| `event.deleteDraftEvent` | moderator | Soft-delete a draft |
| `event.reExtractDraft` | moderator | Soft-delete draft and re-run AI extraction from its saved poster |

---

## festival

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `festival.get` | query | public | Approved festival by id |
| `festival.getDraft` | query | editor | Any festival by id |
| `festival.list` | query | public | All festivals |
| `festival.listUpcoming` | query | public | Upcoming festivals |
| `festival.listByMonth` | query | public | Festivals for `YYYY-MM` |
| `festival.updatePoster` | mutation | moderator | Replace poster on a festival |

---

## organiser

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `organiser.get` | query | public | Single organiser |
| `organiser.list` | query | public | Paginated list |
| `organiser.getByName` | query | public | Exact name lookup |
| `organiser.create` | mutation | editor | New organiser |
| `organiser.update` | mutation | editor | Update organiser |
| `organiser.getImageUploadUrl` | mutation | editor | Presigned S3 URL for organiser logo |
| `organiser.getMergeSuggestion` | query | moderator | Merge pair suggestion |

---

## raga

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `raga.get` | query | public | Single raga |
| `raga.list` | query | public | Paginated list |
| `raga.create` | mutation | protected | New raga |
| `raga.update` | mutation | protected | Update raga |
| `raga.delete` | mutation | protected | Soft-delete |
| `raga.byMela` | query | public | Ragas in a Melakarta number (1–72) |
| `raga.getByName` | query | public | Exact name lookup |
| `raga.getMergeSuggestion` | query | moderator | Merge pair suggestion |
| `raga.listPerformances` | query | public | Paginated logged performances of a raga. Input: `{ ragaId, limit?, nextToken }`. Returns `ConcertLogItem[]` via the sparse `byRaga` GSI. |
| `raga.getRepertoireStats` | query | public | Performance summary for a raga. Returns `{ raga, performanceCount, topCompositions: {id, title, count}[] }`. Used to drive the "Performed at concerts" section on the raga page. |

---

## rsvp

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `rsvp.getForEvent` | query | public | RSVP info for event; includes the calling user's RSVP status when authenticated |
| `rsvp.toggle` | mutation | protected | Toggle RSVP on/off. Atomically updates `rsvpCount` on the Event. |

---

## search

Powered by a Fuse.js index stored in S3, refreshed after mutations and on a schedule.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `search.search` | query | public | Generic search with optional type filters |
| `search.searchWithFullData` | query | public | Search returning full entity objects |
| `search.searchArtists` | query | public | Artists only |
| `search.searchRagas` | query | public | Ragas only |
| `search.searchTalas` | query | public | Talas only |
| `search.searchVenues` | query | public | Venues only |
| `search.searchOrganisers` | query | public | Organisers only |
| `search.searchEvents` | query | public | Events only |
| `search.searchCompositions` | query | public | Compositions only. Input: `{ query, limit? }`. Returns `{ items: {id, name, score}[] }`. Used by the setlist entry composition typeahead (via the `/api/search/composition` server-side route). |
| `search.health` | query | public | Search engine health status |
| `search.documents` | query | public | All indexed documents for a type (used for sitemap generation) |

---

## tala

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `tala.get` | query | public | Single tala |
| `tala.list` | query | public | Paginated list |
| `tala.create` | mutation | protected | New tala |
| `tala.update` | mutation | protected | Update tala |
| `tala.delete` | mutation | protected | Soft-delete |
| `tala.getByName` | query | public | Exact name lookup |
| `tala.getMergeSuggestion` | query | moderator | Merge pair suggestion |

---

## user

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `user.me` | query | protected | Current user's profile |
| `user.list` | query | admin | All users |
| `user.updateRole` | mutation | admin | Change a user's role |
| `user.getMyPreferences` | query | protected | Effective preferences with defaults applied (theme, contentLanguage, displayName, bio, visibility toggles). |
| `user.updatePreferences` | mutation | protected | Partial update of preferences map. When `displayName` changes, auto-generates a unique `username` slug for the public profile URL. |
| `user.getPublicProfile` | query | public | Public profile by username slug. Returns 404 when `showProfilePublicly` is false. |
| `user.getMyContributionStats` | query | protected | Counts: events logged, setlist items contributed (linked vs free-text), public notes added, member since. |

---

## venue

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `venue.get` | query | public | Single venue |
| `venue.list` | query | public | Paginated list |
| `venue.getByName` | query | public | Exact name lookup |
| `venue.byCity` | query | public | Venues in a city |
| `venue.create` | mutation | editor | New venue |
| `venue.update` | mutation | editor | Update venue |
| `venue.getImageUploadUrl` | mutation | editor | Presigned S3 URL for venue photo |
| `venue.getMergeSuggestion` | query | moderator | Merge pair suggestion |

---

## Derived Data

These are the non-obvious computed or aggregated values the system maintains. Knowing them prevents double-counting bugs and incorrect assumptions about where data lives.

### Denormalized counters on Event

Two counters are stored directly on the Event item and updated atomically with DynamoDB `ADD`:

| Field | Updated by | Direction |
|---|---|---|
| `rsvpCount` | `rsvp.toggle` (via `Rsvp.toggleRsvp`) | +1 on RSVP, -1 on un-RSVP |
| `attendedCount` | `concertLog.upsert` / `concertLog.delete` | +1 on first upsert, -1 on delete |

Both are "fire and forget" increments — the RSVP/log record is the source of truth; the counter is a read-optimized cache on the Event item.

### Performance counters on Composition and Raga

`Composition.performanceCount` and `Raga.performanceCount` are maintained by `recomputeEventSetlist`. After each recompute, the algorithm diffs the previous EventSetlist against the new one and issues atomic `ADD` increments/decrements for each composition/raga that was added or removed.

These counters can drift if a reconciliation write partially fails. A nightly cron job at `packages/scripts/src/recompute-performance-counts.ts` recomputes correct totals from the authoritative GSI counts.

### Denormalized fields on ConcertLog

When a concert log is first created, `eventTitle`, `eventStartDateTime`, `venueName`, and `artistNames` are copied from the Event at that moment and stored on the log. They are **not** updated if the Event is later edited — the log is a historical snapshot of what the user attended.

### Denormalized fields on Event artists list

`event.artists` is a list of `{id, name, title, role}` maps embedded on the Event item. The artist `name` and `title` are copied at submission time. They are not live-linked to the Artist entity — if an artist's name changes, existing event records are not updated (cascade is limited to the search index refresh).

### Poster hash deduplication (`event.checkPosterHash`)

On upload, a perceptual hash of the poster image is computed and stored in a separate `PosterHash` entity. `event.checkPosterHash` looks up that hash and returns `{ duplicate: true, posterUrl, festivalId, eventIds }` only if at least one linked event is `approved`. This prevents re-importing the same festival poster from social media.

### Entity matching (`event.matchEntities`)

Takes arrays of raw name strings (from AI extraction) and returns a map of `name → [{id, name, score}]` suggestions per entity type. Each name is resolved by running an exact DB lookup (`getByName`) **and** a Fuse.js fuzzy search in parallel, then deduplicating by id. Score `0` means exact match; higher score means fuzzier. The UI uses this to let editors confirm or override AI-extracted entity names before submission.

### Auto-entity creation in `event.submitVerified`

When an editor submits verified events, any venue/organiser/artist that has a name but no id is automatically created as a new entity (or matched to an existing one by name). Merge redirects are also followed: if a resolved entity has a `mergedIntoId`, the canonical entity's id/name is used instead. This means the create-on-submit path can silently produce new Artist/Venue/Organiser records.

### Merge score

`getMergeSuggestion` calls `get<Entity>MergeScore(id)` for both entities and recommends the one with the higher score as canonical. The score formula is domain-specific (see each entity's `client.ts`) but generally rewards more linked data (events, awards, compositions, etc.).

### Generic event title detection (`isGenericTitle`)

`packages/web/app/lib/generic-title.ts` — called in event list/detail views to detect uninformative titles like "Carnatic Music Concert" or "Concert by Sri X". When `true`, the UI substitutes a derived display name (typically artist + date). It checks regex patterns first, then falls back to comparing the normalised title against `"concert by {firstArtist}"` and `"{artForm} concert by {firstArtist}"`.

### AI event extraction flow

`event.extractFromPoster` / `event.extractFromInstagramUrl` → Gemini Vision → draft Event(s) created in DB with `status: draft` and `extractionConfidence` score. For Instagram, a dedicated Puppeteer Lambda fetches the image first (keeping Chromium out of the tRPC bundle) before passing the image buffer to the same extraction path.

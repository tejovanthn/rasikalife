# Artist Profile Redesign PRD

Spec ID: `260722-01-artist-profile-redesign`
Status: draft (revised 2026-07-22 against the codebase)
Reference page: https://rasika.life/artists/yagnika-iyengar-3DffDH8XBOZhLi9zbauBhDD4nOK

This revision checked every "already exists" claim in the first draft against the code. Five were wrong and are corrected in place: the shared dedup helper, the artist-rename name-copy cascade, `ArtistAward` handling in `mergeArtist`, the moderator direct-write split, and the shape of the venue/organiser wizard convention. The transliteration section is rewritten — the bug is a render-time call, not a pipeline defect — and `displayName` is dropped as a result. A phase 0 now precedes the numbered phases.

Two things the first draft missed entirely: the `Edit` row is single-entity, so the wizard cannot draft its junction writes (5.1), and the admin bulk-CSV column list needs updating alongside the schema or it silently drops the new fields and wipes the reshaped guru data (4.6.1).

## 1. Problem

Artist profiles are the weakest high-intent page on the site. The reference page renders a name, a role string, a two-field About block, an events list, and generic explore links. Nothing conveys who the artist is, who they perform with, or why they matter. Three concrete failures:

- **No credibility surface.** No photo, no bio, no lineage, no awards, no compositions. A rasika landing here learns nothing.
- **No relationship graph.** The artist performs with a recurring ensemble ("Trayag Natyalaya Ensemble") but that is a dead role string, not a link to co-performers.
- **Transliteration bug live in the H1.** The page renders `ẏagnika īyengar` instead of the intended English form. This is not a pipeline defect and not confined to this page: the loader runs every artist name through `fromItrans(name, script)`, the default script is `iast`, and ITRANS treats capital letters as significant. So every capitalised name on the site is mangled — `Sanjay Subrahmanyan` → `ṣanjay ṣubrahmanyan`, `T M Krishna` → `ṭ ṃ k͟hriśna`, `Ambujam Krishna` → `āmbujam k͟hriśna` — on the artist index and composer credits as well as the profile. It poisons the title tag, OG tags, and H1 on the most shareable artist surface. See 4.1 for the fix.

## 2. Goal

Make the artist profile the "LinkedIn of Carnatic artists": a page that establishes the artist, surfaces their frequent collaborators, and links outward into the knowledge graph. Priorities, in order:

1. **SEO / discovery** — crawlable text, internal links, structured data, clean titles.
2. **Visual polish / credibility** — photo, bio, lineage, awards presented well.
3. **Relationship graph** — derived collaborators, gurus, ensemble co-performers.

## 3. Scope

In scope: full presentation redesign, derived-collaborator computation and storage, artist photo enrichment (hero + `ArtistPhoto` gallery), artist self-claim + moderator verification (states, UI, and mechanism), group modeling via `ArtistMembership`, a moderator-facing create/edit wizard for rich profile enrichment (career timeline, guru timeline, awards, notable-performance linking, gallery), and index subroutes for events, compositions, and gallery.

Out of scope: a first-class Ensemble entity (collaborators are derived from shared events, not modeled).

## 4. Data model changes

### 4.1 Artist entity additions

Add to the `artist` entity:

| Attribute | Type | Notes |
|-----------|------|-------|
| `photoUrl` | string | CDN URL of artist photo |
| `photoUploadId` | string | S3 presigned-upload session ID |
| `instrument` | string | Primary instrument / discipline (vocal, violin, mridangam, bharatanatyam, etc.). Free text — see 11.1. |
| `city` | string | Current base city, denormalized for a future `byCity` GSI. Free text — see 11.1. |
| `practiceStartYear` | number | Year the artist began formal practice / training |
| `debutYear` | number | Year of first public/arangetram performance (optional, distinct from practice start) |
| `gurus` | list\<map\> | **Reshaped in place** from `{id, name}[]` to `{id, name, fromYear?, toYear?, discipline?}[]`. Same field name, richer element. See 4.6 for migration. |
| `collaborators` | list\<map\> | Denormalized derived collaborators (see 4.4). `{artistId, name, sharedEventCount, lastSharedAt, topRoles: string[], strength}[]` |
| `collaboratorsComputedAt` | string | ISO timestamp of last recompute |
| `isGroup` | boolean | True if this record is a performing group/duo (Saralaya Sisters, Ganesh Kumaresh) rather than an individual. Membership edges live in the `ArtistMembership` junction (4.2), not on this record. |
| `claimStatus` | string | Denormalized badge state: `unclaimed` \| `pending` \| `verified` \| `rejected`. Authoritative claim data lives in the `ArtistClaim` entity (4.3); this copy exists only so the profile renders the badge without a second query. |
| `verifiedAt` | string | ISO timestamp set when a claim is verified. Denormalized for badge display. |

**Name display: stop decoding artist names as ITRANS.** There is no `displayName` field and no backfill. The bug is a display-time call, not stored data, so the fix is to remove `fromItrans` from the artist read paths and render `artist.name` as stored.

The data supports this cleanly. Person names are held in romanised Latin — `Subramanya Bhaaratiyaar`, `OotukkaaDu VenkaTasubbaiyar`, `Ambujam Krishna` — and ITRANS decoding only damages them. Musical terms are held in real ITRANS — `punnaagavaraaLi` → `punnāgavarāl̤i`, `kaambhOji` → `kāmbhOji`, `aadip-paramporuLin` → `ādip-paramporul̤in` — and decoding earns its keep there. So the split is by field, not by record, and needs no flag to decide it.

Drop the `fromItrans` call on artist names in `artists.$artistid.tsx` (the `displayArtist` block), `artists._index.tsx`, and the `composer.name` mappings in `carnatic.compositions.$compositionid.tsx` and `carnatic.compositions._index.tsx`. Leave every other call alone: raga names, tala names, composition titles, lyrics, arohanam/avarohanam all stay. The script selector keeps working for the terms it was built for.

This fixes every artist on the site in one change, so it lands first and the rest of the redesign builds on correct names.

Photo upload reuses the existing `Image` namespace pattern already used by venue/organiser:

```typescript
Image.getImageUploadUrl('artist', fileName, contentType)
// key pattern: images/artist/{uploadId}/{fileName}
```

Four places hardcode `venue | organiser` and all four need `'artist'`:

1. the `entityType` union in `packages/core/src/domain/image/s3.ts`
2. the `entityType` prop union in `packages/web/app/components/ImageUpload.tsx`
3. the allowlist and branch in `packages/web/app/routes/api.upload.image.tsx`
4. a new `artist.getImageUploadUrl` (editorProcedure) on the artist router, copying `venue.ts`

### 4.2 Group model

A performing group is an ordinary Artist record with `isGroup = true`. No separate Ensemble entity. Two real cases the model must handle:

- **Saralaya Sisters** — a duo that only performs as a unit. The group is the primary performing identity. Kavita and Triveni still exist as their own (possibly thin) Artist records, and both link to the group.
- **Ganesh Kumaresh** — a duo where Ganesh and Kumaresh are *also* independently notable soloists with their own managers. Three real records: the group and both members, each independently claimable.

**Membership is a junction, not denormalized lists.** This mirrors `EventArtist` and `ArtistAward`: the edge lives authoritatively in one row, both directions are answered by query, and merges rewrite one entity type instead of reconciling two mirrored lists.

```
ArtistMembership  (ElectroDB entity, service rasikalife)
  primary  pk: GROUP#${groupId}      sk: MEMBER#${memberId}
  byMember (gsi1)  gsi1pk: MEMBER#${memberId}  gsi1sk: GROUP#${groupId}

  attributes: groupId, groupName, memberId, memberName, role?, rank?, createdAt
```

`groupName` and `memberName` are denormalized display copies (same pattern as `EventArtist.artistName`, `ArtistAward.awardName`), so the group page renders its member list in a single primary-index query and a member page renders its groups in a single GSI query, with no per-row lookup. The names are the only duplicated data; the edge itself exists in exactly one place.

Functions:
- `addArtistMembership({groupId, groupName, memberId, memberName, role?, rank?})` → ArtistMembership
- `removeArtistMembership(groupId, memberId)` → void
- `getGroupMembers(groupId)` → ArtistMembership[] (sorted by rank)
- `getMemberGroups(memberId)` → ArtistMembership[]

Rules:

- **Members always exist as their own Artist records**, even when thin. Adding a member is a find-or-create over member names, which **must route through the shared dedup helper** (honorific stripping, initial-vs-full-name matching). **That helper does not exist yet** — phase 0 builds it. Today the only find-or-create for artists is `resolveArtist` in `packages/trpc/src/routers/event.ts`, which does an exact `getArtistByName` lookup and blind-creates on a miss. Wiring membership to that path as it stands is a duplicate-artist factory.
- **No drift, no paired write.** Because the edge is a single junction row, there is no `members[]`/`belongsToGroups[]` pair to keep in sync and no reconciler needed. Stale display names after a rename are cosmetic. Note that the name-copy sweep this leans on is **thinner than assumed**: `updateArtist` cascades to `composer.name` on compositions and nothing else. Renaming an artist does not currently refresh `EventArtist.artistName` or `ArtistAward.artistName`. Phase 0 adds that cascade, and membership name copies join it.
- **Events and collaborators treat the group as a normal artist.** The group's events are events where the *group* is the listed `EventArtist`; its collaborators derive from those events exactly like any individual. Members' solo events stay on the member records. Group events do **not** fan out onto member event lists (a member's page shows their solo work; the group link is how you reach the group's events). Whether a listing credits the group or the individual members is a data-entry choice at event creation, not something the model auto-merges.
- **`mergeArtist` rewrites junction rows.** Merging an artist that is a group or a member rewrites the `ArtistMembership` rows referencing the loser (both the primary and GSI direction fall out of rewriting `groupId`/`memberId` and their name copies). Collaborator-edge fixups (4.4), `ArtistClaim` rows (4.3), and `ArtistPhoto` rows (4.7) happen in the same pass. **The sweep is narrower than assumed:** `cascadeArtistMerge` today rewrites `EventArtist` rows and `Composition` composer fields, and nothing else. `ArtistAward` rows and `gurus[]` entries on other artists are already left dangling on every merge. Phase 0 closes those two gaps before any new entity adds to the list.

### 4.3 Claim model (dedicated `ArtistClaim` entity + queue)

Claims are a first-class entity, **not** a map on the Artist record, because a dedicated moderation queue must query all pending claims by status. A buried map can't answer "show me the pending claims" without scanning every artist; a status GSI can, matching your existing `Edit.byStatus` / `Event.byStatus` shape.

```
ArtistClaim  (ElectroDB entity, service rasikalife)
  primary  pk: ARTIST#${artistId}   sk: CLAIM#${userId}
  byStatus (gsi1)  gsi1pk: ARTIST_CLAIM_STATUS#${status}  gsi1sk: ${createdAt}
  byUser   (gsi2)  gsi2pk: ARTIST_CLAIM_USER#${userId}    gsi2sk: ${createdAt}

  attributes: artistId, artistName, userId, userName, userEmail,
              status, note?, moderatorId?, moderatorNote?,
              createdAt, processedAt?
```

`status` enum: `pending` | `verified` | `rejected`. (There is no `unclaimed` claim row; `unclaimed` is the *absence* of any verified claim, reflected by `artist.claimStatus`.)

- **One row per (artist, claimant).** Multiple claimants on one record = multiple `ArtistClaim` rows sharing the `ARTIST#${artistId}` PK, so `getArtistClaims(artistId)` returns all of them in one query. For Saralaya Sisters, Kavita, Triveni, and a manager are three rows under the same group artist.
- **Group and member claims are fully independent.** They're rows under different `artistId` PKs. Claiming Ganesh never touches Ganesh Kumaresh. No auto-grant across the membership edge.
- **Verification is per-record.** When a moderator verifies any claim for an artist, that artist's denormalized `claimStatus` flips to `verified` and `verifiedAt` is set. Additional claimants on an already-verified artist still create `pending` rows requiring approval.
- **No new auth role required to claim.** Claimants are ordinary Google-OAuth users; `userId` is their existing user record. A claim drives only the badge and "managed by" state, not edit rights beyond the normal editor role.

Functions:
- `createArtistClaim({artistId, artistName, userId, userName, userEmail, note?})` → ArtistClaim (status `pending`; sets `artist.claimStatus = pending` if currently `unclaimed`)
- `getArtistClaims(artistId)` → ArtistClaim[]
- `getPendingClaims(params?)` → `{items, nextToken?, hasMore}` (the queue feed, via `byStatus`)
- `getUserClaims(userId)` → ArtistClaim[]
- `approveClaim(artistId, userId, moderatorId)` → sets row `verified`, `artist.claimStatus = verified`, `verifiedAt`
- `rejectClaim(artistId, userId, moderatorId, moderatorNote)` → sets row `rejected`; recomputes `artist.claimStatus` (back to `unclaimed` if no verified claim remains)

**Dedicated queue, separate from content moderation.** Claim review is its own moderator surface with its own feed (`getPendingClaims`), deliberately kept out of the Edit/Event moderation queues so the two responsibilities don't intermix. This leaves room to later gate claim review behind a distinct permission (e.g. a `claim-moderator` capability) without disturbing content moderation. For now any `moderator` can action claims, but the surface and the query are separate.

`mergeArtist` must also rewrite `ArtistClaim` rows: claims on the loser move to the canonical artist (or are dropped if a duplicate claim by the same user already exists there), folded into the same merge sweep as membership and collaborator edges.

### 4.4 Collaborator derivation

Definition: two artists are collaborators if they appear on the same approved event via `EventArtist`. Strength is weighted by shared-event count and recency.

Strength formula (tunable, start simple):

```
strength = sharedEventCount * recencyBoost
recencyBoost = 1 + (1 / (1 + monthsSinceLastShared))
```

So a pair with many recent shared events ranks above a pair with the same count years ago. `topRoles` records the roles the *other* artist played across shared events (from `EventArtist.role`, mapped through `canonicalRole` per 11.1 so grouping keys are clean), so a vocalist's page can show accompanists in context.

Storage: denormalized onto `artist.collaborators` as a ranked list. Display shows top N by strength (N configurable, default 12), no hard threshold on count. Rendered as a flat ranked grid, not grouped.

### 4.5 Computation trigger

Precompute on event approval, inline in `approveEvent`, mirroring the `rsvpCount` denormalization philosophy (write cost at mutation time, zero read cost).

On approval of an event with artists `A = [a1..aN]`:

1. For each `ai`, load its current `collaborators`.
2. For each other `aj` in `A`, upsert the pair into `ai.collaborators`: increment `sharedEventCount`, set `lastSharedAt = event.startDateTime`, merge `aj`'s role into `topRoles`.
3. Recompute `strength`, re-sort, write back `ai.collaborators` + `collaboratorsComputedAt`.

This is O(N²) writes across N artist records per approval. For typical concerts (3-6 artists) this is negligible. **Known scaling limit:** festival events with many listed artists (20+) produce a heavy fan-out. Mitigation deferred: cap inline recompute at a configurable artist count (e.g. skip inline and enqueue if `artists.length > 12`), with an async job as future work. Ship inline; flag the async path as a follow-up.

Edge cases:
- **Un-approval / soft delete / merge** should decrement or rebuild. Simplest correct approach: on event soft-delete or merge, mark affected artists dirty and rebuild their collaborator list from their `getEventsByArtist` set rather than trying to reverse-increment. Spec a `rebuildArtistCollaborators(artistId)` function usable both for repair and as the async path.
- **Artist merge** (`mergeArtist`) must fold the loser's collaborator edges into the canonical artist and rewrite any list that referenced the loser.

#### 4.5.1 Backfill sweep (`rebuild-collaborators` script)

Because the trigger is `approveEvent`, every event approved before phase 4 contributes nothing and the feature would launch empty. A one-time sweep populates the history; the same command is the repair tool afterwards.

**Do not loop `rebuildArtistCollaborators(artistId)` over every artist.** That is one `getEventsByArtist` query per artist, then a co-artist lookup per event of theirs, so shared events get read once per participant. One pass over the junction gets the same answer:

1. Scan `EventArtistEntity` for `eventId`, `artistId`, `artistName`, `role`, `eventStartDateTime`.
2. Drop rows whose event is soft-deleted (see the caveat below).
3. Group rows by `eventId`. Each group is one event's cast.
4. For each group, emit every ordered pair `(ai, aj)` into an in-memory map keyed by `ai`: increment `sharedEventCount`, keep the max `eventStartDateTime` as `lastSharedAt`, collect `aj`'s `role` through `canonicalRole` into `topRoles`.
5. Compute `strength` per 4.4, sort, and write `collaborators` + `collaboratorsComputedAt` once per artist.

`recompute-performance-counts.ts` is the working model for steps 1 and 5 — paginated `.scan.go()` with a cursor, aggregate in a `Map`, then write in parallel batches of 25.

**Caveat that makes a naive scan wrong.** `softDeleteEvent` (`packages/core/src/domain/event/index.ts`) sets `deletedAt` on the Event alone and leaves the `EventArtist` rows in place. So the junction contains rows for deleted events and the sweep must exclude them — scan `EventEntity` for ids carrying `deletedAt` and filter step 2 against that set. Unapproved events need no filter: `createEventArtistJunctions` only runs on approval, so every junction row already belongs to an approved event.

Follows the `dedupRagas` convention rather than the standalone-`main()` one, so it gets a dry run:

```
packages/scripts/src/rebuildCollaborators.ts   → export async function rebuildCollaborators({ dryRun?, artistId? })
packages/scripts/src/cli.ts                    → program.command('rebuild-collaborators')
                                                   .option('-n, --dry-run', ...)
                                                   .option('--artist <id>', 'Rebuild a single artist')
```

Run as `pnpm cli rebuild-collaborators` (or `prod-cli` for production, both already wrapped in `sst shell`). Dry run reports how many artists would change and the top few edges per artist without writing.

The two modes take different paths. With no arguments it runs the scan above, which is the right shape when rebuilding everything. With `--artist` it calls `rebuildArtistCollaborators(artistId)` directly — for one record the per-artist query is cheaper than scanning the whole junction, and it is the repair path after a bad merge.

Re-running must be safe: the sweep computes from scratch and overwrites, so it never double-counts.

### 4.6 Guru field reshape (in place)

`gurus` keeps its name; only its element shape widens from `{id, name}` to `{id, name, fromYear?, toYear?, discipline?}`. The three new keys are optional, so the new shape is a **superset** of the old: every existing `{id, name}` row is already valid under the widened schema. This makes the migration cheap.

1. Widen the Zod/ElectroDB schema for `gurus` to accept the optional `fromYear`/`toYear`/`discipline` keys.
2. No data backfill required. Existing rows validate as-is (the new keys are simply absent). An optional cosmetic pass could normalize nothing, so skip it.
3. Update read paths (profile, JSON-LD, wizard) to render years/discipline when present and degrade gracefully when absent.

The reason this is labelled breaking is the *element contract* changes for any code that constructs guru entries by positional/shape assumption; writers must go through the widened schema. But because it is a superset, there is no window where existing data is invalid, and no parallel field to deprecate.

`fromYear`/`toYear` are optional so an unenriched entry stays valid and the wizard can add years later. Display sorts by `fromYear` when present, falling back to insertion order.

**The reshape breaks the admin CSV round-trip unless the encoding changes with it.** `ADMIN_CSV_DOMAINS.artist` in `packages/core/src/admin/columns.ts` encodes gurus as `refList('gurus', 'gurus', 'guruNames')`, which is names only. Leave it alone and an export, spreadsheet edit and re-import writes the names back and silently wipes every `fromYear`, `toYear` and `discipline` on the record. Switch gurus to a **JSON cell**, the treatment `columns.ts` already gives lyrics, ticketing and tala structure. It round-trips losslessly. Editing it in a spreadsheet is unpleasant, which is fine — the wizard is the real editor for this field.

#### 4.6.1 Admin CSV columns

The PRD adds nine attributes to `artist`, and `ADMIN_CSV_DOMAINS.artist` is a hand-maintained ordered column list, so it needs updating in the same change or the export silently omits them.

- **Add columns:** `instrument`, `city`, `practiceStartYear`, `debutYear`, `isGroup`.
- **Change encoding:** `gurus` from `refList` to a JSON cell, per above.
- **Leave out:** `photoUrl` and `photoUploadId` (written by the upload flow), `collaborators` and `collaboratorsComputedAt` (system-derived, 4.4), `claimStatus` and `verifiedAt` (system-derived from `ArtistClaim`, 4.3). None should be settable from a spreadsheet.
- The new entities — `ArtistMembership`, `ArtistClaim`, `ArtistPhoto` — get **no** CSV domain. They are junctions and moderation state, not bulk-editable content.

Remember `BULK_DOMAIN_KEYS` and `ADMIN_CSV_DOMAIN_KEYS` must stay in sync; a test already asserts it.

### 4.7 Gallery: `ArtistPhoto` entity

Photos beyond the single hero `photoUrl` live in their own entity, not an inline list on Artist. This avoids the 400KB item ceiling a `photos[]` list would eventually hit, and gives each photo its own caption, credit, order, and moderation.

```
ArtistPhoto  (ElectroDB entity, service rasikalife)
  primary  pk: ARTIST#${artistId}   sk: PHOTO#${id}
  byArtist (gsi1)  gsi1pk: ARTIST_PHOTOS#${artistId}  gsi1sk: ${order}#${id}

  attributes: id, artistId, imageUrl, uploadId, caption?, credit?,
              order (number), featured (boolean, default false),
              createdBy, createdAt, updatedAt
```

- Images upload via the existing `Image` namespace (`Image.getImageUploadUrl('artist', ...)`), same as the hero photo. The entity stores the resulting CDN `imageUrl`; it never holds bytes.
- `featured` drives the teaser grid on the profile; `order` drives sequence within both the teaser and the full gallery page.
- `byArtist` GSI sorts by `order`, so both the teaser (top N featured) and the full page render in one query.
- Writes follow the same moderator-direct / editor-draft split as the wizard (5.1).

Functions:
- `addArtistPhoto({artistId, imageUrl, uploadId, caption?, credit?, order?, featured?})` → ArtistPhoto
- `updateArtistPhoto(artistId, id, patch)` → ArtistPhoto
- `deleteArtistPhoto(artistId, id)` → void
- `listArtistPhotos(artistId, params?)` → `{items, nextToken?, hasMore}` (ordered)
- `mergeArtist` reassigns photo rows from loser to canonical.

### 4.8 Featured performances flag

Add `isFeatured` (boolean, default false) and optional `featureRank` (number) to the **`EventArtist`** junction, not the base Event. Featuring is per-artist: a concert can be a career highlight for the vocalist and unremarkable for an accompanist, so the flag belongs to *this artist's participation in this event*, not to the event globally.

- Moderator-set via the performances modal (5.4d).
- The events teaser on a profile (6) selects notable-past entries by this flag on the artist's own `EventArtist` rows, ordered by `featureRank` then date. Upcoming events always show regardless of the flag.
- Because `EventArtist` already carries denormalized `eventTitle`/`eventStartDateTime`, the teaser renders featured performances single-hop off the artist's `byArtist` GSI, no Event fetch needed.

## 5. Moderator create/edit wizard

Purpose: give moderators a single rich surface to build out profiles proactively (reaching out to artists, filling in as much as possible), covering identity, career timeline, relationships, awards, and notable performances. Structure follows the existing venue/organiser convention plus **modal editors** for each repeatable timeline so the main flow stays short.

That convention is split, and the artist routes copy it as it stands: `venues.new.tsx` and `organisers.new.tsx` are flat single-page forms, while `venues.$venueid_.edit.tsx` and `organisers.$organiserid_.edit.tsx` are stepped wizards (`STEP_LABELS` + step state). So `/artists/new` is a flat form, and `/artists/:id/edit` is the stepped wizard of 5.3 for moderators — see 5.1 for why editors get something different.

### 5.1 Moderation interaction

**The wizard is moderator-only and writes directly. Editors keep the existing simple form and its draft.**

The reason is structural, not a preference. An `Edit` row carries one `entityType`, one `entityId`, and a `proposedValues` blob validated against that entity's `updateSchema` — it is single-entity by construction (`packages/core/src/domain/edit/types.ts`). The wizard writes across five entity types: `Artist`, `ArtistMembership`, `ArtistAward`, `EventArtist` and `ArtistPhoto`. Four of those cannot ride the draft queue without rebuilding the Edit system, which every domain on the site depends on.

So `/artists/:artistid/edit` branches on role:

- **Moderator** sees the stepped wizard of 5.3 and writes straight through. Per-entity writes, no transaction — see 11.4.
- **Editor** sees today's simple artist edit form, unchanged, still producing an Edit draft through `createDraft` → `submitEdit`. Artist is already registered in the Edit handler registry (`packages/core/src/domain/edit/registry.ts`), so nothing changes for them.
- The junction writes already have a precedent for skipping the queue: `artist.addAward` and `artist.removeAward` are `editorProcedure` direct writes today and always have been.

The cost is that editors don't get the rich enrichment surface. That is acceptable because the wizard exists for proactive profile building — reaching out to artists and filling in what they send back — which is moderator work.

An earlier draft of this PRD described moderators writing through on `/edit` and editors drafting the *same* wizard. That split exists nowhere on the site (`submitEdit` never auto-approves for any role) and would not have worked anyway, for the single-entity reason above.

### 5.2 Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/artists/new` | moderator | Create artist (flat form, direct write) |
| `/artists/:artistid/edit` | moderator | Stepped enrichment wizard, direct write |
| `/artists/:artistid/edit` | editor | Existing simple form, produces an Edit draft |

### 5.3 Wizard steps (core, sequential)

1. **Identity** — `name`, `title`/honorific, `isGroup` toggle, photo upload (via `Image.getImageUploadUrl('artist', ...)`), primary `instrument`, `city`.
2. **About** — `biography`, `specialisations`, `birthYear`/`birthPlace`, `practiceStartYear`, `debutYear`, `activeYears`.
3. **Relationships** — guru timeline (modal, 5.4a), group membership if `isGroup` (modal, 5.4b), `website` + social links.
4. **Recognition & performances** — awards timeline (modal, 5.4c), notable performances (modal, 5.4d), gallery photos (modal, 5.4e).
5. **Review** — summary of all sections; moderators see "Publish", editors see "Save Draft / Submit for Review".

Each step saves to wizard-local state; nothing persists until Review submit (moderator) or draft save (editor), so a half-filled wizard never writes partial records.

### 5.4 Modal timeline editors

Each modal edits one list, returns to the wizard step, and shows an inline chronological preview (sorted by year) after each add.

**a. Guru timeline modal** — rows of `{id, name, fromYear?, toYear?, discipline?}`. The guru is an artist picker with find-or-create routed through the shared dedup helper (11.2), same requirement as membership, so adding a guru never spawns a duplicate artist. Writes the reshaped `gurus` field.

**b. Group membership modal** (only when `isGroup`) — add/remove members, each an artist picker (find-or-create, dedup-routed). Writes `ArtistMembership` junction rows (4.2) with denormalized names. For an individual, the inverse "performs as" is read-only here (managed from the group side).

**c. Awards timeline modal** — rows of award + `year` + `category?` + `notes?`. Award is a picker over the Award entity (find-or-create award). Writes `ArtistAward` junction rows (existing entity), which already carry `year`, `category`, `rank`. No schema change needed.

**d. Notable performances modal** — links the artist to events; it does **not** create events. Two paths:
   - **Event exists:** search events, select, set the artist's `role`, create the `EventArtist` link. The modal can toggle this link's `isFeatured` (and `featureRank`) to surface the performance in the profile's notable-past teaser. This is per-artist, so featuring it here never affects other performers on the same event.
   - **Event missing:** hand off to the existing create-event pipeline (deep-link to the standard event creation surface, prefilled with the known date/venue and the artist pre-tagged). The event goes through `createEvent` → `submitEvent` → `approveEvent` like any other event, and the `EventArtist` link forms through the normal path. No wizard-specific event creation, no separate moderation branch. **Prefill needs building:** `events.new.tsx` reads only `festivalId`/`festivalName` from the query string today, and `events.new_.verify.tsx` reads `festivalId`/`eventId`/`posterUrl`/`existingFestival`. An `artistId` pre-tag has to be threaded through both.

**e. Gallery modal** — add/remove/reorder photos. Each row uploads via `Image.getImageUploadUrl('artist', ...)`, then writes an `ArtistPhoto` row with optional `caption`/`credit`, an `order`, and a `featured` toggle that controls whether it appears in the profile teaser grid. Drag-to-reorder sets `order`.

### 5.5 Data touchpoints summary

The wizard writes across: `Artist` (core fields, reshaped `gurus`, hero photo), `ArtistMembership` (members), `ArtistAward` (awards), `EventArtist` (performance links plus the per-artist `isFeatured`/`featureRank`), `ArtistPhoto` (gallery). Event *creation* is delegated to the existing event pipeline, not performed by the wizard. `ArtistClaim` and `collaborators` are system-managed, not wizard-edited.

These five entity types are exactly why the wizard is moderator-only and writes directly (5.1): an `Edit` draft can carry one of them, not five.

## 6. Page structure

Section order set by SEO priority: crawlable text and internal links first, interactive/low-content blocks last.

1. **Hero** — photo (or initial-based placeholder), `name`, instrument + city line, verified badge if applicable, honorific/title, social links, website. Primary and OG images derive from `photoUrl` when present.
2. **About** — bio prose (the main crawlable text block), specialisations, active years, birth year/place. This is the highest-value indexable content; it goes high.
3. **Awards** — teaser: top-N `ArtistAward` rows by `rank`. Usually few, so no separate index page; all show inline when the count is small. Links to award pages.
4. **Gurus / lineage** — from the reshaped `gurus` list, each guru linked, shown chronologically with years and discipline where known. Bidirectional where possible ("students" derived is a future item).
5. **Compositions** — teaser: latest few by recency from `getCompositionsByComposer`, with "View all →" to the full index. Internal-link dense, strong SEO value.
6. **Events** — teaser: upcoming first, then notable past (the artist's `EventArtist.isFeatured` rows by `featureRank`), from `getEventsByArtist`, with "View all →" to the full index. Restyle of the existing block plus the featured-past selection.
7. **Gallery** — teaser: small grid of `featured` photos (ordered), with "View all →" to the full gallery. Hidden entirely when the artist has no photos.
8. **Members / Groups** — group-aware, so it renders differently by record type:
   - On a **group** record (`isGroup`): a "Members" block from `getGroupMembers(id)`, each linked to their profile. High-value internal links and the thing that makes Ganesh Kumaresh navigable to Ganesh and Kumaresh.
   - On an **individual** record: a "Performs as" block from `getMemberGroups(id)`, each linked. For a duo-only member (a Saralaya sister) this may be the primary way to reach their performing identity.
   - Both render single-hop off the junction's denormalized names. Placed above collaborators because member/group edges are curated and higher-signal than derived collaborators.
9. **Frequent collaborators** — ranked grid from `artist.collaborators`, each linking to that artist's profile with shared-event count and role context. High internal-link value but low unique text, so mid-low.
10. **Explore more** — keep generic links last.

Empty-state handling: every section hides cleanly when empty rather than rendering a bare header. A profile with only events should not show empty About/Awards/Collaborators/Gallery shells. The Members/Groups block only renders the relevant variant for the record type.

### 6.1 Index subroutes

Full listing pages for the high-volume sections, each teased on the profile and linked via "View all →":

| Route | Backing | Notes |
|-------|---------|-------|
| `/artists/:artistid/events` | `getEventsByArtist` | **Already exists** (`artists.$artistid.events.tsx`, with canonical + breadcrumb). Restyle only. |
| `/artists/:artistid/compositions` | `getCompositionsByComposer` | **Already exists** (`artists.$artistid.compositions.tsx`). Restyle only. |
| `/artists/:artistid/gallery` | `listArtistPhotos` | New. Full photo grid, ordered, paginated. |

Awards have no subroute: they're few and shown inline. Each subroute is crawlable, SSR'd, and carries its own canonical + breadcrumb, extending the internal-link surface (SEO priority 1).

## 7. Structured data (JSON-LD)

Schema type is driven by `isGroup`: emit `MusicGroup` for group records and `Person` (or `MusicGroup` where an individual is a performer identity) for individuals. This maps cleanly to the model:

- Group records use `MusicGroup` with a `member` array pointing at each member's profile URL (`Person`). This is exactly the relationship Google understands for a band-and-its-members knowledge panel.
- Individual records that belong to groups use `memberOf` pointing at the group URL(s) from `getMemberGroups`.

Both need building. `~/components/structured-data.tsx` has a `PersonStructuredData` that emits only `name`, `url`, and a hardcoded `description`/`knowsAbout`/`hasOccupation` — no `image`, `sameAs`, `award` or `memberOf`. There is no `MusicGroup` type at all; the `StructuredData` base `type` union has to gain it.

Common fields:

- `name` from `artist.name` (rendered as stored, per 4.1)
- `image` from `photoUrl`
- `sameAs` array from `socialLinks` + `website`
- `award` from ArtistAward names
- `memberOf` / `knowsAbout` where derivable

Keep `BreadcrumbList` already present. This gives the profile eligibility for richer artist knowledge-panel treatment.

## 8. Verification UX

- **Unclaimed profile:** a subtle "Are you this artist? Claim this profile" affordance for logged-in users.
- **Claim action:** collects name + contact email, calls `createArtistClaim` (status `pending`), flips `artist.claimStatus` to `pending` if currently unclaimed. Independent per record, so claiming a member never claims the group.
- **Pending:** claimant sees "claim pending"; public sees no change.
- **Verified:** public verified badge (rendered off denormalized `claimStatus`/`verifiedAt`, no extra query); hero optionally shows "Profile managed by the artist."
- **Dedicated moderator queue:** a claims-only surface fed by `getPendingClaims`, separate from the Edit/Event moderation queues so responsibilities don't intermix. Approve/reject with note; reject recomputes `claimStatus` back to `unclaimed` when no verified claim remains. Structured to allow a distinct `claim-moderator` permission later without touching content moderation.
- **Proof is out-of-band and rests on moderator judgement.** There is no automated check to build. The claim captures a note and a contact email; the moderator establishes identity however fits the case — a DM from the artist's known handle, a reply from an official address, a phone call — and records the reasoning in `moderatorNote` before approving. That field is the audit trail, so treat it as required on approve, not just on reject.

## 9. Rollout phases

**Phase 0a — auth fix (ships on its own, first).** `artist.create`, `artist.update` and `artist.delete` are `protectedProcedure`, so any logged-in Google user can create, edit or **hard-delete** any artist record. Venue and organiser use `editorProcedure`. Tighten all three to `editorProcedure` and point `delete` at `softDeleteArtist` rather than `deleteArtist`. Unrelated to the redesign, small, and not worth holding behind it.

**Phase 0b — foundations hardening.** Everything downstream adds entities that reference artists, so the referencing machinery gets sound first:

- **Shared dedup helper.** One find-or-create for artists doing honorific stripping and initial-vs-full-name matching, returning an existing record above a threshold and creating only on no match. Replaces the blind create in `resolveArtist` (`packages/trpc/src/routers/event.ts`) and backs every wizard picker. `reconcile.ts`'s `fuzzyGroupUnlinked` is a reference for the similarity scoring, not reusable as-is.
- **Close the existing `mergeArtist` gaps.** `cascadeArtistMerge` rewrites `EventArtist` and `Composition` composer rows only. Add `ArtistAward` rows and `gurus[]` entries on other artists — both already dangle on every merge today, before this PRD adds anything.
- **Artist-rename name-copy cascade.** `updateArtist` cascades to `composer.name` alone. Extend it to `EventArtist.artistName` and `ArtistAward.artistName`.
- A test per reference type, per 11.3.

**Phase 0c — name display fix (4.1).** Drop `fromItrans` from the artist read paths. One change, fixes every artist on the site, no schema change and no backfill. Everything after this assumes names render correctly.

1. **Data model** — add Artist attributes (`isGroup`, `claimStatus`, `verifiedAt`, `photoUrl`/`photoUploadId`, `instrument`, `city`, `practiceStartYear`, `debutYear`), `EventArtist` `isFeatured`/`featureRank`, `Image` `'artist'` support through all four touchpoints (4.1), `artist.getImageUploadUrl`. **Guru reshape (4.6):** widen the `gurus` element schema in place (superset, no data backfill), update readers to render years/discipline when present. **Admin CSV (4.6.1):** new columns and the guru JSON-cell encoding land here too, or the export silently drops the new fields.
2. **Group membership** — `ArtistMembership` junction (entity + router), add/remove membership, `getGroupMembers`/`getMemberGroups`, member find-or-create routed through fuzzy dedup, `mergeArtist` fixups for membership rows and collaborator edges.
3. **Gallery entity** — `ArtistPhoto` entity + router (`add`/`update`/`delete`/`listArtistPhotos`), `byArtist` GSI, `mergeArtist` photo reassignment.
4. **Collaborator engine** — `rebuildArtistCollaborators`, hook into `approveEvent` (inline + cap), fold into `mergeArtist` and event soft-delete. Ends with the `rebuild-collaborators` backfill sweep (4.5.1), without which the feature ships empty.
5. **Create/edit wizard** — flat `/artists/new` (moderator, direct write) + stepped `/artists/:id/edit` for moderators, editors keeping today's form and its draft (5.1). Timeline modals (guru, membership, awards, performances, gallery), a live artist-search endpoint for the pickers (11.1), artist prefill threaded into the event creation routes, `isFeatured` toggle. Depends on phases 0b and 1-3.
6. **Presentation** — new profile layout with teasers, all sections incl. group-aware Members/Groups block, gallery teaser grid, empty-state handling, group-aware JSON-LD (build out `PersonStructuredData`, add `MusicGroup`). **Index subroutes:** `/artists/:id/gallery` is new; `/artists/:id/events` and `/artists/:id/compositions` already exist and get restyled.
7. **Photo enrichment** — hero photo in wizard Identity step; gallery photos via gallery modal.
8. **Claim & verification** — `ArtistClaim` entity + router, claim UI (per-record, independent for group vs member), dedicated claims-only moderator queue via `getPendingClaims`, `mergeArtist` claim fixup.
9. **Polish** — instrument/city enrichment, restyle events block, ship.

## 10. Open items / dependencies

- **Name display is resolved, and there is no pipeline to fix.** Artist names are stored correctly; the corruption happens at render time. Phase 0c removes the `fromItrans` call from the artist read paths and the problem is gone site-wide, with no new field and no backfill. `displayName` is dropped from this PRD entirely — shielding the H1 bug was its only stated purpose.
- "Students" (inverse of gurus) is explicitly deferred. A first-class Ensemble entity is explicitly rejected: groups are Artist records with `isGroup`, and membership is the `ArtistMembership` junction, per this revision.
- **Membership drift is resolved** by using a junction rather than denormalized dual-lists; only display-name copies are duplicated, refreshed by the cascade phase 0b extends.
- **Member find-or-create is a duplicate-artist vector.** Adding a member auto-creates a thin Artist record if none matches. The shared dedup helper it must route through **does not exist yet**; phase 0b builds it, and no picker ships before then.
- **Artist write auth is currently open** (phase 0a). `artist.create`/`update`/`delete` accept any logged-in user, and `delete` is a hard delete. Fixed first, separately.
- **Guru field reshaped in place (4.6).** `gurus` keeps its name; the element widens to `{id, name, fromYear?, toYear?, discipline?}`. Because the new keys are optional, the shape is a superset and existing data stays valid with no backfill; only the schema and writers/readers update. No parallel field, no deprecation.
- **Missing events are created through the existing event pipeline**, not inside the wizard. The performances modal only links (`EventArtist`) or hands off to `/events` creation with the artist pre-tagged. This removes the earlier separate-approval-unit complexity entirely.
- Async collaborator recompute for large events is deferred behind the inline cap. The `rebuild-collaborators` sweep (4.5.1) covers the gap in the meantime: events over the cap are skipped inline and picked up on the next run.
- **Collaborators launch empty without the backfill sweep** (4.5.1), since the trigger only fires on new approvals. The sweep is part of phase 4, not a follow-up.
- **Claims queue resolved:** dedicated `ArtistClaim` entity with a `byStatus` GSI feeding a claims-only moderator surface, kept separate from Edit/Event moderation so responsibilities don't intermix. Any `moderator` can action claims for now; the separation leaves room for a distinct `claim-moderator` permission later.

## 11. Implementation notes (for Claude Code)

This appendix resolves the decisions an implementer would otherwise guess at, and states the standing conventions this codebase enforces. Defaults below are chosen; override in the spec if a decision should differ.

### 11.1 Resolved decisions

**Role vocabulary.** `EventArtist.role` stays free-text (existing data stays valid). Add a `canonicalRole(raw: string): string` helper in core that maps free-text to a canonical key (e.g. `Vocal`, `vocals`, `vocalist` → `vocal`; `mrudangam`, `Mridangam` → `mridangam`). `topRoles` and any role grouping key off the canonical value, never the raw string. The raw string is still displayed; the canonical value is only for aggregation/grouping. Start with a small mapping table covering the common Carnatic roles (vocal, violin, mridangam, ghatam, kanjira, morsing, flute, veena, tambura, nagaswaram, dance/bharatanatyam) plus a passthrough default that lowercases and trims unknowns.

**Artist/entity picker search source.** The wizard's find-or-create pickers (guru, member, award, performance) search the **live** path (`getArtistByName` / the `byName` GSI, exact + prefix), **not** the Fuse.js S3 index. Reason: an entity created in one modal must be findable in the next modal seconds later, and the S3 index is refresh-lagged. The picker's search-as-you-type is separate from the create-time dedup check (11.2); the picker helps a human find an existing record, dedup guards against creating a duplicate when they proceed to create.

This means a **new endpoint**. The existing picker (`~/components/SearchSelect.tsx`, already reusable with its `createNew` callback) points at `/api/search/artist`, which is the Fuse index. `getArtistByName` exists in core but is exposed through no tRPC procedure or route, so the live search route has to be added and `SearchSelect` pointed at it.

**`isGroup` is a moderator-only flip, not immutable.** Duo records like Ganesh Kumaresh and Saralaya Sisters already exist as ordinary artist rows scraped from posters, so an immutable flag would mean no existing record could ever become a group — a rule that blocks the main use case. A moderator can toggle `isGroup` at any time. Flipping a group back to an individual while `ArtistMembership` rows exist strands them; that is rare, repairable by hand, and cheaper than the alternative. Gate the field on `moderatorProcedure`, not on record state.

**`instrument` and `city` are free text, normalised later.** Neither gets an enum now. When drift starts to bite — vocal/Vocal/vocals, Chennai/chennai/Madras — add a `canonicalInstrument` mapping helper beside `canonicalRole` and key any grouping or faceting off the canonical value while still displaying the raw string. Same treatment `EventArtist.role` already gets, for the same reason: the raw values arrive from posters and scrapes, so a closed set would reject real data rather than clean it. This also keeps both fields as ordinary `str()` columns in the admin CSV, with no `flags()` machinery.

**Collaborator inline cap is a named constant.** `COLLABORATOR_INLINE_CAP = 12` (a single exported config constant, not a literal). `approveEvent` recomputes collaborators inline when `event.artists.length <= COLLABORATOR_INLINE_CAP`, otherwise enqueues (async path deferred; for now, skip + log so a large event doesn't block approval). The future async worker keys off the same constant.

### 11.2 Standing conventions (enforce throughout)

- **Never import `@rasika/core` bare in web route files.** Use subpath / `/client` imports (`@rasika/core/domain/<name>/client`, `@rasika/core/auth`, etc.). The bare entry pulls in ElectroDB + AWS SDK and crashes the browser bundle. `*.server.ts` files are the only exception. New browser-safe utilities get a dedicated subpath export in `packages/core/package.json`.
- **Artist names render as stored.** Never pass an artist name through `fromItrans`. Person names are romanised Latin and decoding them corrupts them (4.1). Raga names, tala names, composition titles and lyrics keep their transliteration — the rule is per field, not per page.
- **Find-or-create always routes through one shared dedup helper.** The guru, member, and award pickers must not each roll their own create path. One helper performs honorific stripping and initial-vs-full-name matching, returns an existing entity if matched above threshold, and only creates when no match. This is the single most important guard against compounding the existing duplicate-artist problem. Built in phase 0b.
- **Denormalized name copies are refreshed by one sweep.** `ArtistMembership.groupName/memberName`, `EventArtist.artistName/eventTitle`, `ArtistAward.artistName/awardName`, and `collaborators[].name` are all denormalized. A rename of the source entity updates these through the cascade in `packages/core/src/domain/cascade.ts`; do not add a second mechanism. Phase 0b extends that cascade to cover `EventArtist.artistName` and `ArtistAward.artistName`, which it does not reach today.
- **New domains follow the established layout.** `packages/core/src/domain/<name>/` with `entity.ts` → `schema.ts` → `client.ts` → `index.ts`, collocated `*.test.ts`, then a tRPC router in `packages/trpc/src/routers/<name>.ts` registered in the router index. Auth-gated mutations use `editorProcedure`/`moderator` procedures as the existing routers do.

### 11.3 `mergeArtist` is the highest-risk surface — test it explicitly

`mergeArtist(loserId, canonicalId)` must rewrite every entity that references an artist. Each of these needs its own test. Only the two marked *done* are handled by `cascadeArtistMerge` today:

- `EventArtist` rows (both primary and `byArtist` GSI direction) — *done*; extend to preserve `isFeatured`/`featureRank`
- `composerId` / `composer` on `Composition` (loser was a composer) — *done*
- `ArtistAward` rows — **gap today**, fix in phase 0b
- `gurus[]` entries on other artists pointing at the loser — **gap today**, fix in phase 0b
- `ArtistMembership` rows in **both** roles: loser-as-group and loser-as-member, incl. name copies
- `ArtistClaim` rows (dedupe if canonical already has a claim by the same user)
- `ArtistPhoto` rows reassigned
- `collaborators[]` on other artists that referenced the loser, plus the canonical's own list rebuilt via `rebuildArtistCollaborators`

The last four arrive with their entities. The two gaps predate this PRD and already corrupt data on every merge, which is why phase 0b closes them before anything new starts referencing artists. Treat this as its own hardening task with a test per reference type, not an afterthought folded into other phases.

### 11.4 Explicitly out of scope (do not build)

- Students (inverse-of-gurus) derived section
- First-class Ensemble entity (groups are `isGroup` Artist records)
- Async collaborator recompute worker (inline + cap only for now)
- `claim-moderator` distinct permission (any moderator actions claims for now)
- Multi-entity Edit drafts. The `Edit` row stays single-entity; the wizard sidesteps it by being moderator-only and writing directly (5.1). Revisit only if editors need the wizard.
- Wizard publish atomicity. Writes go per entity with no transaction, so a failure part-way leaves a partial profile. Acceptable while the wizard is moderator-only and the operator can see what landed and retry. Still the honest open question if all-or-nothing publish is ever wanted.
- An enum for `instrument` or `city` (free text plus a later `canonicalInstrument` helper, 11.1)

### 11.5 Suggested build order

Follow the rollout phases (section 9), starting with 0a, 0b and 0c. Phase 0a is independent and can ship in an hour. Phase 0c is a handful of deleted calls and fixes the most visible defect on the site, so it is the best value per hour in the whole plan.

Within the numbered phases, three things must land before the wizard (phase 5) is meaningful: the reshaped `gurus` schema (4.6), the `ArtistMembership` junction (4.2), and the shared dedup helper from phase 0b. The `canonicalRole` helper (11.1) is needed before collaborator `topRoles` is trustworthy but not before the wizard ships.

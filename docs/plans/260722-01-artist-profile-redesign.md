# Artist Profile Redesign PRD

Spec ID: `260722-01-artist-profile-redesign`
Status: draft
Reference page: https://rasika.life/artists/yagnika-iyengar-3DffDH8XBOZhLi9zbauBhDD4nOK

## 1. Problem

Artist profiles are the weakest high-intent page on the site. The reference page renders a name, a role string, a two-field About block, an events list, and generic explore links. Nothing conveys who the artist is, who they perform with, or why they matter. Three concrete failures:

- **No credibility surface.** No photo, no bio, no lineage, no awards, no compositions. A rasika landing here learns nothing.
- **No relationship graph.** The artist performs with a recurring ensemble ("Trayag Natyalaya Ensemble") but that is a dead role string, not a link to co-performers.
- **Transliteration bug live in the H1.** The page renders `ẏagnika īyengar` instead of the intended English form. This is the known pipeline defect mangling Latin-script names, and it poisons the title tag, OG tags, and H1 on the single most shareable artist surface.

## 2. Goal

Make the artist profile the "LinkedIn of Carnatic artists": a page that establishes the artist, surfaces their frequent collaborators, and links outward into the knowledge graph. Priorities, in order:

1. **SEO / discovery** — crawlable text, internal links, structured data, clean titles.
2. **Visual polish / credibility** — photo, bio, lineage, awards presented well.
3. **Relationship graph** — derived collaborators, gurus, ensemble co-performers.

## 3. Scope

In scope: full presentation redesign, derived-collaborator computation and storage, artist photo enrichment (hero + `ArtistPhoto` gallery), artist self-claim + moderator verification (states, UI, and mechanism), group modeling via `ArtistMembership`, a moderator-facing create/edit wizard for rich profile enrichment (career timeline, guru timeline, awards, notable-performance linking, gallery), and index subroutes for events, compositions, and gallery.

Out of scope: a first-class Ensemble entity (collaborators are derived from shared events, not modeled). Fixing the transliteration pipeline itself is a hard dependency but tracked separately; this PRD only requires that the display name renders correctly (see 4.1).

## 4. Data model changes

### 4.1 Artist entity additions

Add to the `artist` entity:

| Attribute | Type | Notes |
|-----------|------|-------|
| `photoUrl` | string | CDN URL of artist photo |
| `photoUploadId` | string | S3 presigned-upload session ID |
| `displayName` | string | Clean human-facing name, bypasses transliteration mangling. Falls back to `name` if unset. |
| `instrument` | string | Primary instrument / discipline (vocal, violin, mridangam, bharatanatyam, etc.) |
| `city` | string | Current base city, denormalized for a future `byCity` GSI |
| `practiceStartYear` | number | Year the artist began formal practice / training |
| `debutYear` | number | Year of first public/arangetram performance (optional, distinct from practice start) |
| `gurus` | list\<map\> | **Reshaped in place** from `{id, name}[]` to `{id, name, fromYear?, toYear?, discipline?}[]`. Same field name, richer element. See 4.6 for migration. |
| `collaborators` | list\<map\> | Denormalized derived collaborators (see 4.4). `{artistId, name, sharedEventCount, lastSharedAt, topRoles: string[], strength}[]` |
| `collaboratorsComputedAt` | string | ISO timestamp of last recompute |
| `isGroup` | boolean | True if this record is a performing group/duo (Saralaya Sisters, Ganesh Kumaresh) rather than an individual. Membership edges live in the `ArtistMembership` junction (4.2), not on this record. |
| `claimStatus` | string | Denormalized badge state: `unclaimed` \| `pending` \| `verified` \| `rejected`. Authoritative claim data lives in the `ArtistClaim` entity (4.3); this copy exists only so the profile renders the badge without a second query. |
| `verifiedAt` | string | ISO timestamp set when a claim is verified. Denormalized for badge display. |

`displayName` is the pragmatic fix for the H1/title bug without waiting on the pipeline: the redesign reads `displayName ?? name` everywhere user-facing. Backfill can be a script pass over existing artists; new claims set it directly.

Photo upload reuses the existing `Image` namespace pattern already used by venue/organiser:

```typescript
Image.getImageUploadUrl('artist', fileName, contentType)
// key pattern: images/artist/{uploadId}/{fileName}
```

Add `'artist'` to the accepted `entityType` union in the Image wrapper, and expose `artist.getImageUploadUrl` (editorProcedure) on the artist router.

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

- **Members always exist as their own Artist records**, even when thin. Adding a member is a find-or-create over member names, which **must route through the existing fuzzy-dedup path** (ITRANS normalization, honorific stripping, initial-vs-full-name matching) rather than blind create. On a site with live transliteration/dedup issues, an auto-create path that skips dedup is a duplicate-artist factory.
- **No drift, no paired write.** Because the edge is a single junction row, there is no `members[]`/`belongsToGroups[]` pair to keep in sync and no reconciler needed. Stale display names (after a rename) are cosmetic and refreshed by the same name-copy sweep that already maintains `EventArtist`/`ArtistAward`.
- **Events and collaborators treat the group as a normal artist.** The group's events are events where the *group* is the listed `EventArtist`; its collaborators derive from those events exactly like any individual. Members' solo events stay on the member records. Group events do **not** fan out onto member event lists (a member's page shows their solo work; the group link is how you reach the group's events). Whether a listing credits the group or the individual members is a data-entry choice at event creation, not something the model auto-merges.
- **`mergeArtist` rewrites junction rows.** Merging an artist that is a group or a member rewrites the `ArtistMembership` rows referencing the loser (both the primary and GSI direction fall out of rewriting `groupId`/`memberId` and their name copies), folded into the same merge sweep that already fixes `EventArtist` and `ArtistAward`. Collaborator-edge fixups (4.4), `ArtistClaim` rows (4.3), and `ArtistPhoto` rows (4.7) happen in the same pass.

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

### 4.6 Guru field reshape (in place)

`gurus` keeps its name; only its element shape widens from `{id, name}` to `{id, name, fromYear?, toYear?, discipline?}`. The three new keys are optional, so the new shape is a **superset** of the old: every existing `{id, name}` row is already valid under the widened schema. This makes the migration cheap.

1. Widen the Zod/ElectroDB schema for `gurus` to accept the optional `fromYear`/`toYear`/`discipline` keys.
2. No data backfill required. Existing rows validate as-is (the new keys are simply absent). An optional cosmetic pass could normalize nothing, so skip it.
3. Update read paths (profile, JSON-LD, wizard) to render years/discipline when present and degrade gracefully when absent.

The reason this is labelled breaking is the *element contract* changes for any code that constructs guru entries by positional/shape assumption; writers must go through the widened schema. But because it is a superset, there is no window where existing data is invalid, and no parallel field to deprecate.

`fromYear`/`toYear` are optional so an unenriched entry stays valid and the wizard can add years later. Display sorts by `fromYear` when present, falling back to insertion order.

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

Purpose: give moderators a single rich surface to build out profiles proactively (reaching out to artists, filling in as much as possible), covering identity, career timeline, relationships, awards, and notable performances. Structure follows your existing venue/organiser wizard convention (stepped core wizard) plus **modal editors** for each repeatable timeline so the main flow stays short.

### 5.1 Moderation interaction

Mirrors the decision already made elsewhere on the site:

- **Moderators write directly** (no draft), same as venue/organiser `/new` and `/edit`. `createArtist` / `updateArtist` called straight through.
- **Editors produce an Edit draft** (`createDraft` → `submitEdit`) that lands in the standard content-moderation queue, unchanged.
- The wizard UI is identical for both; only the submit action differs by role, which is already known from the session (`ctx.user.role`).

### 5.2 Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/artists/new` | moderator | Create artist (direct write) |
| `/artists/:artistid/edit` | editor+ | Edit wizard; editors draft, moderators write through |

### 5.3 Wizard steps (core, sequential)

1. **Identity** — `name`, `displayName`, `title`/honorific, `isGroup` toggle, photo upload (via `Image.getImageUploadUrl('artist', ...)`), primary `instrument`, `city`.
2. **About** — `biography`, `specialisations`, `birthYear`/`birthPlace`, `practiceStartYear`, `debutYear`, `activeYears`.
3. **Relationships** — guru timeline (modal, 5.4a), group membership if `isGroup` (modal, 5.4b), `website` + social links.
4. **Recognition & performances** — awards timeline (modal, 5.4c), notable performances (modal, 5.4d), gallery photos (modal, 5.4e).
5. **Review** — summary of all sections; moderators see "Publish", editors see "Save Draft / Submit for Review".

Each step saves to wizard-local state; nothing persists until Review submit (moderator) or draft save (editor), so a half-filled wizard never writes partial records.

### 5.4 Modal timeline editors

Each modal edits one list, returns to the wizard step, and shows an inline chronological preview (sorted by year) after each add.

**a. Guru timeline modal** — rows of `{id, name, fromYear?, toYear?, discipline?}`. The guru is an artist picker with find-or-create routed through the fuzzy-dedup path (ITRANS/honorific/initial matching), same requirement as membership, so adding a guru never spawns a duplicate artist. Writes the reshaped `gurus` field.

**b. Group membership modal** (only when `isGroup`) — add/remove members, each an artist picker (find-or-create, dedup-routed). Writes `ArtistMembership` junction rows (4.2) with denormalized names. For an individual, the inverse "performs as" is read-only here (managed from the group side).

**c. Awards timeline modal** — rows of award + `year` + `category?` + `notes?`. Award is a picker over the Award entity (find-or-create award). Writes `ArtistAward` junction rows (existing entity), which already carry `year`, `category`, `rank`. No schema change needed.

**d. Notable performances modal** — links the artist to events; it does **not** create events. Two paths:
   - **Event exists:** search events, select, set the artist's `role`, create the `EventArtist` link. The modal can toggle this link's `isFeatured` (and `featureRank`) to surface the performance in the profile's notable-past teaser. This is per-artist, so featuring it here never affects other performers on the same event.
   - **Event missing:** hand off to the existing create-event pipeline (deep-link to the standard event creation surface, prefilled with the known date/venue and the artist pre-tagged). The event goes through `createEvent` → `submitEvent` → `approveEvent` like any other event, and the `EventArtist` link forms through the normal path. No wizard-specific event creation, no separate moderation branch.

**e. Gallery modal** — add/remove/reorder photos. Each row uploads via `Image.getImageUploadUrl('artist', ...)`, then writes an `ArtistPhoto` row with optional `caption`/`credit`, an `order`, and a `featured` toggle that controls whether it appears in the profile teaser grid. Drag-to-reorder sets `order`.

### 5.5 Data touchpoints summary

The wizard writes across: `Artist` (core fields, reshaped `gurus`, hero photo), `ArtistMembership` (members), `ArtistAward` (awards), `EventArtist` (performance links plus the per-artist `isFeatured`/`featureRank`), `ArtistPhoto` (gallery). Event *creation* is delegated to the existing event pipeline, not performed by the wizard. `ArtistClaim` and `collaborators` are system-managed, not wizard-edited.

## 6. Page structure

Section order set by SEO priority: crawlable text and internal links first, interactive/low-content blocks last.

1. **Hero** — photo (or initial-based placeholder), `displayName`, instrument + city line, verified badge if applicable, honorific/title, social links, website. Primary and OG images derive from `photoUrl` when present.
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
| `/artists/:artistid/events` | `getEventsByArtist` | All events the artist is tagged to (via `EventArtist` GSI), upcoming then past, paginated. Already the target of the existing "View all events →" link. |
| `/artists/:artistid/compositions` | `getCompositionsByComposer` | All compositions for composer-artists, paginated. |
| `/artists/:artistid/gallery` | `listArtistPhotos` | Full photo grid, ordered, paginated. |

Awards have no subroute: they're few and shown inline. Each subroute is crawlable, SSR'd, and carries its own canonical + breadcrumb, extending the internal-link surface (SEO priority 1).

## 7. Structured data (JSON-LD)

Schema type is driven by `isGroup`: emit `MusicGroup` for group records and `Person` (or `MusicGroup` where an individual is a performer identity) for individuals. This maps cleanly to the model:

- Group records use `MusicGroup` with a `member` array pointing at each member's profile URL (`Person`). This is exactly the relationship Google understands for a band-and-its-members knowledge panel.
- Individual records that belong to groups use `memberOf` pointing at the group URL(s) from `getMemberGroups`.

Common fields:

- `name` from `displayName`
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

## 9. Rollout phases

1. **Data model** — add Artist attributes (`isGroup`, `claimStatus`, `verifiedAt`, `displayName`, `photoUrl`/`photoUploadId`, `instrument`, `city`, `practiceStartYear`, `debutYear`), `EventArtist` `isFeatured`/`featureRank`, `Image` `'artist'` support, `artist.getImageUploadUrl`, `displayName` backfill script. **Guru reshape (4.6):** widen the `gurus` element schema in place (superset, no data backfill), update readers to render years/discipline when present.
2. **Group membership** — `ArtistMembership` junction (entity + router), add/remove membership, `getGroupMembers`/`getMemberGroups`, member find-or-create routed through fuzzy dedup, `mergeArtist` fixups for membership rows and collaborator edges.
3. **Gallery entity** — `ArtistPhoto` entity + router (`add`/`update`/`delete`/`listArtistPhotos`), `byArtist` GSI, `mergeArtist` photo reassignment.
4. **Collaborator engine** — `rebuildArtistCollaborators`, hook into `approveEvent` (inline + cap), fold into `mergeArtist` and event soft-delete.
5. **Create/edit wizard** — stepped core wizard + timeline modals (guru, membership, awards, performances, gallery), moderator direct-write vs editor Edit-draft split, performance linking that delegates missing-event creation to the existing event pipeline, `isFeatured` toggle, `/artists/new` + `/artists/:id/edit`. Depends on phases 1-3.
6. **Presentation** — new profile layout with teasers, all sections incl. group-aware Members/Groups block, gallery teaser grid, empty-state handling, `displayName ?? name` everywhere, group-aware JSON-LD. **Index subroutes:** `/artists/:id/events`, `/artists/:id/compositions`, `/artists/:id/gallery` (SSR, canonical, breadcrumb, paginated).
7. **Photo enrichment** — hero photo in wizard Identity step; gallery photos via gallery modal.
8. **Claim & verification** — `ArtistClaim` entity + router, claim UI (per-record, independent for group vs member), dedicated claims-only moderator queue via `getPendingClaims`, `mergeArtist` claim fixup.
9. **Polish** — instrument/city enrichment, restyle events block, ship.

## 10. Open items / dependencies

- Transliteration pipeline fix is upstream of `displayName` correctness for un-backfilled artists; `displayName` is the interim shield, not a fix for the pipeline.
- "Students" (inverse of gurus) is explicitly deferred. A first-class Ensemble entity is explicitly rejected: groups are Artist records with `isGroup`, and membership is the `ArtistMembership` junction, per this revision.
- **Membership drift is resolved** by using a junction rather than denormalized dual-lists; only display-name copies are duplicated, refreshed by the same sweep that maintains `EventArtist`/`ArtistAward` names.
- **Member find-or-create is a duplicate-artist vector.** Adding a member auto-creates a thin Artist record if none matches; this must route through the same ITRANS/honorific/initial fuzzy matching used elsewhere, or it multiplies the existing duplicate-artist problem.
- **Guru field reshaped in place (4.6).** `gurus` keeps its name; the element widens to `{id, name, fromYear?, toYear?, discipline?}`. Because the new keys are optional, the shape is a superset and existing data stays valid with no backfill; only the schema and writers/readers update. No parallel field, no deprecation.
- **Missing events are created through the existing event pipeline**, not inside the wizard. The performances modal only links (`EventArtist`) or hands off to `/events` creation with the artist pre-tagged. This removes the earlier separate-approval-unit complexity entirely.
- Async collaborator recompute for large events is deferred behind the inline cap.
- **Claims queue resolved:** dedicated `ArtistClaim` entity with a `byStatus` GSI feeding a claims-only moderator surface, kept separate from Edit/Event moderation so responsibilities don't intermix. Any `moderator` can action claims for now; the separation leaves room for a distinct `claim-moderator` permission later.

## 11. Implementation notes (for Claude Code)

This appendix resolves the decisions an implementer would otherwise guess at, and states the standing conventions this codebase enforces. Defaults below are chosen; override in the spec if a decision should differ.

### 11.1 Resolved decisions

**Role vocabulary.** `EventArtist.role` stays free-text (existing data stays valid). Add a `canonicalRole(raw: string): string` helper in core that maps free-text to a canonical key (e.g. `Vocal`, `vocals`, `vocalist` → `vocal`; `mrudangam`, `Mridangam` → `mridangam`). `topRoles` and any role grouping key off the canonical value, never the raw string. The raw string is still displayed; the canonical value is only for aggregation/grouping. Start with a small mapping table covering the common Carnatic roles (vocal, violin, mridangam, ghatam, kanjira, morsing, flute, veena, tambura, nagaswaram, dance/bharatanatyam) plus a passthrough default that lowercases and trims unknowns.

**Artist/entity picker search source.** The wizard's find-or-create pickers (guru, member, award, performance) search the **live** path (`getArtistByName` / the `byName` GSI, exact + prefix), **not** the Fuse.js S3 index. Reason: an entity created in one modal must be findable in the next modal seconds later, and the S3 index is refresh-lagged. The picker's search-as-you-type is separate from the create-time fuzzy dedup check (11.2); the picker helps a human find an existing record, dedup guards against creating a duplicate when they proceed to create.

**`isGroup` is immutable after creation.** A record cannot flip individual↔group post-creation; flipping it would strand `ArtistMembership` rows in a shape the read paths don't expect. A mis-created record is fixed by `mergeArtist` into a correctly-typed record (already supported), not by mutating `isGroup`. Enforce in the update schema/handler.

**Collaborator inline cap is a named constant.** `COLLABORATOR_INLINE_CAP = 12` (a single exported config constant, not a literal). `approveEvent` recomputes collaborators inline when `event.artists.length <= COLLABORATOR_INLINE_CAP`, otherwise enqueues (async path deferred; for now, skip + log so a large event doesn't block approval). The future async worker keys off the same constant.

### 11.2 Standing conventions (enforce throughout)

- **Never import `@rasika/core` bare in web route files.** Use subpath / `/client` imports (`@rasika/core/domain/<name>/client`, `@rasika/core/auth`, etc.). The bare entry pulls in ElectroDB + AWS SDK and crashes the browser bundle. `*.server.ts` files are the only exception. New browser-safe utilities get a dedicated subpath export in `packages/core/package.json`.
- **`displayName ?? name` is a global read convention.** Every user-facing render of an artist name (profile, JSON-LD, breadcrumbs, pickers, teasers, collaborator grid, membership lists, OG/meta) uses `displayName ?? name`. Never render raw `name` directly in user-facing surfaces.
- **Find-or-create always routes through one shared dedup helper.** The guru, member, and award pickers must not each roll their own create path. One helper performs ITRANS normalization, honorific stripping, and initial-vs-full-name matching, returns an existing entity if matched above threshold, and only creates when no match. This is the single most important guard against compounding the existing duplicate-artist problem.
- **Denormalized name copies are refreshed by one sweep.** `ArtistMembership.groupName/memberName`, `EventArtist.artistName/eventTitle`, `ArtistAward.artistName/awardName`, and `collaborators[].name` are all denormalized. A rename of the source entity updates these via the existing name-copy maintenance path; do not add a second mechanism.
- **New domains follow the established layout.** `packages/core/src/domain/<name>/` with `entity.ts` → `schema.ts` → `client.ts` → `index.ts`, collocated `*.test.ts`, then a tRPC router in `packages/trpc/src/routers/<name>.ts` registered in the router index. Auth-gated mutations use `editorProcedure`/`moderator` procedures as the existing routers do.

### 11.3 `mergeArtist` is the highest-risk surface — test it explicitly

`mergeArtist(loserId, canonicalId)` must rewrite every entity that references an artist. Each of these needs its own test:

- `EventArtist` rows (both primary and `byArtist` GSI direction), incl. `isFeatured`/`featureRank` preserved
- `ArtistAward` rows
- `ArtistMembership` rows in **both** roles: loser-as-group and loser-as-member, incl. name copies
- `ArtistClaim` rows (dedupe if canonical already has a claim by the same user)
- `ArtistPhoto` rows reassigned
- `collaborators[]` on other artists that referenced the loser, plus the canonical's own list rebuilt via `rebuildArtistCollaborators`
- `composerId` / `composer` on `Composition` (loser was a composer)
- `gurus[]` entries on other artists pointing at the loser

Given the existing merge-related data issues on the site, treat this as its own hardening task with a test per reference type, not an afterthought folded into other phases.

### 11.4 Explicitly out of scope (do not build)

- Students (inverse-of-gurus) derived section
- First-class Ensemble entity (groups are `isGroup` Artist records)
- Async collaborator recompute worker (inline + cap only for now)
- `claim-moderator` distinct permission (any moderator actions claims for now)
- Wizard publish atomicity (per-entity writes; not a single transaction) — flagged as a genuine open design question if all-or-nothing publish is later wanted

### 11.5 Suggested build order

Follow the rollout phases (section 9). Within that, three things must land before the wizard (phase 5) is meaningful: the reshaped `gurus` schema (4.6), the `ArtistMembership` junction (4.2), and the shared dedup helper (11.2). The `canonicalRole` helper (11.1) is needed before collaborator `topRoles` is trustworthy but not before the wizard ships.

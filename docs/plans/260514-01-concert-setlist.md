# Concert Setlist Implementation Plan

**Date**: 2026-05-14
**Status**: Proposed
**Builds on**: ConcertLog entity (already implemented)

## Goals

Extend the existing personal ConcertLog with a public, crowd-reconciled setlist layer. Each concert log can capture an ordered list of compositions performed, with per-item annotations. Aggregating across rasikas produces a canonical public setlist per event. The data feeds composition, raga, artist, and venue pages, deepening the knowledge graph and creating SEO-rich crosslinks.

## Non-goals (v1)

- Voting or featured notes on setlist items
- Artist self-verification of canonical setlists
- Public diary / social feed of friends' attendance
- Setlist comparison or sharing UX
- Per-item audio, video, or photo attachments
- Per-item multi-artist crediting (who played the tani specifically)
- Real-time/live setlist entry during the concert
- Setlist completion gamification or stats dashboards

## Architecture summary

```
User submits setlist via entry view
    │
    ├─ Concert-level notes ────────────────→ ConcertLog.notes (private)
    │
    ├─ Linked setlist items ───────────────→ ConcertLogItem (linked)
    │                                            │
    │                                            └─→ Reconciliation worker
    │                                                    │
    │                                                    └─→ EventSetlist (public)
    │
    ├─ Free-text setlist items ────────────→ ConcertLogItem (unlinked)
    │                                            │
    │                                            └─→ Moderation queue
    │
    └─ Public per-item notes ──────────────→ ConcertLogItem.publicNote
                                                 │
                                                 └─→ Surfaced under EventSetlist item
```

---

## Phase 1: Schema & Core Logic

### 1.1 ConcertLogItem entity

New ElectroDB entity at `packages/core/src/domain/concert-log-item/`.

**Attributes**

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | yes | PK part |
| `eventId` | string | yes | PK part |
| `order` | number | yes | SK part. 0-indexed. Zero-padded as `0001` in key for lexicographic sort |
| `compositionId` | string | no | Linked composition (null = free-text awaiting moderation) |
| `compositionTitle` | string | yes | User-entered title (denormalized if linked, original text if not) |
| `ragaId` | string | no | Performance-specific raga ID (defaults to composition canonical) |
| `ragaName` | string | no | Denormalized raga name |
| `talaId` | string | no | Performance-specific tala ID |
| `talaName` | string | no | Denormalized tala name |
| `compositionType` | string | no | Enum: `varnam`, `kriti`, `rtp`, `thillana`, `javali`, `padam`, `viruttam`, `thukkada`, `slokam`, `tani`, `other` |
| `publicNote` | string (max 500) | no | Public annotation, e.g. "alapana 15min", "neraval at pallavi" |
| `isHighlight` | boolean | no | User flagged this as the moment of the concert (private signal) |
| `eventStartDateTime` | string | yes | Denormalized for GSI sort |
| `moderatorReviewedAt` | string | no | Timestamp of moderator action on free-text item |
| `moderatorRejectedReason` | string | no | If moderator marked unlinkable |
| `createdAt` | string | yes | Auto |
| `updatedAt` | string | yes | Auto |

**Indexes**

| Index | Type | GSI | Key |
|---|---|---|---|
| `primary` | primary | - | pk: `CONCERT_LOG_ITEMS#${userId}#${eventId}`, sk: `ITEM#${order}` |
| `byEvent` | GSI | gsi1 | gsi1pk: `EVENT_SETLIST#${eventId}`, gsi1sk: `${order}#${userId}` |
| `byComposition` | GSI | gsi2 | gsi2pk: `COMPOSITION_PERFORMANCES#${compositionId}`, gsi2sk: `${eventStartDateTime}#${userId}#${eventId}` |
| `byRaga` | GSI | gsi3 | gsi3pk: `RAGA_PERFORMANCES#${ragaId}`, gsi3sk: `${eventStartDateTime}#${userId}#${eventId}` |
| `byPendingModeration` | GSI | gsi4 | gsi4pk: `SETLIST_PENDING#${pending}`, gsi4sk: `${createdAt}#${userId}#${eventId}#${order}` |

Note: `pending` is a derived static value (`'1'` if `compositionId` is null AND `moderatorReviewedAt` is null, else not indexed). Use ElectroDB's `watch` pattern to compute this on write.

**Functions** (file: `index.ts`)

```typescript
upsertSetlistItem(userId, eventId, order, input) → ConcertLogItem
deleteSetlistItem(userId, eventId, order) → void
listUserSetlist(userId, eventId) → ConcertLogItem[]     // sorted by order
listEventSetlistItems(eventId) → ConcertLogItem[]       // all users, for reconciliation
reorderUserSetlist(userId, eventId, newOrderMap: {currentOrder, newOrder}[]) → void

// Aggregation queries
listPerformancesByComposition(compositionId, params?) → { items, nextToken?, hasMore }
listPerformancesByRaga(ragaId, params?) → { items, nextToken?, hasMore }

// Moderation
listPendingFreeTextItems(params?) → { items, nextToken?, hasMore }
linkFreeTextToComposition(userId, eventId, order, compositionId, moderatorId) → ConcertLogItem
rejectFreeTextItem(userId, eventId, order, moderatorId, reason) → ConcertLogItem
```

### 1.2 EventSetlist entity

Materialized public setlist derived from all ConcertLogItems for an event.

**Attributes**

| Attribute | Type | Required | Notes |
|---|---|---|---|
| `eventId` | string | yes | PK part |
| `order` | number | yes | SK part. Canonical order computed from median of contributor positions |
| `compositionId` | string | no | Linked (free-text-only items can also reach EventSetlist if 2+ contributors agree on the text) |
| `compositionTitle` | string | yes | Denormalized title |
| `ragaId` | string | no | Canonical raga (majority vote across contributors) |
| `ragaName` | string | no | Denormalized |
| `talaId` | string | no | Canonical tala |
| `talaName` | string | no | Denormalized |
| `compositionType` | string | no | Majority vote |
| `contributorCount` | number | yes | How many users logged this item |
| `totalLoggersForEvent` | number | yes | Total users with any setlist for this event (for confidence calc) |
| `confidenceScore` | number | yes | contributorCount / totalLoggersForEvent |
| `status` | string | yes | `derived` / `verified` / `disputed` / `lowConfidence` |
| `publicNoteIds` | list\<string\> | no | List of `${userId}#${eventId}#${order}` refs to ConcertLogItems with publicNotes |
| `disputes` | list\<map\> | no | Per-field disagreements (e.g. raga differs across users): `{field, options: {value, count}[]}` |
| `lastReconciliationAt` | string | yes | Auto-updated |
| `createdAt` | string | yes | Auto |
| `updatedAt` | string | yes | Auto |

**Indexes**

| Index | Type | GSI | Key |
|---|---|---|---|
| `primary` | primary | - | pk: `EVENT_SETLIST_PUBLIC#${eventId}`, sk: `ITEM#${order}` |
| `byStatus` | GSI | gsi1 | gsi1pk: `EVENT_SETLIST_STATUS#${status}`, gsi1sk: `${lastReconciliationAt}` |

**Functions**

```typescript
getEventSetlist(eventId) → EventSetlist[]              // sorted by order
recomputeEventSetlist(eventId) → EventSetlist[]        // main reconciliation entry point
listDisputedSetlistItems(params?) → { items, nextToken?, hasMore }
```

### 1.3 Updates to existing entities

**Event**: add `performanceCount` (number, optional). Increment via atomic ADD whenever EventSetlist gains items. Not strictly needed but cheap and useful for rendering.

**Composition**: add `performanceCount` (number, optional). Maintained by reconciliation worker.

**Raga**: add `performanceCount` (number, optional). Maintained by reconciliation worker.

**User**: add `trustLevel` (string, default `new`). Enum: `new`, `established`, `trusted`, `curator`. v1 sets manually; future automated promotion. This is a **contribution-quality** signal, distinct from `role` which governs operational permissions. A user can have any trustLevel regardless of role; moderator capabilities come from `role: moderator`, not from trustLevel.

**User**: add `preferences` map (optional). Stores user preferences as a single map field, defaults applied at read time. Keys:
- `theme`: `system` (default) / `light` / `dark`
- `contentLanguage`: `english` (default) / `tamil` / `telugu` / `kannada` / `hindi` / `devanagari` / `sanskrit` — controls which script ITRANS-transliterated composition titles and lyrics render in
- `contributeToPublicSetlists`: boolean (default `true`)
- `attendanceVisible`: boolean (default `false`)
- `showProfilePublicly`: boolean (default `true`)
- `displayName`: string (optional override of name)
- `bio`: string (optional, max 500 chars)

### 1.4 Reconciliation algorithm

```
function recomputeEventSetlist(eventId):
    items = listEventSetlistItems(eventId)
    if items is empty:
        deleteAllEventSetlistRows(eventId)
        return

    totalLoggers = countDistinct(items.userId)

    # Group linked items by compositionId
    linkedGroups = groupBy(items.filter(hasCompositionId), 'compositionId')

    # Group unlinked items by normalized text similarity (fuzzy)
    unlinkedGroups = fuzzyGroupBy(items.filter(not hasCompositionId), 'compositionTitle', threshold=0.85)

    eventSetlistRows = []

    for each group in linkedGroups + unlinkedGroups:
        contributorCount = countDistinct(group.userId)
        confidence = contributorCount / totalLoggers
        canonicalOrder = median(group.order)
        canonicalRaga = majorityVote(group.ragaId, fallback=composition.canonicalRagaId)
        canonicalTala = majorityVote(group.talaId, fallback=composition.canonicalTalaId)
        canonicalType = majorityVote(group.compositionType)

        # Detect disputes
        disputes = []
        if hasMultipleDistinctValues(group.ragaId):
            disputes.append({field: 'ragaId', options: countOccurrences(group.ragaId)})

        status = 'derived'
        if contributorCount == 1 and totalLoggers >= 3:
            status = 'lowConfidence'  # solo claim with corroborating loggers absent
        if disputes:
            status = 'disputed'

        eventSetlistRows.append({
            eventId,
            order: canonicalOrder,
            compositionId: group.compositionId,
            compositionTitle: group.canonicalTitle,
            ragaId: canonicalRaga,
            talaId: canonicalTala,
            compositionType: canonicalType,
            contributorCount,
            totalLoggersForEvent: totalLoggers,
            confidenceScore: confidence,
            status,
            publicNoteIds: group.filter(hasPublicNote).map(toRef),
            disputes
        })

    # Sort by canonical order, then renumber to remove gaps
    eventSetlistRows = sortBy(eventSetlistRows, 'order')
    eventSetlistRows.forEach((row, i) => row.order = i)

    # Preserve verified rows (moderator overrides are sticky)
    existingVerified = listEventSetlistRows(eventId).filter(r => r.status == 'verified')
    eventSetlistRows = mergeWithVerified(eventSetlistRows, existingVerified)

    # Idempotent write: delete existing, write new
    transaction:
        deleteAllEventSetlistRows(eventId)
        writeAll(eventSetlistRows)

    # Update counters
    updateCompositionPerformanceCounts(eventSetlistRows)
    updateRagaPerformanceCounts(eventSetlistRows)
```

**Verified rows are sticky.** Once a moderator overrides an EventSetlist row (sets `status: 'verified'`), the reconciliation worker preserves that row and ignores incoming user contributions for the same slot. The `mergeWithVerified` step ensures verified rows survive recomputation. Future user contributions still flow into ConcertLogItem (so individual diaries remain accurate and aggregate counts on composition/raga/artist pages stay correct), but they don't disturb the curated public setlist. If a moderator was wrong, an admin can unlock the row by changing status back to `derived`, which restores automatic reconciliation.

**Trigger points** for `recomputeEventSetlist`:

- After `upsertSetlistItem` (any change to a ConcertLogItem)
- After `deleteSetlistItem`
- After `linkFreeTextToComposition` (moderator action)
- After `rejectFreeTextItem` (moderator action)

**v1 trigger strategy**: synchronous within the mutation. For events with under 100 setlist items total, this is fast (single GSI query plus a small in-memory clustering operation plus a transactional write of maybe 15 rows).

**v2 trigger strategy** (if needed): debounced async via SQS. Multiple rapid submissions for the same event coalesce into one recomputation. Reconciliation worker is a Lambda.

### 1.5 Tests

Critical reconciliation tests:

- Single logger, simple setlist → renders as-is with confidence 1.0
- Two loggers, identical setlists → fully derived, confidence 1.0 for all items
- Two loggers, one missed item → missed item gets confidence 0.5, others 1.0
- Three loggers, one disagrees on raga for one item → that item flagged `disputed`
- Five loggers, position disagreement (one says order 6, others 8) → median wins
- Free-text item from one logger → does not appear in EventSetlist until moderated
- Free-text items from two loggers with similar text → fuzzy match groups them
- Moderator links free-text → item enters reconciliation pool, EventSetlist recomputes
- User updates their setlist → EventSetlist recomputes correctly (no orphans)
- User deletes their concert log → all their items removed, EventSetlist recomputes

### 1.6 Cascade rules

Rules for what happens to ConcertLogs, ConcertLogItems, and EventSetlists when upstream entities change. Implement in `packages/core/src/domain/cascade.ts` alongside existing cascade logic.

**Event soft-deleted**: cascade-soft-delete all ConcertLogs and ConcertLogItems for that event (set `deletedAt`). Delete the EventSetlist rows entirely. User diaries preserve the record under the hood but the event is hidden from public views.

**Event hard-deleted**: hard-delete all related ConcertLogs, ConcertLogItems, and EventSetlist rows. Update Composition/Raga `performanceCount` counters accordingly. Hard delete should be rare and admin-only.

**Event title / venue / startDateTime changed**: refresh denormalized fields on all ConcertLogs and ConcertLogItems via a background sweep. Acceptable to be eventually consistent (a few minutes of stale data is fine). For `startDateTime`, also recompute the GSI sort key on ConcertLogItem's `byUserDate` and `byComposition` indexes.

**Event merged into canonical event**: re-point all ConcertLogs and ConcertLogItems to the canonical eventId. Recompute the canonical event's EventSetlist (now with combined contributors). The loser event's EventSetlist is deleted.

**Composition soft-deleted**: ConcertLogItems referencing it keep the denormalized `compositionTitle` but `compositionId` is set to null and the item is moved into the moderation queue (status: needs re-linking). EventSetlist rows referencing the composition are recomputed (likely demoted to free-text status).

**Composition merged**: re-point ConcertLogItems to the canonical compositionId. Refresh denormalized fields. Recompute affected EventSetlists.

**Raga soft-deleted / merged**: refresh denormalized `ragaId` and `ragaName` on ConcertLogItems and EventSetlist rows. No status change needed.

**User account deleted**: hard-delete all their ConcertLogs and ConcertLogItems. Recompute EventSetlists for affected events. The user's contributions to public setlists are removed; if they were the only contributor for an item, that item drops from the public view.

**Implementation note**: most cascades can be implemented as hooks inside the source entity's `softDelete` / `merge` / `update` functions. The event-merge and composition-merge cases are most complex and warrant dedicated functions in `cascade.ts` with explicit tests.

### 1.7 tRPC API additions

New procedures across existing and new routers. Auth levels follow the existing `publicProcedure` / `protectedProcedure` / `editorProcedure` / `moderatorProcedure` / `adminProcedure` ladder.

**concertLog** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `concertLog.upsertWithSetlist` | mutation | protected | Combined upsert of private notes + setlist items for one event. Replaces all existing items transactionally. Triggers reconciliation synchronously. |
| `concertLog.getMySetlistForEvent` | query | protected | Calling user's setlist items for an event, ordered |
| `concertLog.listPastRsvpedWithoutLogs` | query | protected | Past events the user RSVP'd to but hasn't logged. Drives the `/my-concerts` backfill section (Phase 2.6) |

**eventSetlist** (new router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `eventSetlist.getForEvent` | query | public | Canonical public EventSetlist for an event. Returns calling user's own ConcertLogItems alongside when authenticated. Mirrors the `rsvp.getForEvent` pattern. |
| `eventSetlist.recomputeForEvent` | mutation | moderator | Force recomputation (debug / admin tool) |

**setlistModeration** (new router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `setlistModeration.listPendingFreeText` | query | moderator | Paginated queue of ConcertLogItems with no compositionId and no moderator review |
| `setlistModeration.linkFreeText` | mutation | moderator | Link a free-text item to an existing composition |
| `setlistModeration.rejectFreeText` | mutation | moderator | Mark a free-text item unlinkable with a reason |
| `setlistModeration.listDisputes` | query | moderator | EventSetlist rows with `status: 'disputed'` |
| `setlistModeration.resolveDispute` | mutation | moderator | Set canonical value for a disputed field; row becomes `verified` |
| `setlistModeration.overrideEventSetlist` | mutation | moderator | Direct edit of an EventSetlist row. Captured in `change_history`. Sets `status: 'verified'`. |
| `setlistModeration.unlockVerifiedRow` | mutation | admin | Revert a verified row to `derived` (for correcting moderator mistakes) |
| `setlistModeration.getStats` | query | moderator | Dashboard counts: pending free-text, disputes, recent overrides |

**composition** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `composition.listPerformances` | query | public | Logged performances of a composition. Query via `byComposition` GSI on EventSetlist, joins with Event for context |
| `composition.getPerformanceCount` | query | public | Read denormalized counter |

**raga** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `raga.listPerformances` | query | public | Logged performances of a raga |
| `raga.getPerformanceCount` | query | public | Read denormalized counter |
| `raga.getRepertoireStats` | query | public | Popular compositions in this raga, artists known for it (derived) |

**artist** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `artist.getRepertoire` | query | public | Most performed compositions, favorite ragas. Derived via EventSetlist + EventArtist join. Cached at route loader. |

**user** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `user.getMyPreferences` | query | protected | Effective preferences with defaults applied |
| `user.updatePreferences` | mutation | protected | Partial update of preferences map |
| `user.getPublicProfile` | query | public | Public profile by username. Returns 404 when target user's `showProfilePublicly` is false. |
| `user.getMyContributionStats` | query | protected | Counts: events logged, setlist items contributed (linked vs free-text), public notes added |

**search** (extend existing router)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `search.searchCompositions` | query | public | **New endpoint**. Fuse.js search over compositions. Currently absent from the search router (artists, ragas, talas, venues, organisers, events all exist; compositions don't). Required by the setlist entry typeahead. |

### 1.8 Reuse patterns from existing API

These existing patterns are direct templates for the new work; don't re-invent them.

- **Entity matching with confidence scoring**: `event.matchEntities` already does exact DB lookup + Fuse.js fuzzy search in parallel, deduplicated by id, with `score: 0` for exact match and higher for fuzzier. This is the exact pattern needed for the composition typeahead in setlist entry. Either reuse the helper directly or expose a `composition.matchEntities` variant if the input shape differs meaningfully.

- **Atomic counter increment/decrement**: `rsvp.toggle` (updates `rsvpCount`) and `concertLog.upsert` (updates `attendedCount`) use DynamoDB's `ADD` operation as fire-and-forget. Mirror exactly for `composition.performanceCount` and `raga.performanceCount` inside the reconciliation worker.

- **Public + own state in one call**: `rsvp.getForEvent` returns the public count plus the authenticated user's own RSVP status. `eventSetlist.getForEvent` should follow the same shape: `{ canonical: EventSetlist[], userOwn: ConcertLogItem[] | null }`. One round trip from the event page covers both the public render and the entry-view prefill.

- **Auto-entity creation on submit**: `event.submitVerified` auto-creates missing venues/organisers/artists when names exist without ids. Setlist submission **does not** mirror this for compositions; free-text items go to moderation instead. Reason: composition records carry richer semantic data (raga, tala, lyrics, composer, language) that should not be auto-fabricated from a free-text title.

- **Denormalized fields are historical snapshots**: `concertLog` documents that denormalized fields are intentionally not updated when the source Event changes. ConcertLogItem follows the same rule; the cascade rules in Phase 1.6 propagate only on major changes (merges, deletes), not routine edits.

- **Edit machinery vs setlist moderation**: the existing `edit.*` flow models user-proposed changes to canonical entity data. Setlist moderation is structurally different: free-text linking is an attribution task on a user's own contribution, and direct overrides are moderator authority decisions. Use the new `setlistModeration.*` router rather than retrofitting Edit. The semantics don't match and overloading them would muddy both flows.

---

## Phase 2: Entry UX

### 2.1 Route

**New route**: `/my-concerts/:eventId/edit`

Authenticated. Owner-only (user can only edit their own log).

### 2.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to event                                          │
│                                                          │
│ EVENT TITLE                                              │
│ Date · Venue · Artists                                   │
│ ───────────────────────────────────────────────────────  │
│                                                          │
│ ▼ Your private notes                                     │
│   [textarea, markdown ok]                                │
│                                                          │
│ ▼ Setlist                                                │
│                                                          │
│   1. ☆ [Composition search ▼]  Raga · Tala · Type       │
│         [Public note (optional)]                         │
│                                                          │
│   2. ☆ [Composition search ▼]  Raga · Tala · Type       │
│         [Public note (optional)]                         │
│                                                          │
│   + Add item                                             │
│                                                          │
│ ───────────────────────────────────────────────────────  │
│   Draft saved locally                                    │
│   [Cancel]                              [Submit]         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Behavior

**Draft persistence**

- Auto-save to `localStorage` on every keystroke or field change, keyed by `concert-log-draft-${eventId}`
- On view mount, hydrate from localStorage if present, fall back to server state
- On successful submit, clear the localStorage entry
- Show "Draft saved locally" indicator with timestamp

**Composition search**

- Typeahead using existing Fuse.js index loaded from S3
- Show top 8 matches with raga and composer as secondary info
- "Can't find it" affordance at the bottom of the dropdown that switches the row into free-text mode

**Raga/tala prefill**

- On composition selection, fetch the composition and prefill `ragaId` (and ragaName) and `talaId` (talaName) from the first entries in the composition's `ragas` and `talas` lists
- Both fields are editable; user can pick a different raga from a similar typeahead. This is the override path for RTP and substitutions

**Composition type**

- Horizontal pill row: Varnam · Kriti · RTP · Thillana · Javali · Padam · Viruttam · Thukkada · Slokam · Tani · Other
- If composition is linked, default from composition (composition entity needs a `compositionType` field; check if it exists, add if not)
- Always editable per item

**Reordering**

- Drag handle on each row (desktop)
- Swipe-up/swipe-down or long-press-drag on mobile
- Use `dnd-kit` or similar library

**Public note**

- Compact textarea per item, 500 char limit
- Helper text: "Public observations. e.g. '15min alapana', 'neraval at pallavi'"
- Distinct from concert-level private notes by placement and label

**Highlight star**

- Toggle icon on each row, private to user (does not appear in EventSetlist)

**Submit handler**

```typescript
async function submit(draft):
    // Single tRPC call that fans out internally
    await concertLog.submitWithSetlist({
        eventId,
        privateNotes: draft.notes,
        items: draft.items.map(item => ({
            order, compositionId?, compositionTitle, ragaId?, talaId?,
            compositionType?, publicNote?, isHighlight?
        }))
    })
```

The server handler:
1. Upserts `ConcertLog` with private `notes`
2. Replaces all existing `ConcertLogItem`s for this user+event with the new list (transactional)
3. Triggers `recomputeEventSetlist(eventId)` synchronously
4. Returns updated state to client

### 2.4 Components

New web package components:

```
packages/web/app/components/concert-log/
├── EntryView.tsx                  // Main layout
├── PrivateNotesEditor.tsx
├── SetlistEditor.tsx              // The list + reordering
├── SetlistItemRow.tsx             // One row with all fields
├── CompositionSearch.tsx          // Typeahead, returns {id, title, ragaId, talaId}
├── RagaSearch.tsx                 // Typeahead for raga override
├── TalaSearch.tsx                 // Typeahead for tala override
├── CompositionTypePicker.tsx      // Pill row
└── useLocalDraft.ts               // Hook for localStorage persistence
```

### 2.5 Free-text submission UX nudge

When a row has no linked `compositionId` and the user moves on (blur, submit, or add-next-item), inline below the row:

> _"Couldn't find this composition. It'll be reviewed and linked later."_

Single line, dismissible, non-blocking. Sets expectations and reduces "why isn't my contribution showing up publicly" support questions. Does not gate submission.

### 2.6 `/my-concerts` enhancements

The `/my-concerts` landing page already shows logged concerts. Extend it with a backfill discovery section that converts existing RSVPs into log invitations.

**Layout**

```
┌─────────────────────────────────────────────────────────┐
│ My Concerts                                              │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ ▼ Your concert log (47)                                  │
│                                                          │
│ 2026                                                     │
│ • Apr 12 · Sanjay Subrahmanyan at Music Academy         │
│ • Mar 28 · Ranjani-Gayatri at Bhavan                    │
│ ...                                                      │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ ▼ You RSVP'd, want to add notes? (3)                    │
│                                                          │
│ • Apr 5 · T.M. Krishna at Ravindra Kalakshetra          │
│   [Log this concert]                                     │
│ • Mar 20 · Aruna Sairam at Chowdiah                     │
│   [Log this concert]                                     │
│ • Feb 18 · Bombay Jayashri at Gayana Samaja             │
│   [Log this concert]                                     │
└─────────────────────────────────────────────────────────┘
```

**Query**: list user's RSVPs via the existing `USER_RSVP#${userId}` GSI, filter to events with `endDateTime` (or `startDateTime + 4h` fallback) in the past, exclude eventIds where a ConcertLog already exists.

Implementation note: the "exclude where log exists" check could be expensive for users with many RSVPs. Two paths:
- **A**: Query past RSVPs, batch-get ConcertLogs, filter client-side. Fine up to ~100 past RSVPs.
- **B**: Add a denormalized `hasLog` field on Rsvp, atomically toggled when the user logs the concert. Cleaner but adds write complexity.

Go with **A** for v1, watch performance, migrate to **B** if it bites.

Future extensions of this section (deferred):

- "Upcoming concerts you've RSVP'd to" reminder strip
- "Concerts your favorite artists are performing soon" recommendation
- Year-end stats: "you attended 23 concerts in 2026, top raga was Kambhoji"

---

## Phase 3: Reconciliation Pipeline

Already specified in 1.4. This phase is about implementing the worker and wiring triggers.

### 3.1 Worker implementation

Located at `packages/core/src/domain/event-setlist/reconcile.ts`.

```typescript
export async function recomputeEventSetlist(eventId: string): Promise<EventSetlist[]>
```

Pure logic, testable in isolation. Reads from DB, writes to DB, no side effects beyond the materialized rows and counter updates.

### 3.2 Trigger wiring

Add a helper in `packages/core/src/domain/concert-log-item/index.ts`:

```typescript
async function triggerReconciliationAfter<T>(eventId: string, op: () => Promise<T>): Promise<T> {
    const result = await op();
    await recomputeEventSetlist(eventId);
    return result;
}
```

Use it inside `upsertSetlistItem`, `deleteSetlistItem`, `linkFreeTextToComposition`, `rejectFreeTextItem`.

### 3.3 Counter updates

In a transaction inside `recomputeEventSetlist`:

- Diff the previous EventSetlist for this event vs the new computed one
- For each composition removed/added: atomic ADD to `composition.performanceCount`
- For each raga removed/added: atomic ADD to `raga.performanceCount`

Counters can drift if a reconciliation transaction fails partially. Add a nightly cron at `packages/scripts/src/recompute-performance-counts.ts` to reset counters from authoritative GSI counts.

### 3.4 Fuzzy text grouping

For unlinked items, group by `compositionTitle` similarity:

```typescript
function fuzzyGroupBy(items, field, threshold = 0.85): Group[]
```

Use Fuse.js with the existing search index, or a simpler Levenshtein-based clustering. Don't over-engineer. If two free-text items from different users both say "Vatapi Ganapatim" with minor spelling variation, they cluster together.

Free-text-only groups (no compositionId on any member) appear in EventSetlist as items but **without** raga/tala (since there's no canonical source). They will appear in the moderator queue separately for linking.

---

## Phase 4: Moderation Surfaces

### 4.1 Routes

- `/moderate/setlist-items` - pending free-text items queue
- `/moderate/setlist-disputes` - EventSetlist items with `status: 'disputed'`

Both require `moderator` role.

### 4.2 Free-text linking UI

For each pending item, moderator sees:

- The free-text title the user entered
- Original event context (event title, date, venue, artists)
- The user who submitted it
- Three options:
  - **Link to existing composition** (search box, top suggestions from Fuse.js)
  - **Create new composition** (opens composition creation form with title prefilled)
  - **Mark unlinkable** (with reason from a small enum: `not a composition`, `duplicate of earlier item`, `insufficient info`)

On link or create, `linkFreeTextToComposition` is called. On unlinkable, `rejectFreeTextItem`.

Bulk actions: select multiple items with the same title across different events, link them all at once.

### 4.3 Dispute resolution UI

For each disputed EventSetlist item:

- Show the disputed field (e.g. ragaId)
- Show each option with contributor counts: "Hamsanandi (3 logs) vs Hamsadhwani (1 log)"
- Moderator picks the correct value, optionally adds a note
- Action: `resolveSetlistDispute(eventId, order, field, value, moderatorId)`

This sets the EventSetlist row to `status: 'verified'` and freezes the value. Future contributions of the same item don't trigger re-disputation unless an admin unlocks it.

### 4.4 Direct canonical override

A moderator can edit any EventSetlist row directly, bypassing dispute resolution. This is faster for cases where the moderator has authoritative knowledge (e.g. they were at the concert, or they have the artist's published setlist).

Route: `/moderate/setlist/:eventId` shows the current public setlist with edit controls on every row:

- Reorder items
- Edit composition, raga, tala, type per row
- Add or remove rows
- Edit canonical public notes (a separate moderator-curated note distinct from user-contributed publicNotes)

All edits set `status: 'verified'`. The audit trail is captured via the existing `change_history` entity with `entityType: 'eventSetlistItem'`. User logs remain untouched; the override only affects the materialized public view.

### 4.5 Moderation queue performance

The `byPendingModeration` GSI on ConcertLogItem (gsi4) gives a paginated, time-ordered queue. Pre-fetch counts on a dashboard widget.

---

## Phase 5: Public Surfaces

### 5.1 Event page

Add a "Setlist" section below the description. Render from `getEventSetlist(eventId)`:

```
Setlist
─────────
1.  Vatapi Ganapatim · Hamsadhwani · Adi · Kriti
    "20min alapana" (5 notes)

2.  Sri Subramanyaya Namaste · Kambhoji · Rupakam · Kriti
    (2 notes)

3.  Pakkala Nilabadi · Kharaharapriya · Misra Chapu · Kriti

...

Based on logs from 5 rasikas
```

Each item links to the composition page. Raga and tala are clickable. Confidence is **not** shown to public users in v1 (avoid information overload), but moderators see it via a moderator-only debug toggle.

Items with `status: 'lowConfidence'` are shown in a collapsed "Also reported" section.

If `EventSetlist` is empty: show "No setlist logged yet. [Log it]" CTA.

### 5.2 Composition page

Add a section "Performances logged":

```
Performances of Vatapi Ganapatim
─────────────────────────────────
Logged at 47 concerts on Rasika

Recent performances:
• 2026-04-12 · Sanjay Subrahmanyan at Music Academy
• 2026-03-28 · Aruna Sairam at Bharatiya Vidya Bhavan
• 2026-03-15 · Ranjani-Gayatri at Shanmukhananda Hall
[View all performances →]
```

Query: `listPerformancesByComposition(compositionId)` joined with event data.

### 5.3 Raga page

Add "Performances" section:

```
Performances of Kambhoji
─────────────────────────
83 performances logged

Popular compositions performed in this raga:
• Sri Subramanyaya Namaste (24 performances)
• O Ranga Sayee (18 performances)
• Marakata Vallim (12 performances)

Artists known for this raga:
• Sanjay Subrahmanyan (15 performances)
• Aruna Sairam (12 performances)
```

These are aggregations across EventSetlist rows by ragaId.

### 5.4 Artist page

Add "Repertoire" section:

```
Repertoire (derived from logged concerts)
──────────────────────────────────────────
Most performed compositions:
• Pakkala Nilabadi · Kharaharapriya · 8 performances
• Marakata Vallim · Kambhoji · 6 performances
• Akhilandeshwari · Dwijavanti · 5 performances

Favorite ragas:
• Kambhoji (15 performances)
• Kharaharapriya (12 performances)
• Todi (10 performances)
```

Derivation: join EventArtist with EventSetlist via eventId. Counts per composition / raga. Cache aggressively.

### 5.5 User profile page

**New route**: `/u/:username`

Public, but minimal:

```
@username
──────────
Contributed to 47 event setlists
Added 312 public notes on setlist items
Member since 2025-12-01

Public composition contributions:
• Vatapi Ganapatim (logged 5 performances)
• Marakata Vallim (logged 3 performances)
```

Does **not** show:
- Their attended concerts list
- Their concert-level notes
- Their public notes attributed to them (notes appear on EventSetlist anonymized in v1)

This is a contribution profile, not a social profile. The data shown is opt-out (a privacy toggle in settings: "make my contributions visible on my profile", default on).

---

## Phase 6: Graph Data Aggregations

### 6.1 Derived counts on Composition, Raga, Artist pages

In v1, compute on-read with caching at the route level (React Router loader). Tag cache by entity ID. Invalidate via webhook or short TTL (5 min) since data is eventually consistent already.

For higher-traffic pages, materialize. Decision point: when does on-read become slow? Probably after 10,000+ EventSetlist rows. Defer materialization until measurements warrant.

### 6.2 ArtistComposition derived data

Two implementation paths:

**Path A (on-read, v1)**: Query `listPerformancesByComposition(compositionId)`, then for each performance fetch event, then join with EventArtist by eventId. Build a Map<artistId, count>. Cache at the route loader.

**Path B (materialized, v2)**: New `artist_composition_perf` junction with PK `ARTIST_COMP#${artistId}` and SK `COMPOSITION#${compositionId}#${count}`. Updated by reconciliation worker. Enables fast "artist's repertoire" listing.

Go with Path A initially. Migrate to Path B when query latency exceeds 200ms p95.

---

## Phase 7: Settings & User Preferences

A new settings page that consolidates all user-controllable preferences. The concert setlist feature introduces several toggles (contribution visibility, profile visibility), and there's no existing surface to expose them. Build the page as a hub for both setlist-related prefs and other user prefs (theme, content language) that don't have a home yet.

### 7.1 Route

`/settings` (redirects to `/settings/profile`)

Sub-routes:
- `/settings/profile` — display name, bio, avatar, public profile visibility
- `/settings/contributions` — setlist contribution prefs, attendance visibility, contribution stats
- `/settings/display` — theme, content display language
- `/settings/account` — read-only email, connected accounts, sign out

Authenticated. Owner-only (a user can only view and edit their own settings).

### 7.2 Storage

Settings live in the `preferences` map on the User entity (added in 1.3). Single record read; all preferences load together. Defaults are applied at read time so missing keys never cause undefined behavior:

```typescript
function getEffectivePreferences(user: User): Preferences {
    return {
        theme: 'system',
        contentLanguage: 'english',
        contributeToPublicSetlists: true,
        attendanceVisible: false,
        showProfilePublicly: true,
        displayName: user.name,  // falls back to OAuth name
        bio: '',
        ...user.preferences  // user overrides win
    };
}
```

### 7.3 tRPC procedures

```typescript
user.getMyPreferences()                        → Preferences        (protectedProcedure)
user.updatePreferences(partialPreferences)     → Preferences        (protectedProcedure)
```

Validation via a Zod schema that mirrors the keys above. Reject unknown keys (forward-compat is handled by adding new keys explicitly).

### 7.4 Content language

The most useful preference for the diaspora rasika audience.

**Scope**: controls which script ITRANS-transliterated composition titles, raga names, tala names, and lyrics render in. Does not change UI language (button labels, navigation, etc.) — that's deferred until proper i18n infrastructure is in place.

**Implementation**:
- Preference stored as `contentLanguage`: `english` | `tamil` | `telugu` | `kannada` | `hindi` | `devanagari` | `sanskrit`
- SSR reads the cookie (set when pref is changed) and applies the right script transformation to ITRANS-bearing fields
- Falls back to `english` for users without a preference, and for non-authenticated users
- No flash-of-wrong-script: applied at SSR time before HTML is sent

### 7.5 Theme

Standard `system` / `light` / `dark`.

**Implementation**:
- Pref stored as `theme`
- Cookie mirrors the pref so SSR can set `<html class="...">` before hydration
- `system` reads `prefers-color-scheme` via a small inline script in the document head
- CSS uses class-based theming with custom properties

### 7.6 Profile section

Editable fields:
- `displayName` (defaults to OAuth name, can override)
- `bio` (optional, max 500 chars, plain text)
- Avatar (uses existing Image namespace `Image.getImageUploadUrl('user', ...)` pattern; add `user` to allowed entity types)
- `showProfilePublicly` toggle: when off, `/u/:username` returns 404 (or "this profile is private"). Public contributions still appear anonymously on event setlists.

### 7.7 Contributions section

Editable fields:
- `contributeToPublicSetlists` toggle (default on)
- `attendanceVisible` toggle (default off)

Read-only stats panel:
- Events logged
- Setlist items contributed (linked compositions)
- Free-text items submitted
- Public notes contributed
- Member since (createdAt)

### 7.8 Account section

Read-only display:
- Email (from OAuth)
- Connected accounts: Google (only option for now)
- Sign out button

### 7.9 Components

```
packages/web/app/components/settings/
├── SettingsLayout.tsx           // Tabbed wrapper
├── ProfileTab.tsx
├── ContributionsTab.tsx
├── DisplayTab.tsx
├── AccountTab.tsx
├── ThemePicker.tsx
├── ContentLanguagePicker.tsx
└── usePreferences.ts            // Hook with optimistic updates
```

### 7.10 Future tabs (reserve nav slots, hide for v1)

- **Notifications** — email digests, event reminders, weekly summary
- **Data** — export your diary as JSON or CSV, delete account
- **Connections** — link additional OAuth providers, follow other rasikas (when social ships)

---

## Trust tier scaffolding (deferred logic, layer in early)

Add `trustLevel` to User now. v1 sets all users to `new` and lets admins manually promote. **trustLevel is a contribution-quality signal, not a permission system.** Operational permissions (moderator tools, admin tools) come from the existing `role` field. The two are orthogonal: a `role: editor` with `trustLevel: curator` is a deeply trusted contributor without moderation powers; a `role: moderator` with `trustLevel: new` has full moderation tools regardless of contribution history (e.g. a hire on day one).

Future automated promotion rules (not implemented in v1, but reserve the field):

| Tier | Promotion criteria | Capabilities |
|---|---|---|
| `new` | Default | Free-text items always queued for moderation. Public notes rate-limited (3/day) |
| `established` | 10+ corroborated linked items, 30+ days since signup | Public notes auto-approved, free-text still queued |
| `trusted` | 100+ corroborated items, 0 rejected items in last 90 days | Can directly link free-text in their own logs to existing compositions (skip moderation) |
| `curator` | Manual promotion by admin, demonstrated subject expertise | Contributions get higher weight in reconciliation. Can propose changes to canonical raga/tala on compositions. Can suggest composition merges. Still routes through `role: moderator` for actual application of changes |

---

## Testing strategy

### Unit tests

- Reconciliation algorithm (cover all edge cases listed in 1.5)
- Fuzzy text grouping
- Counter delta computation
- Trust tier capability checks (even if tiers are manual)

### Integration tests

- Submit setlist end-to-end, verify ConcertLog + ConcertLogItems + EventSetlist all update correctly
- Free-text item appears in moderation queue
- Moderator linking triggers reconciliation
- Concurrent submissions from different users converge to consistent state
- Delete user's concert log removes all their items and recomputes EventSetlist

### E2E tests (Playwright or similar)

- Entry view: type, add items, reorder, submit
- Draft persistence: refresh page, draft restored
- Composition typeahead returns expected results
- Raga override flow

### Manual QA checklist before launch

- Try entering a setlist for a real recent kutcheri the EA attended
- Have 3 people log the same concert; verify EventSetlist reconciles correctly
- Stress test: 50 items in one setlist, drag-reorder works on mobile

---

## Rollout

### Feature flag

Add a feature flag `enableSetlists`. Gate the entry UX route and the public EventSetlist rendering behind it.

### Soft launch

1. Enable for moderators only. They log 20-30 concerts from memory and from sabha records.
2. Enable for a handful of trusted rasikas (manually flagged). They log 50-100 more.
3. Enable for all logged-in users. Default visibility on event pages turns on.

### Migration

Existing ConcertLog rows have no items. No migration needed; they just start with empty setlists. Users can edit and add setlists retroactively.

### Composition coverage gaps

Some setlist items will fail to link because the composition isn't in the DB. Pre-launch: review the top 200 most-performed Carnatic compositions (Pancharatna kritis, common Tyagaraja/Dikshitar/Syama Sastri kritis, popular thillanas) and ensure they're all in the composition table with correct raga/tala. This reduces the moderation backlog on day 1.

---

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Reconciliation produces wrong canonical setlist at low contributor counts | High | Medium | Show "based on N logs" honestly; lowConfidence status hides items in main view |
| Free-text moderation queue grows faster than the EA can process | Medium | High | Pre-seed composition coverage; bulk-link UX; promote trusted users earlier than planned |
| Public notes become spam / abuse vector | Medium | High | Rate limits per user; profanity filter; trust tier gating; moderator delete action |
| Performance: events with 50+ contributors cause slow reconciliation | Low | Medium | v1 sync is fine up to ~30 contributors; switch to async + debounce when measured |
| Counter drift on Composition/Raga performanceCount | Medium | Low | Nightly cron recomputes from GSI counts |
| User submits then deletes setlist repeatedly to spam reconciliation | Low | Low | Rate-limit submissions per user per event (max 10/hour) |
| Composition linked to wrong canonical raga, polluting reconciliation | Low | Medium | Performance-specific raga override exists; moderator can fix canonical raga separately |
| Two users wildly disagree on the entire setlist (e.g. wrong event) | Low | Medium | Both setlists preserved as user logs; EventSetlist shows disputed state; moderator can split |

---

## Resolved decisions

1. **Composition type on Composition entity**: Adding it. Same enum as ConcertLogItem (`varnam`, `kriti`, `rtp`, `thillana`, `javali`, `padam`, `viruttam`, `thukkada`, `slokam`, `tani`, `other`). Optional field. ConcertLogItem still stores its own performance-specific value (override defaults to composition's canonical value).

2. **Public note attribution in v1**: Anonymized in display, but `userId` is stored on every ConcertLogItem. Attribution data is collected from day one; v2 can flip a toggle to show usernames without any migration.

3. **Highlight star aggregation**: Deferred. Stays purely private (per-user signal) in v1. Aggregation surfaces in v2 once data thickens.

4. **Setlist for non-Carnatic events**: `compositionType` enum includes `other`. UI accepts unlinked free-text gracefully. Lec-dems and pure dance recitals can be logged with notes and zero or partial setlist.

5. **Editing canonical EventSetlist directly**: Moderators can override directly (overriding initial recommendation). Overrides set `status: 'verified'` which is sticky against further reconciliation. Audit trail captured via existing `change_history` entity. See Phase 4.4.

6. **Time complexity of public note display**: Show 3 most recent public notes per item by default with expand affordance.

7. **Moderator override persistence**: Sticky verified. Verified rows survive recomputation. User contributions continue to flow into ConcertLogItem and aggregate counters, but don't disturb the curated public setlist. Admin can unlock by reverting status to `derived`.

8. **Cascade rules**: Defined in Phase 1.6.

9. **Past event UX**: Confirmed retroactive. Users can log concerts from any past event via search → event page → "Log this concert" button. `/my-concerts` includes an RSVP-backfill discovery section to surface forgotten concerts.

10. **Free-text submission friction**: Option B (inline nudge, non-blocking). See Phase 2.5.

11. **Settings page**: New, see Phase 7. Folds in concert-setlist privacy toggles alongside theme and content-language preferences. Built in week 6.

12. **Content language scope (v1)**: Content display only (which script lyrics and titles render in). UI language deferred until i18n infrastructure exists.

13. **trustLevel vs role**: Orthogonal dimensions. trustLevel governs contribution quality (enum: `new`, `established`, `trusted`, `curator`). role governs operational permissions (enum: `editor`, `moderator`, `admin`). No overlap.

14. **`/my-concerts` enhancements**: Add an RSVP-backfill discovery section listing past events the user RSVP'd to but hasn't logged. See Phase 2.6.

15. **Backfill strategy**: Decision made at build time; not a blocker. Curator-verified backfills of December Season concerts and prominent Bangalore performances would seed public surfaces nicely but can be done after launch.

---

## Build sequence (recommended)

Aim for one of these per week of focused work:

1. **Week 1**: ConcertLogItem entity + tests + tRPC procedures. Add `compositionType` to Composition. Add `trustLevel` and `preferences` map to User. **Add `search.searchCompositions` to the search router** (currently missing).
2. **Week 2**: EventSetlist entity + reconciliation algorithm + tests. Cascade rules implementation. New `setlistModeration` router skeleton.
3. **Week 3**: Entry UX (entry view, draft persistence, composition typeahead reusing `event.matchEntities` pattern, free-text nudge). `/my-concerts` RSVP-backfill section.
4. **Week 4**: Public surfaces (event page setlist via `eventSetlist.getForEvent`, composition page performance listings, performance counters).
5. **Week 5**: Moderation surfaces (pending free-text queue, dispute resolution UI, direct override UI with change_history audit).
6. **Week 6**: Raga/artist page additions, user profile (`/u/:username`), **settings page (all 4 tabs)**, polish, manual QA.
7. **Week 7**: Soft launch to moderators, fix issues, scale gradually.

Total: roughly 6-7 weeks of focused work. Could compress to 4 if Phases 5 and 6 are sequenced after launch, but the settings page must ship before opening to non-moderator users (privacy toggles need to be controllable from day one of public access).

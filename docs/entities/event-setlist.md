# EventSetlist Entity

ElectroDB Model: `eventSetlist` v1, service: `rasikalife`

Materialized canonical setlist per event, derived by reconciling all contributors' `ConcertLogItem` rows. Written by `recomputeEventSetlist` after every setlist submission. Each row is one item in the consensus setlist; status reflects confidence and moderation state.

## Attributes

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `eventId` | string | yes | Linked event |
| `order` | number | yes | Canonical position (0-indexed, renumbered after each recompute) |
| `orderStr` | string | computed | Zero-padded `order` for lexicographic sort |
| `compositionId` | string | no | Linked composition (absent for free-text-only consensus items) |
| `compositionTitle` | string | yes | Canonical title |
| `ragaId` | string | no | Majority-vote raga |
| `ragaName` | string | no | Denormalized |
| `talaId` | string | no | Majority-vote tala |
| `talaName` | string | no | Denormalized |
| `compositionType` | string | no | Majority-vote type |
| `contributorCount` | number | yes | Users who logged this item |
| `totalLoggersForEvent` | number | yes | Total users with any setlist for this event |
| `confidenceScore` | number | yes | `contributorCount / totalLoggersForEvent` |
| `status` | string | yes | `derived` / `verified` / `disputed` / `lowConfidence` |
| `publicNoteIds` | list\<string\> | no | Refs to ConcertLogItems that have a `publicNote` |
| `disputes` | list\<map\> | no | Per-field disagreements: `{field, options: {value, count}[]}` |
| `lastReconciliationAt` | string | yes | Timestamp of last recompute |
| `createdAt` | string | yes | Auto |
| `updatedAt` | string | yes | Auto |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `EVENT_SETLIST_PUBLIC#${eventId}`, sk: `ITEM#${orderStr}` |
| `byStatus` | GSI | gsi1 | gsi1pk: `EVENT_SETLIST_STATUS#${status}`, gsi1sk: `${lastReconciliationAt}` |

## Status meanings

| Status | Meaning |
|--------|---------|
| `derived` | Automatically computed from contributor consensus |
| `verified` | Moderator has locked this row. Survives future recomputations. |
| `disputed` | At least one field has conflicting values across contributors |
| `lowConfidence` | Only one contributor claimed this item but 3+ users logged the event |

**Verified rows are sticky.** Once a moderator sets a row to `verified` (via override or dispute resolution), the reconciliation algorithm preserves it unchanged. Future user contributions still update `ConcertLogItem` and performance counters, but don't modify the public row. An admin can unlock it by reverting to `derived`.

## Functions

```typescript
import { EventSetlist } from '@rasika/core';
// or
import { getEventSetlist, recomputeEventSetlist, ... } from '@rasika/core/domain/event-setlist';
// Browser-safe types:
import type { EventSetlist, EventSetlistStatus } from '@rasika/core/domain/event-setlist/client';
```

- `getEventSetlist(eventId)` → EventSetlist[] — sorted by order
- `recomputeEventSetlist(eventId)` → EventSetlist[] — full reconciliation; reads all ConcertLogItems, runs algorithm, atomically replaces rows (single TransactWriteCommand when ≤100 ops, batched otherwise), updates Composition/Raga `performanceCount` counters
- `writeEventSetlistRows(eventId, rows, existing)` → void — atomic delete+put in one transaction when combined ops ≤100
- `deleteAllEventSetlistRows(eventId)` → void
- `listDisputedSetlistItems(params?)` → paginated — via `byStatus` GSI
- `verifyEventSetlistRow(eventId, order, updates)` → EventSetlist — sets status to `verified`
- `unlockEventSetlistRow(eventId, order)` → EventSetlist — reverts verified row to `derived`
- `updateEventSetlistRow(eventId, order, updates)` → EventSetlist

## Reconciliation algorithm summary

1. Load all ConcertLogItems for the event via `byEvent` GSI
2. Group linked items by `compositionId`; group unlinked by fuzzy title similarity (Levenshtein ≥0.85)
3. For each group: compute median order, majority-vote raga/tala/type, detect disputes
4. Assign status: `lowConfidence` if solo claim with ≥3 total loggers; `disputed` if any field conflicts; else `derived`
5. Preserve existing `verified` rows (merge step: verified rows override computed rows at the same slot)
6. Atomic write: delete existing rows + write new rows in a single transaction
7. Diff old vs new to update `Composition.performanceCount` and `Raga.performanceCount` via atomic ADD

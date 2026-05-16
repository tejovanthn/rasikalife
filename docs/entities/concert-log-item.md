# ConcertLogItem Entity

ElectroDB Model: `concertLogItem` v1, service: `rasikalife`

One ordered item in a user's setlist log for a specific event. Aggregating all users' items for an event produces the public `EventSetlist` via the reconciliation algorithm. Free-text items (no `compositionId`) enter a moderation queue for linking to canonical compositions.

## Attributes

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `userId` | string | yes | Owner |
| `eventId` | string | yes | Linked event |
| `order` | number | yes | 0-indexed position in the setlist |
| `compositionId` | string | no | Linked composition. Null = free-text awaiting moderation |
| `compositionTitle` | string | yes | User-entered or denormalized title |
| `ragaId` | string | no | Performance-specific raga (may differ from composition canonical) |
| `ragaName` | string | no | Denormalized |
| `talaId` | string | no | Performance-specific tala |
| `talaName` | string | no | Denormalized |
| `compositionType` | string | no | One of: `varnam`, `kriti`, `rtp`, `thillana`, `javali`, `padam`, `viruttam`, `thukkada`, `slokam`, `tani`, `other` |
| `publicNote` | string | no | Public annotation, max 500 chars (e.g. "15min alapana") |
| `isHighlight` | boolean | no | User's private highlight flag |
| `eventStartDateTime` | string | yes | Denormalized for GSI sort keys |
| `moderatorReviewedAt` | string | no | Timestamp of moderator action on this item |
| `moderatorRejectedReason` | string | no | Rejection reason if marked unlinkable |
| `moderatorId` | string | no | Moderator who acted on this item |
| `createdAt` | string | yes | Auto (readOnly) |
| `updatedAt` | string | yes | Auto-updated on every write |

## Computed / watch attributes

These are derived by ElectroDB watch setters and stored in DynamoDB. They drive sparse GSIs — returning `undefined` from the setter excludes the item from that index.

| Attribute | Derived from | Value |
|-----------|-------------|-------|
| `orderStr` | `order` | Zero-padded string (`0003`) for lexicographic sort |
| `compositionPerfKey` | `compositionId` | `COMPOSITION_PERFORMANCES#${compositionId}` or `undefined` |
| `ragaPerfKey` | `ragaId` | `RAGA_PERFORMANCES#${ragaId}` or `undefined` |
| `pendingModerationKey` | `compositionId`, `moderatorReviewedAt` | `'1'` when both are absent, else `undefined` |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `CONCERT_LOG_ITEMS#${userId}#${eventId}`, sk: `ITEM#${orderStr}` |
| `byEvent` | GSI | gsi1 | gsi1pk: `EVENT_SETLIST#${eventId}`, gsi1sk: `${orderStr}#${userId}` |
| `byComposition` | GSI | gsi2 | gsi2pk: `compositionPerfKey` (sparse), gsi2sk: `${eventStartDateTime}#${userId}#${eventId}` |
| `byRaga` | GSI | gsi3 | gsi3pk: `ragaPerfKey` (sparse), gsi3sk: `${eventStartDateTime}#${userId}#${eventId}` |
| `byPendingModeration` | GSI | gsi4 | gsi4pk: `SETLIST_PENDING#${pendingModerationKey}` (sparse), gsi4sk: `${createdAt}#${userId}#${eventId}#${orderStr}` |

## Functions

```typescript
import { ConcertLogItem } from '@rasika/core';
// or
import { replaceUserSetlist, listUserSetlist, ... } from '@rasika/core/domain/concert-log-item';
// Browser-safe types:
import type { ConcertLogItem } from '@rasika/core/domain/concert-log-item/client';
import { COMPOSITION_TYPES, REJECT_REASONS, DISPUTE_FIELDS } from '@rasika/core/domain/concert-log-item/client';
```

- `upsertSetlistItem(userId, eventId, order, input)` → ConcertLogItem
- `deleteSetlistItem(userId, eventId, order)` → void
- `replaceUserSetlist(userId, eventId, items[])` → void — atomic transactional replace; max 50 items (DynamoDB 100-op transaction limit)
- `listUserSetlist(userId, eventId)` → ConcertLogItem[] — sorted by order
- `listEventSetlistItems(eventId)` → ConcertLogItem[] — all users' items for an event (via gsi1, used by reconciliation)
- `listPerformancesByComposition(compositionId, params?)` → paginated — via sparse gsi2
- `listPerformancesByRaga(ragaId, params?)` → paginated — via sparse gsi3
- `listPendingFreeTextItems(params?)` → paginated — items with no compositionId and no moderator review, via sparse gsi4
- `linkFreeTextToComposition(userId, eventId, order, compositionId, moderatorId)` → ConcertLogItem
- `rejectFreeTextItem(userId, eventId, order, moderatorId, reason)` → ConcertLogItem
- `deleteAllUserSetlistItems(userId, eventId)` → void

## Notes

- `replaceUserSetlist` caps at 50 items (enforced by the tRPC schema). This keeps deletes + puts within DynamoDB's 100-op TransactWriteItems limit (at most 50 deletes of old positions + 50 puts of new ones).
- The `byComposition`, `byRaga`, and `byPendingModeration` GSIs are **sparse**: items without `compositionId`, `ragaId`, or both of (`compositionId` + `moderatorReviewedAt`) absent are simply not indexed in those GSIs. This is achieved via ElectroDB `watch` setters that return `undefined`.
- Free-text items (no `compositionId`) appear in the moderation queue (gsi4) until a moderator links or rejects them. Linking calls `linkFreeTextToComposition`, which sets `compositionId` and `moderatorReviewedAt` — both watch setters fire, moving the item from gsi4 into gsi2 atomically.

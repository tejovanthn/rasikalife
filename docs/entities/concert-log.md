# ConcertLog Entity

ElectroDB Model: `concertLog` v1, service: `rasikalife`

A user's personal record of concerts they have attended. Acts as a lightweight "concert book" — upsert-on-attend, delete-on-unattend. Each write atomically increments/decrements `attendedCount` on the parent Event.

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `userId` | string | yes | - | Owner user ID |
| `eventId` | string | yes | - | Linked event ID |
| `eventTitle` | string | yes | - | Event title (denormalized at log time) |
| `eventStartDateTime` | string | yes | - | Event start datetime ISO (denormalized) |
| `venueName` | string | no | - | Venue name (denormalized) |
| `artistNames` | list\<string\> | no | [] | Artist names (denormalized) |
| `notes` | string | no | - | User's private notes about the concert |
| `createdAt` | string | yes | auto | Creation timestamp (readOnly) |
| `updatedAt` | string | yes | auto | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `USER#${userId}`, sk: `CONCERT_LOG#${eventId}` |
| `byUserDate` | GSI | gsi1 | gsi1pk: `USER_CONCERTS#${userId}`, gsi1sk: `${eventStartDateTime}#${eventId}` |
| `byEvent` | GSI | gsi2 | gsi2pk: `EVENT_LOGS#${eventId}`, gsi2sk: `${createdAt}#${userId}` |

## Functions

```typescript
import { upsertConcertLog, deleteConcertLog, getConcertLog, listUserConcertLogs, listEventConcertLogs, getAttendedCount } from '@rasika/core/domain/concert-log';
// Browser-safe types only:
import type { ConcertLog } from '@rasika/core/domain/concert-log/client';
```

- `upsertConcertLog(userId, eventId, params?)` → ConcertLog — creates or updates a log entry; atomically increments `attendedCount` on the Event on first creation
- `deleteConcertLog(userId, eventId)` → void — removes the log entry; atomically decrements `attendedCount`
- `getConcertLog(userId, eventId)` → ConcertLog | null
- `listUserConcertLogs(userId, params?)` → `{items: ConcertLog[], nextToken?, hasMore}` — ordered by `eventStartDateTime` desc (most recent first)
- `listEventConcertLogs(eventId, params?)` → `{items: ConcertLog[], nextToken?, hasMore}` — all users who attended a given event
- `getAttendedCount(eventId)` → number — reads `attendedCount` from the Event record

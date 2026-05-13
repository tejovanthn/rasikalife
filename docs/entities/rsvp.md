# Rsvp Entity

ElectroDB Model: `rsvp` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | yes | ID of the event |
| `userId` | string | yes | ID of the user who RSVPed |
| `createdAt` | string | yes | Timestamp of the RSVP (auto-set, read-only) |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `byEvent` | primary | - | pk: `RSVP#${eventId}`, sk: `USER#${userId}` |
| `byUser` | GSI | gsi1 | gsi1pk: `USER_RSVP#${userId}`, gsi1sk: `RSVP#${createdAt}` |

The primary index supports querying all RSVPs for an event by PK alone. The GSI supports querying all events a user has RSVPed to, sorted by time.

## Functions

```typescript
import { Rsvp } from '@rasika/core'; // namespace: Rsvp.toggleRsvp(), Rsvp.getEventRsvpInfo(), etc.
// or individually:
import { toggleRsvp, getRsvpCount, getUserRsvp, getEventRsvpInfo } from '@rasika/core/domain/rsvp';
```

- `toggleRsvp(eventId, userId)` → `{ isGoing: boolean; count: number }` — creates or deletes the RSVP and atomically increments/decrements the `rsvpCount` counter on the Event
- `getRsvpCount(eventId)` → `number` — reads the denormalized `rsvpCount` field from the Event entity
- `getUserRsvp(eventId, userId)` → `boolean` — checks whether a specific user has RSVPed
- `getEventRsvpInfo(eventId, userId?)` → `{ count: number; isGoing: boolean }` — fetches count and membership in a single call

## Notes

The `rsvpCount` total is stored directly on the Event entity (denormalized) using an atomic `ADD` operation, so listing pages never need to count RSVPs separately. There is no `schema.ts` or `client.ts` for this domain — all operations are in `index.ts`.

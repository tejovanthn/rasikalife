# EventArtist Entity

ElectroDB Model: `eventArtist` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string | yes | ID of the event |
| `artistId` | string | yes | ID of the artist |
| `eventTitle` | string | yes | Denormalized event title |
| `eventStartDateTime` | string | yes | Denormalized event start time (ISO string) |
| `artistName` | string | yes | Denormalized artist name |
| `artistTitle` | string | no | Denormalized honorific (e.g. "Sri", "Smt.") |
| `role` | string | no | Artist's role at the event (e.g. "vocalist", "accompanist") |
| `createdAt` | string | yes | Timestamp of the relationship (auto-set, read-only) |

`eventTitle`, `eventStartDateTime`, and `artistName` are duplicated from their source entities to avoid extra lookups when rendering artist or event listing pages.

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `EVENT#${eventId}`, sk: `ARTIST#${artistId}` |
| `byArtist` | GSI | gsi1 | gsi1pk: `ARTIST_EVENTS#${artistId}`, gsi1sk: `eventStartDateTime` |

The primary index lists all artists for a given event. The GSI lists all events for a given artist, sorted chronologically by start date.

## Functions

```typescript
import { EventArtist } from '@rasika/core'; // namespace: EventArtist.createEventArtist(), etc.
// or individually:
import { createEventArtist, getEventArtists, getEventsByArtist, deleteEventArtist } from '@rasika/core/domain/event-artist';
```

### CRUD
- `createEventArtist(input)` → EventArtist
- `deleteEventArtist(eventId, artistId)` → void

### Listing
- `getEventArtists(eventId, params?)` → `{ items: EventArtist[], nextToken?, hasMore }` — all artists for an event
- `getEventsByArtist(artistId, params?)` → `{ items: EventArtist[], nextToken?, hasMore }` — all events for an artist (time-sorted via GSI)

# Event Entity

ElectroDB Model: `event` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | yes | - | Unique identifier |
| `festivalId` | string | no | - | Linked festival |
| `festivalName` | string | no | - | Festival name (denormalized) |
| `posterUrl` | string | no | - | Poster image URL |
| `posterUploadId` | string | no | - | Upload reference |
| `title` | string | yes | - | Event title |
| `description` | string | no | - | Event description |
| `startDateTime` | string | yes | - | Start datetime (ISO) |
| `endDateTime` | string | no | - | End datetime (ISO) |
| `timezone` | string | yes | Asia/Kolkata | Timezone |
| `venueId` | string | no | - | Linked venue |
| `venueName` | string | no | - | Venue name (denormalized) |
| `organiserId` | string | no | - | Linked organiser |
| `organiserName` | string | no | - | Organiser name (denormalized) |
| `artists` | list\<map\> | no | [] | `{id, title, name, role}[]` |
| `artForm` | string | no | - | Art form classification |
| `tags` | list\<string\> | no | [] | Tags |
| `entryType` | string | no | free | Entry type |
| `ticketing` | any | no | - | Ticketing info |
| `contactInfo` | any | no | - | Contact details |
| `sponsors` | any | no | - | Sponsors list |
| `status` | string | yes | draft | draft/submitted/approved/rejected |
| `moderatorId` | string | no | - | Approver/rejecter ID |
| `moderatorNote` | string | no | - | Moderator feedback |
| `submittedAt` | string | no | - | Submission timestamp |
| `processedAt` | string | no | - | Processing timestamp |
| `extractionConfidence` | number | no | - | AI extraction confidence |
| `extractionRawResponse` | string | no | - | Raw AI response |
| `extractionTimestamp` | string | no | - | AI extraction time |
| `rsvpCount` | number | no | - | Denormalized attendance count (updated atomically by RSVP toggles) |
| `deletedAt` | string | no | - | Soft delete timestamp |
| `mergedIntoId` | string | no | - | Merge target ID |
| `createdBy` | string | yes | - | Creator user ID |
| `createdAt` | string | yes | auto | Creation timestamp |
| `updatedAt` | string | yes | auto | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `EVENT#${id}`, sk: `#METADATA` |
| `byCreator` | GSI | gsi1 | gsi1pk: `USER#${createdBy}`, gsi1sk: `EVENT#${createdAt}` |
| `byStatus` | GSI | gsi2 | gsi2pk: `EVENT_STATUS#${status}`, gsi2sk: `${startDateTime}` |
| `byFestival` | GSI | gsi3 | gsi3pk: `FESTIVAL#${festivalId}`, gsi3sk: `${startDateTime}` |
| `byVenue` | GSI | gsi4 | gsi4pk: `VENUE#${venueId}`, gsi4sk: `${startDateTime}` |
| `byOrganiser` | GSI | gsi5 | gsi5pk: `ORGANISER#${organiserId}`, gsi5sk: `${startDateTime}` |
| `byArtForm` | GSI | gsi6 | gsi6pk: `ARTFORM#${artForm}`, gsi6sk: `${startDateTime}` |

## Functions

```typescript
import { Event } from '@rasika/core'; // namespace: Event.createEvent(), Event.getEvent(), etc.
// or individually:
import { createEvent, getEvent, updateEvent, updateApprovedEvent, deleteEvent, softDeleteEvent, submitEvent, approveEvent, rejectEvent, forceSubmitEvent, listUpcomingEvents, listApprovedEvents, listApprovedEventsByMonth, listSubmittedEvents, listDraftEvents, listEventsByFestival, listEventsByVenue, listEventsByOrganiser, listEventsByArtForm, listEventsByTag, listEventsByArtist, extractAndCreateDrafts, mergeEvent, getEventMergeScore } from '@rasika/core/domain/event';
```

### CRUD
- `createEvent(input, userId, options?)` → Event
- `getEvent(id)` → Event | null
- `updateEvent(id, input)` → Event
- `updateApprovedEvent(id, input)` → Event
- `deleteEvent(id)` → void
- `softDeleteEvent(id)` → void

### Workflow
- `submitEvent(id, inputData, userId)` → Event
- `forceSubmitEvent(id)` → Event — bypasses normal validation (moderator use)
- `approveEvent(id, moderatorId)` → Event
- `rejectEvent(id, moderatorId, moderatorNote)` → Event

### Listing
- `listUpcomingEvents(params?)` → `{items: Event[], nextToken?, hasMore}`
- `listApprovedEvents(params?)` → `{items: Event[], nextToken?, hasMore}`
- `listApprovedEventsByMonth(yearMonth)` → Event[]
- `listSubmittedEvents(params?)` → `{items: Event[], nextToken?, hasMore}`
- `listDraftEvents(params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByFestival(festivalId, params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByVenue(venueId, params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByOrganiser(organiserId, params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByArtForm(artForm, params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByTag(tag, params?)` → `{items: Event[], nextToken?, hasMore}`
- `listEventsByArtist(artistId, params?)` → `{items: [], nextToken?, hasMore}`

### AI Extraction
- `extractAndCreateDrafts(posterUploadId, posterUrl, userId, posterHash?)` → `{extraction, festivalId?, eventIds}`

### Merging
- `mergeEvent(loserId, canonicalId)` → void
- `getEventMergeScore(id)` → number

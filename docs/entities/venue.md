# Venue Entity

ElectroDB Model: `venue` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier (KSUID) |
| `name` | string | yes | Venue name |
| `address` | map | no | `{street?, city?, state?, postalCode?, country?}` |
| `city` | string | no | City (denormalized for GSI query) |
| `mapLink` | string | no | Google Maps / mapping link (URL) |
| `description` | string (max 5000) | no | Free-text description of the venue |
| `venueType` | string | no | Type of venue — see enum below |
| `capacity` | number | no | Seating/standing capacity |
| `website` | string | no | Website URL |
| `phone` | string (max 30) | no | Phone number |
| `email` | string | no | Contact email |
| `photoUrl` | string | no | CDN URL of venue photo |
| `photoUploadId` | string | no | Upload ID of the S3 presigned-upload session |
| `amenities` | list\<string\> | no | Amenity tags — see enum below |
| `nearestTransit` | string (max 200) | no | Nearest transit info (e.g. "Chennai Central, 0.5 km") |
| `foundedYear` | number | no | Year the venue was established (1800–2100) |
| `socialLinks` | list\<map\> | no | `{platform: string, url: string}[]` |
| `deletedAt` | string | no | Soft-delete ISO timestamp |
| `mergedIntoId` | string | no | ID of canonical venue after a merge |
| `createdAt` | string | yes | Creation ISO timestamp (auto-set, read-only) |
| `updatedAt` | string | yes | Last-update ISO timestamp (auto-updated on every write) |

### `venueType` enum

`auditorium` | `sabha-hall` | `temple-hall` | `open-air` | `pandal` | `terrace` | `community-hall` | `heritage-building` | `university` | `other`

### `amenities` enum

`ac` | `parking` | `floor-seating` | `chair-seating` | `green-room` | `canteen` | `wheelchair-accessible` | `hearing-loop` | `elevator` | `restrooms` | `metro-nearby` | `bus-stop-nearby` | `sound-system` | `live-streaming` | `library` | `other`

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | — | pk: `VENUE#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `VENUE_NAME#${name}`, gsi1sk: `VENUE#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `VENUE_LIST`, gsi2sk: `${name}#${id}` |
| `byCity` | GSI | gsi3 | gsi3pk: `VENUE_CITY#${city}`, gsi3sk: `${name}#${id}` |

## Functions

```typescript
import { Venue } from '@rasika/core';
// or individual imports:
import { createVenue, getVenue, ... } from '@rasika/core/domain/venue';
```

### CRUD
- `createVenue(input: CreateVenueInput)` → `Venue`
- `getVenue(id)` → `Venue | null`
- `getVenueByName(name)` → `Venue | null`
- `updateVenue(id, input: UpdateVenueInput)` → `Venue`
- `deleteVenue(id)` → `void`
- `softDeleteVenue(id)` → `void`

### Listing
- `listVenues(params?)` → `{items: Venue[], nextToken?, hasMore}`
- `listVenuesByCity(city, params?)` → `{items: Venue[], nextToken?, hasMore}`

### Merging
- `mergeVenue(loserId, canonicalId)` → `void`
- `getVenueMergeScore(id)` → `number`

### Image Upload (via `@rasika/core` Image namespace)
- `Image.getImageUploadUrl('venue', fileName, contentType)` → `{uploadId, uploadUrl, imageUrl}`

  Generates a presigned S3 PUT URL valid for 5 minutes. Key pattern: `images/venue/{uploadId}/{fileName}`. Reuses the `EVENT_POSTERS_BUCKET` / `EVENT_POSTERS_CDN_URL` environment variables.

## Zod Schemas

```typescript
import { Venue } from '@rasika/core';

Venue.CreateVenueSchema  // z.object({ name, venueType?, address?, ... })
Venue.UpdateVenueSchema  // CreateVenueSchema.partial()

// Or from subpath (browser-safe, no AWS deps):
import { CreateVenueSchema, UpdateVenueSchema } from '@rasika/core/domain/venue/client';
```

## tRPC Router (`venueRouter`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `venue.get` | query | public | Get venue by ID |
| `venue.list` | query | public | Paginated list of all venues |
| `venue.getByName` | query | public | Get venue by exact name |
| `venue.byCity` | query | public | List venues by city |
| `venue.create` | mutation | editor | Create a new venue |
| `venue.update` | mutation | editor | Update venue fields |
| `venue.getImageUploadUrl` | mutation | editor | Get presigned S3 URL for photo upload |
| `venue.getMergeSuggestion` | query | moderator | Suggest canonical venue for merge |

## Web Routes

| Route | Description |
|-------|-------------|
| `/venues` | Venue listing |
| `/venues/:venueid` | Venue detail — shows photo, type badge, amenities, social links, events |
| `/venues/:venueid/edit` | 4-step edit wizard (About → Location → Contact & Facilities → Review) |
| `/venues/new` | Create venue (moderator only) |

## Edit Wizard Steps

1. **About** — name, venueType, foundedYear, capacity, description, photo upload
2. **Location** — address (street/city/state/postalCode/country), mapLink, nearestTransit
3. **Contact & Facilities** — phone, email, website, social links, amenities checkboxes
4. **Review** — userNote, Save Draft / Submit for Review

# Organiser Entity

ElectroDB Model: `organiser` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier (KSUID) |
| `name` | string | yes | Organiser name |
| `description` | string (max 5000) | no | Free-text description |
| `organisationType` | string | no | Type of organisation — see enum below |
| `city` | string (max 100) | no | City (denormalized for GSI query) |
| `address` | map | no | `{street?, city?, state?, postalCode?, country?}` |
| `website` | string | no | Website URL |
| `phone` | string (max 30) | no | Phone number |
| `email` | string | no | Contact email |
| `socialLinks` | list\<map\> | no | `{platform: string, url: string}[]` |
| `foundedYear` | number | no | Year the organisation was founded (1800–2100) |
| `logoUrl` | string | no | CDN URL of organisation logo |
| `logoUploadId` | string | no | Upload ID of the S3 presigned-upload session |
| `tags` | list\<string\> | no | Focus-area tags — see enum below |
| `venueId` | string | no | ID of the organiser's primary venue |
| `venueName` | string (max 200) | no | Display name of the primary venue (denormalized) |
| `deletedAt` | string | no | Soft-delete ISO timestamp |
| `mergedIntoId` | string | no | ID of canonical organiser after a merge |
| `createdAt` | string | yes | Creation ISO timestamp (auto-set, read-only) |
| `updatedAt` | string | yes | Last-update ISO timestamp (auto-updated on every write) |

### `organisationType` enum

`sabha` | `trust` | `ngo` | `temple` | `university` | `other`

### `tags` enum

`carnatic` | `hindustani` | `bharatanatyam` | `dance` | `instrumental` | `jugalbandi` | `lecture-demo` | `music-school` | `music-competition` | `award-conferring` | `publication` | `free-entry` | `ticketed` | `festival-organiser` | `year-round` | `charitable` | `other`

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | — | pk: `ORGANISER#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `ORGANISER_NAME#${name}`, gsi1sk: `ORGANISER#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `ORGANISER_LIST`, gsi2sk: `${name}#${id}` |
| `byCity` | GSI | gsi3 | gsi3pk: `ORGANISER_CITY#${city}`, gsi3sk: `${name}#${id}` |

## Functions

```typescript
import { Organiser } from '@rasika/core';
// or individual imports:
import { createOrganiser, getOrganiser, ... } from '@rasika/core/domain/organiser';
```

### CRUD
- `createOrganiser(input: CreateOrganiserInput)` → `Organiser`
- `getOrganiser(id)` → `Organiser | null`
- `getOrganiserByName(name)` → `Organiser | null`
- `updateOrganiser(id, input: UpdateOrganiserInput)` → `Organiser`
- `deleteOrganiser(id)` → `void`
- `softDeleteOrganiser(id)` → `void`

### Listing
- `listOrganisers(params?)` → `{items: Organiser[], nextToken?, hasMore}`

### Merging
- `mergeOrganiser(loserId, canonicalId)` → `void`
- `getOrganiserMergeScore(id)` → `number`

### Image Upload (via `@rasika/core` Image namespace)
- `Image.getImageUploadUrl('organiser', fileName, contentType)` → `{uploadId, uploadUrl, imageUrl}`

  Generates a presigned S3 PUT URL valid for 5 minutes. Key pattern: `images/organiser/{uploadId}/{fileName}`. Reuses the `EVENT_POSTERS_BUCKET` / `EVENT_POSTERS_CDN_URL` environment variables.

## Zod Schemas

```typescript
import { Organiser } from '@rasika/core';

Organiser.CreateOrganiserSchema  // z.object({ name, organisationType?, city?, tags?, ... })
Organiser.UpdateOrganiserSchema  // CreateOrganiserSchema.partial()

// Or from subpath (browser-safe, no AWS deps):
import { CreateOrganiserSchema, UpdateOrganiserSchema } from '@rasika/core/domain/organiser/client';
```

## tRPC Router (`organiserRouter`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `organiser.get` | query | public | Get organiser by ID |
| `organiser.list` | query | public | Paginated list of all organisers |
| `organiser.getByName` | query | public | Get organiser by exact name |
| `organiser.create` | mutation | editor | Create a new organiser |
| `organiser.update` | mutation | editor | Update organiser fields |
| `organiser.getImageUploadUrl` | mutation | editor | Get presigned S3 URL for logo upload |
| `organiser.getMergeSuggestion` | query | moderator | Suggest canonical organiser for merge |

## Web Routes

| Route | Description |
|-------|-------------|
| `/organisers` | Organiser listing |
| `/organisers/:organiserid` | Organiser detail — shows logo, type badge, contact info, tags, venue link, events |
| `/organisers/:organiserid/edit` | 3-step edit wizard (About → Location & Contact → Review) |
| `/organisers/new` | Create organiser (moderator only) |

## Edit Wizard Steps

1. **About** — name, organisationType, foundedYear, description, logo upload, tags checkboxes
2. **Location & Contact** — city, address, phone, email, website, social links, primary venue name/ID
3. **Review** — userNote, Save Draft / Submit for Review

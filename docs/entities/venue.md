# Venue Entity

ElectroDB Model: `venue` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Venue name |
| `address` | map | no | `{street, city, state, postalCode, country}` |
| `city` | string | no | City (denormalized) |
| `mapLink` | string | no | Google Maps link |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `VENUE#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `VENUE_NAME#${name}`, gsi1sk: `VENUE#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `VENUE_LIST`, gsi2sk: `${name}#${id}` |
| `byCity` | GSI | gsi3 | gsi3pk: `VENUE_CITY#${city}`, gsi3sk: `${name}#${id}` |

## Functions

```typescript
import { createVenue, getVenue, getVenueByName, updateVenue, deleteVenue, softDeleteVenue, listVenues, listVenuesByCity, mergeVenue, getVenueMergeScore } from '@rasika/core';
```

### CRUD
- `createVenue(input)` → Venue
- `getVenue(id)` → Venue | null
- `getVenueByName(name)` → Venue | null
- `updateVenue(id, input)` → Venue
- `deleteVenue(id)` → void
- `softDeleteVenue(id)` → void

### Listing
- `listVenues(params?)` → `{items: Venue[], nextToken?, hasMore}`
- `listVenuesByCity(city, params?)` → `{items: Venue[], nextToken?, hasMore}`

### Merging
- `mergeVenue(loserId, canonicalId)` → void
- `getVenueMergeScore(id)` → number

# Organiser Entity

ElectroDB Model: `organiser` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Organiser name |
| `description` | string | no | Description |
| `organisationType` | string | no | Type of organisation |
| `city` | string | no | City |
| `address` | map | no | `{street, city, state, postalCode, country}` |
| `website` | string | no | Website URL |
| `phone` | string | no | Phone number |
| `email` | string | no | Email address |
| `socialLinks` | list\<map\> | no | `{platform, url}[]` |
| `foundedYear` | number | no | Year founded |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `ORGANISER#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `ORGANISER_NAME#${name}`, gsi1sk: `ORGANISER#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `ORGANISER_LIST`, gsi2sk: `${name}#${id}` |
| `byCity` | GSI | gsi3 | gsi3pk: `ORGANISER_CITY#${city}`, gsi3sk: `${name}#${id}` |

## Functions

```typescript
import { createOrganiser, getOrganiser, getOrganiserByName, updateOrganiser, deleteOrganiser, softDeleteOrganiser, listOrganisers, mergeOrganiser, getOrganiserMergeScore } from '@rasika/core';
```

### CRUD
- `createOrganiser(input)` → Organiser
- `getOrganiser(id)` → Organiser | null
- `getOrganiserByName(name)` → Organiser | null
- `updateOrganiser(id, input)` → Organiser
- `deleteOrganiser(id)` → void
- `softDeleteOrganiser(id)` → void

### Listing
- `listOrganisers(params?)` → `{items: Organiser[], nextToken?, hasMore}`

### Merging
- `mergeOrganiser(loserId, canonicalId)` → void
- `getOrganiserMergeScore(id)` → number

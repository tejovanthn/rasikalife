# Award Entity

ElectroDB Model: `award` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Award name |
| `description` | string | no | Description |
| `rank` | number | no | Sort order / prominence ranking |
| `issuingOrganisationId` | string | no | Linked organiser ID |
| `issuingOrganisationName` | string | no | Organiser name (denormalized) |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `AWARD#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `AWARD_NAME#${name}`, gsi1sk: `AWARD#${id}` |
| `list` | GSI | gsi6 | gsi6pk: `AWARD_LIST`, gsi6sk: `${name}#${id}` |

## Functions

```typescript
import { createAward, getAward, getAwardByName, updateAward, softDeleteAward, listAwards, mergeAward } from '@rasika/core';
```

### CRUD
- `createAward(input)` → Award
- `getAward(id)` → Award | null
- `getAwardByName(name)` → Award | null
- `updateAward(id, input)` → Award
- `softDeleteAward(id)` → void

### Listing
- `listAwards()` → `Award[]` (sorted by `rank`, all pages)

### Merging
- `mergeAward(loserId, canonicalId)` → void

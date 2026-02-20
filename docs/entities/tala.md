# Tala Entity

ElectroDB Model: `tala` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Tala name |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `TALA#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `TALA_NAME#${name}`, gsi1sk: `TALA#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `TALA_LIST`, gsi2sk: `${name}#${id}` |

## Functions

```typescript
import { createTala, getTala, getTalaByName, updateTala, deleteTala, softDeleteTala, listTalas, mergeTala, getTalaMergeScore } from '@rasika/core';
```

### CRUD
- `createTala(input)` → Tala
- `getTala(id)` → Tala | null
- `getTalaByName(name)` → Tala | null
- `updateTala(id, input)` → Tala
- `deleteTala(id)` → void
- `softDeleteTala(id)` → void

### Listing
- `listTalas(params?)` → `{items: Tala[], nextToken?, hasMore}`

### Merging
- `mergeTala(loserId, canonicalId)` → void
- `getTalaMergeScore(id)` → number

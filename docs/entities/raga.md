# Raga Entity

ElectroDB Model: `raga` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Raga name |
| `description` | string | no | Description |
| `tradition` | string | no | Musical tradition |
| `arohanam` | string | no | Ascending scale |
| `avarohanam` | string | no | Descending scale |
| `rasa` | string | no | Emotional mood |
| `timeOfDay` | string | no | Traditional time of day |
| `season` | string | no | Season |
| `melaNumber` | number | no | Melakarta number (1-72) |
| `parentRaga` | map | no | `{id, name}` parent raga |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `RAGA#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `RAGA_NAME#${name}`, gsi1sk: `RAGA#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `RAGA_LIST`, gsi2sk: `${name}#${id}` |

## Functions

```typescript
import { Raga } from '@rasika/core'; // namespace: Raga.createRaga(), Raga.getRaga(), etc.
// or individually:
import { createRaga, getRaga, getRagaByName, getRagasByMelaNumber, updateRaga, deleteRaga, softDeleteRaga, listRagas, mergeRaga, getRagaMergeScore } from '@rasika/core/domain/raga';
```

### CRUD
- `createRaga(input)` → Raga
- `getRaga(id)` → Raga | null
- `getRagaByName(name)` → Raga | null
- `updateRaga(id, input)` → Raga
- `deleteRaga(id)` → void
- `softDeleteRaga(id)` → void

### Listing
- `listRagas(params?)` → `{items: Raga[], nextToken?, hasMore}`
- `getRagasByMelaNumber(melaNumber)` → `Raga[]` — all ragas with the given Melakarta number

### Merging
- `mergeRaga(loserId, canonicalId)` → void
- `getRagaMergeScore(id)` → number

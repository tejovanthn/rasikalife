# CompositionTala Entity (Junction)

ElectroDB Model: `composition_tala` v1, service: `rasikalife`

Links compositions to their associated talas.

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `compositionId` | string | yes | Composition ID (PK) |
| `talaId` | string | yes | Tala ID (SK) |
| `createdAt` | string | yes | Creation timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `COMPOSITION#${compositionId}`, sk: `TALA#${talaId}` |
| `byTala` | GSI | gsi1 | gsi1pk: `TALA#${talaId}`, gsi1sk: `COMPOSITION#${compositionId}` |

## Functions

```typescript
import { CompositionTala } from '@rasika/core'; // namespace: CompositionTala.createCompositionTala(), etc.
// or individually:
import { createCompositionTala, getCompositionTalas, getCompositionsByTala, deleteCompositionTala } from '@rasika/core/domain/composition_tala';
```

- `createCompositionTala(input)` → CompositionTala
- `getCompositionTalas(compositionId, params?)` → `{items: CompositionTala[], nextToken?, hasMore}`
- `getCompositionsByTala(talaId, params?)` → `{items: CompositionTala[], nextToken?, hasMore}`
- `deleteCompositionTala(compositionId, talaId)` → void

# CompositionRaga Entity (Junction)

ElectroDB Model: `composition_raga` v1, service: `rasikalife`

Links compositions to their associated ragas.

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `compositionId` | string | yes | Composition ID (PK) |
| `ragaId` | string | yes | Raga ID (SK) |
| `createdAt` | string | yes | Creation timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `COMPOSITION#${compositionId}`, sk: `RAGA#${ragaId}` |
| `byRaga` | GSI | gsi1 | gsi1pk: `RAGA#${ragaId}`, gsi1sk: `COMPOSITION#${compositionId}` |

## Functions

```typescript
import { createCompositionRaga, getCompositionRagas, getCompositionsByRaga, deleteCompositionRaga } from '@rasika/core';
```

- `createCompositionRaga(input)` → CompositionRaga
- `getCompositionRagas(compositionId, params?)` → `{items: CompositionRaga[], nextToken?, hasMore}`
- `getCompositionsByRaga(ragaId, params?)` → `{items: CompositionRaga[], nextToken?, hasMore}`
- `deleteCompositionRaga(compositionId, ragaId)` → void

# Composition Entity

ElectroDB Model: `composition` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `title` | string | yes | Composition title |
| `composerId` | string | yes | Composer artist ID |
| `composer` | map | yes | `{id, name}` |
| `language` | string | yes | Language |
| `lyricsV1` | list\<map\> | no | `{type, order, text, number?, ragaName?}[]` |
| `ragas` | list\<map\> | no | `{id, name}[]` |
| `talas` | list\<map\> | no | `{id, name}[]` |
| `sourceAttribution` | string | no | Source attribution |
| `compositionType` | string | no | Type of composition |
| `description` | string | no | Description |
| `meaning` | string | no | Meaning/translation |
| `version` | number | yes | Version number |
| `lastEditedBy` | string | no | Last editor ID |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `COMPOSITION#${id}`, sk: `#METADATA` |
| `byComposer` | GSI | gsi2 | gsi2pk: `ARTIST#${composerId}`, gsi2sk: `COMPOSITION#${id}` |
| `byLanguage` | GSI | gsi3 | gsi3pk: `LANGUAGE#${language}`, gsi3sk: `COMPOSITION#${id}` |
| `byName` | GSI | gsi4 | gsi4pk: `COMPOSITION_NAME#${title}`, gsi4sk: `COMPOSITION#${id}` |
| `list` | GSI | gsi5 | gsi5pk: `COMPOSITION_LIST`, gsi5sk: `${title}#${id}` |

## Functions

```typescript
import { Composition } from '@rasika/core'; // namespace: Composition.createComposition(), etc.
// or individually:
import { createComposition, getComposition, updateComposition, deleteComposition, softDeleteComposition, listCompositions, getCompositionsByName, getCompositionsByComposer, getCompositionsByRaga, getCompositionsByTala, getCompositionsByLanguage, mergeComposition, getCompositionMergeScore } from '@rasika/core/domain/composition';
```

### CRUD
- `createComposition(input)` → Composition
- `getComposition(id)` → CompositionWithRelations | null
- `updateComposition(id, input)` → Composition
- `deleteComposition(id)` → void
- `softDeleteComposition(id)` → void

### Listing
- `listCompositions(params?)` → `{items: CompositionWithRelations[], nextToken?, hasMore}`
- `getCompositionsByName(name)` → CompositionWithRelations[]
- `getCompositionsByComposer(composerId, params?)` → `{items, nextToken?, hasMore}`
- `getCompositionsByRaga(ragaId, params?)` → `{items, nextToken?, hasMore}`
- `getCompositionsByTala(talaId, params?)` → `{items, nextToken?, hasMore}`
- `getCompositionsByLanguage(language, params?)` → `{items, nextToken?, hasMore}`

### Merging
- `mergeComposition(loserId, canonicalId)` → void
- `getCompositionMergeScore(id)` → number

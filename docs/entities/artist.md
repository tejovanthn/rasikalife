# Artist Entity

ElectroDB Model: `artist` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Artist name |
| `title` | string | no | Honorific (e.g., "Sri", "Smt.") |
| `gurus` | list\<map\> | no | Teachers `{id, name}[]` |
| `deletedAt` | string | no | Soft delete timestamp |
| `mergedIntoId` | string | no | Merge target ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `ARTIST#${id}`, sk: `#METADATA` |
| `byName` | GSI | gsi1 | gsi1pk: `ARTIST_NAME#${name}`, gsi1sk: `ARTIST#${id}` |
| `list` | GSI | gsi2 | gsi2pk: `ARTIST_LIST`, gsi2sk: `${name}#${id}` |

## Functions

```typescript
import { createArtist, getArtist, getArtistByName, updateArtist, deleteArtist, softDeleteArtist, listArtists, mergeArtist, getArtistMergeScore } from '@rasika/core';
```

### CRUD
- `createArtist(input)` → Artist
- `getArtist(id)` → Artist | null
- `getArtistByName(name)` → Artist | null
- `updateArtist(id, input)` → Artist
- `deleteArtist(id)` → void
- `softDeleteArtist(id)` → void

### Listing
- `listArtists(params?)` → `{items: Artist[], nextToken?, hasMore}`

### Merging
- `mergeArtist(loserId, canonicalId)` → void
- `getArtistMergeScore(id)` → number

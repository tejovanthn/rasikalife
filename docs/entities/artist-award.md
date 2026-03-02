# ArtistAward Entity (Junction)

ElectroDB Model: `artistAward` v1, service: `rasikalife`

Links artists to awards they have received.

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `artistId` | string | yes | Artist ID (PK) |
| `artistName` | string | yes | Artist name (denormalized) |
| `awardId` | string | yes | Award ID (SK) |
| `awardName` | string | yes | Award name (denormalized) |
| `rank` | number | no | Sort order |
| `year` | number | no | Year award was received |
| `category` | string | no | Award category |
| `notes` | string | no | Additional notes |
| `createdAt` | string | yes | Creation timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `ARTIST#${artistId}`, sk: `AWARD#${awardId}` |
| `byAward` | GSI | gsi1 | gsi1pk: `AWARD#${awardId}`, gsi1sk: `ARTIST#${artistId}` |

## Functions

```typescript
import { addArtistAward, removeArtistAward, getArtistAwards, getAwardRecipients } from '@rasika/core';
```

- `addArtistAward(input)` → ArtistAward
- `removeArtistAward(artistId, awardId)` → void
- `getArtistAwards(artistId)` → `ArtistAward[]` (sorted by `rank`)
- `getAwardRecipients(awardId)` → `ArtistAward[]` (sorted by `year`)

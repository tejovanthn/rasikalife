# KSUID Implementation - Time-Ordered IDs

## Introduction

KSUID (K-Sortable Unique Identifier) provides time-sortable, globally unique identifiers that are ideal for DynamoDB. This document covers our KSUID implementation for the Rasika.life platform, explaining why we chose KSUID over traditional UUIDs and how we leverage its unique properties.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)

## Why KSUID?

- **Time-sortable**: Natural ordering for time-based queries
- **Globally unique**: 128-bit random payload
- **URL-safe**: Base62 encoding
- **Compact**: 20 characters vs 36 for UUID

## Implementation

### ID Generation

```typescript
import KSUID from 'ksuid';

export const generateId = (): string => {
  return KSUID.randomSync().string;
};
```

### Utility Functions

```typescript
export const getTimeBasedShard = (id: string, shardCount = 10): number => {
  const timestamp = Number.parseInt(id.substring(0, 4), 36);
  return timestamp % shardCount;
};

export const getTimestampFromId = (id: string): Date => {
  const timestamp = Number.parseInt(id.substring(0, 4), 36);
  return new Date(timestamp * 1000);
};
```

## Usage

```typescript
import { generateId } from '../../utils';
import { ArtistEntity } from './entity';

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();
  return result.data as Artist;
}
```

## Benefits

1. **Write Distribution**: Time-based parts distribute writes
2. **Natural Ordering**: IDs can be sorted by creation time
3. **Compact Size**: Smaller than UUID strings
4. **Debuggability**: Easy to extract timestamp from ID

## Best Practices

1. **Consistent Usage**: Use `generateId()` for all new entities
2. **Shard Awareness**: Use `getTimeBasedShard()` for distribution
3. **Timestamp Extraction**: Use `getTimestampFromId()` for queries

## Conclusion

KSUID provides an excellent balance of uniqueness, sortability, and compactness for DynamoDB identifiers. Its time-sortable nature and fixed 27-character length make it particularly well-suited for building SEO-friendly URLs and efficient database queries.

**Related Reading:**
- [SEO-Friendly URLs with KSUID](./seo-friendly-urls-ksuid.md) - Using KSUIDs in URLs
- [Single-Table Design Patterns](./single-table-design-patterns.md) - ID strategies in single-table design
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md) - Using KSUIDs with ElectroDB
- [Cursor-Based Pagination](./cursor-pagination-dynamodb.md) - Time-sortable pagination benefits

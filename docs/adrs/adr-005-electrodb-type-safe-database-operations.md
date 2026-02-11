# ADR-005: ElectroDB for Type-Safe Database Operations

## Status
Accepted

## Context
We needed a database access layer that provides:
- Type safety and compile-time validation
- Excellent developer experience
- Query flexibility
- Minimal boilerplate

## Decision
Use ElectroDB for type-safe database operations.

## Consequences

### Positive
- ✅ **Type safety**: 100% compile-time validation
- ✅ **Developer experience**: Excellent IDE support
- ✅ **Query flexibility**: Built-in query builders
- ✅ **Maintainability**: Clear entity definitions

### Negative
- ❌ **Learning curve**: Team needs to learn ElectroDB patterns
- ❌ **Bundle size**: Additional dependency

## Implementation

### Entity Definition

```typescript
import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ArtistEntity = new Entity(
  {
    model: {
      entity: 'artist',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'ARTIST#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byName: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['name'], template: 'ARTIST_NAME#${name}' },
        sk: { field: 'gsi1sk', composite: ['id'], template: 'ARTIST#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Artist = EntityItem<typeof ArtistEntity>;
```

### Domain Functions

```typescript
import { generateId } from '../../utils';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('artist', input.name);
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist | null> {
  const result = await ArtistEntity.get({ id }).go();
  return result.data as Artist | null;
}

export async function getArtistByName(name: string): Promise<Artist | null> {
  const result = await ArtistEntity.query.byName({ name }).go();
  return result.data?.[0] || null;
}

export async function updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  return result.data as Artist;
}

export async function deleteArtist(id: string): Promise<void> {
  await ArtistEntity.delete({ id }).go();
}

export async function listArtists(params?: { limit?: number; nextToken?: string }) {
  const limit = params?.limit || 20;
  const result = await ArtistEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

## Results

- **Type safety**: 100% compile-time validation
- **Developer experience**: Excellent with IDE autocomplete
- **Code quality**: Higher quality with type safety

## References

- [ElectroDB Documentation](https://github.com/tywalch/electrodb)
- [ElectroDB Best Practices](https://github.com/tywalch/electrodb#best-practices)

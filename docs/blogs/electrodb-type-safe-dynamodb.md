# ElectroDB Implementation - Type-Safe DynamoDB

## Introduction

ElectroDB provides type-safe database operations for DynamoDB single-table design. This document covers our ElectroDB implementation patterns for the Rasika.life platform, including entity definitions, domain service patterns, validation schemas, and best practices for maintaining type safety throughout your data layer.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)

## Entity Definition

### Basic Entity Structure

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
      id: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
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
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'ARTIST#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byName: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['name'],
          template: 'ARTIST_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'ARTIST#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'ARTIST_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Artist = EntityItem<typeof ArtistEntity>;
```

### Complex Entity with Relationships

```typescript
export const CompositionEntity = new Entity(
  {
    model: {
      entity: 'composition',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      title: { type: 'string', required: true },
      composerId: { type: 'string', required: true },
      composer: {
        type: 'map',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        required: true,
      },
      language: { type: 'string', required: true },
      lyricsV1: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            type: { type: 'string', required: true },
            order: { type: 'number', required: true },
            text: { type: 'string', required: true },
          },
        },
        required: false,
        default: () => [],
      },
      ragas: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
          },
        },
        required: false,
        default: () => [],
      },
      talas: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
          },
        },
        required: false,
        default: () => [],
      },
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
        pk: { field: 'pk', composite: ['id'], template: 'COMPOSITION#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byComposer: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['composerId'], template: 'ARTIST#${composerId}' },
        sk: { field: 'gsi2sk', composite: ['id'], template: 'COMPOSITION#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Composition = EntityItem<typeof CompositionEntity>;
```

## Domain Service Pattern

### Artist Domain Functions

```typescript
import { generateId } from '../../utils';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();  // Using KSUID for time-sortable IDs
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
    cursor: params?.nextToken,  // Cursor-based pagination
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

## Validation Schemas

```typescript
import { z } from 'zod';

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateArtistSchema = CreateArtistSchema.partial();
```

## Error Handling

```typescript
import { ApplicationError, ErrorCode } from '../constants';

export function notFoundError(entity: string, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_NOT_FOUND` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} not found`);
}

export function createFailedError(entity: string, name: string): ApplicationError {
  const code = `${entity.toUpperCase()}_CREATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `Failed to create ${entity}: ${name}`);
}

export function updateFailedError(entity: string, id: string): ApplicationError {
  const code = `${entity.toUpperCase()}_UPDATE_FAILED` as ErrorCode;
  return new ApplicationError(code, `${entity} with ID ${id} update failed`);
}
```

## Best Practices

### 1. Simple Entity Attributes
Keep entity attributes minimal. Only include what's necessary for the domain.

### 2. Use Default Values
Use ElectroDB's `default` and `set` for automatic timestamp management.

### 3. Watch for Changes
Use `watch: '*'` on updatedAt to automatically update on any change.

### 4. Type Inference
Export types using `EntityItem<typeof Entity>` for automatic type inference.

### 5. Query Patterns
Design GSIs for specific access patterns rather than general queries.

## Performance Considerations

- Use `readOnly: true` for fields that shouldn't be updated
- Limit GSI projections to necessary attributes
- Use batch operations for multiple items
- Implement caching for frequently accessed data

## Conclusion

ElectroDB provides excellent type safety for DynamoDB operations. By following these patterns, we maintain consistent, type-safe database access throughout the codebase. Combined with single-table design and proper indexing strategies, ElectroDB enables building scalable, maintainable DynamoDB applications.

**Related Reading:**
- [Single-Table Design Patterns](./single-table-design-patterns.md) - Core design patterns for DynamoDB
- [KSUID Implementation](./ksuid-vs-uuid-dynamodb.md) - Time-sortable unique identifiers
- [Cursor-Based Pagination](./cursor-pagination-dynamodb.md) - Efficient pagination with ElectroDB
- [Denormalization Patterns](./denormalization-performance-patterns.md) - Performance optimization strategies
- [Cascade Updates](./cascade-updates-denormalized-data.md) - Maintaining consistency
- [Error Handling Patterns](./error-handling-validation-patterns.md) - Validation and error handling
- [Testing Patterns](./testing-patterns-dynamodb.md) - Testing DynamoDB applications

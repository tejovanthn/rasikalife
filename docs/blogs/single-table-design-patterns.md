# Single-Table Design Patterns - Modeling Complex Relationships

## Introduction

Single-table design is a powerful pattern for DynamoDB that enables efficient data modeling and query patterns. This document covers our single-table design implementation for the Rasika.life platform, focusing on entity prefixes, GSI strategies, and relationship modeling.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)

## Key Concepts

### Entity Prefixes

```typescript
export enum EntityPrefix {
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION',
  USER = 'USER',
  RAGA = 'RAGA',
  TALA = 'TALA',
  EVENT = 'EVENT',
}
```

### Secondary Prefixes

```typescript
export enum SecondaryPrefix {
  METADATA = '#METADATA',
}
```

## Entity Design Patterns

### Simple Entity (Artist)

```typescript
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
      list: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: [], template: 'ARTIST_LIST' },
        sk: { field: 'gsi2sk', composite: ['name', 'id'], template: '${name}#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);
```

### Entity with Relationships (Composition)

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
      byLanguage: {
        index: 'gsi3',
        pk: { field: 'gsi3pk', composite: ['language'], template: 'LANGUAGE#${language}' },
        sk: { field: 'gsi3sk', composite: ['id'], template: 'COMPOSITION#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);
```

## Key Design Patterns

### 1. Primary Key Pattern

```
PK = 'ENTITY_TYPE#ENTITY_ID'
SK = '#METADATA'
```

### 2. GSI Patterns

- **byName**: For name-based queries
- **list**: For listing all entities
- **byComposer**: For finding compositions by artist
- **byLanguage**: For language-based queries

### 3. Automatic Timestamps

```typescript
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
```

## Best Practices

### 1. Minimal Attributes
Keep entity attributes minimal.

### 2. Use Defaults
Use ElectroDB defaults for timestamps.

### 3. Watch for Changes
Use `watch: '*'` on updated fields.

### 4. Read-Only Fields
Mark fields that shouldn't be updated as `readOnly: true`.

### 5. GSI Design
Design GSIs for specific access patterns.

## Conclusion

Single-table design with ElectroDB provides efficient, type-safe data access. By following these patterns - consistent key formatting, strategic denormalization, and proper GSI usage - we achieve fast queries and scalable data modeling.

**Related Reading:**
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md) - Type-safe entity definitions
- [Denormalization Patterns](./denormalization-performance-patterns.md) - Embedding related data
- [Cascade Updates](./cascade-updates-denormalized-data.md) - Maintaining denormalized data
- [KSUID Implementation](./ksuid-vs-uuid-dynamodb.md) - ID generation strategy
- [Cursor-Based Pagination](./cursor-pagination-dynamodb.md) - Efficient pagination
- [Testing Patterns](./testing-patterns-dynamodb.md) - Testing single-table design

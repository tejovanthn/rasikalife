# ADR-001: Single-Table DynamoDB Design

## Status
Accepted

## Context
We needed to design a scalable data layer for the Rasika.life platform with:
- Simple entity modeling
- Type-safe database operations
- Efficient query patterns
- Minimal boilerplate

## Decision
Implement single DynamoDB table design using ElectroDB for type-safe entity modeling.

## Consequences

### Positive
- ✅ **Type safety**: ElectroDB eliminates runtime errors
- ✅ **Query flexibility**: Composite keys enable complex queries
- ✅ **Developer productivity**: IDE autocomplete and type checking
- ✅ **Simple modeling**: Straightforward entity definitions

### Negative
- ❌ **Learning curve**: Team needs to learn single-table patterns
- ❌ **Complex queries**: Some queries require careful key design

## Implementation

### Entity Definition Pattern

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
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);
```

### Type Inference

```typescript
export type Artist = EntityItem<typeof ArtistEntity>;
```

## Results

- **Type safety**: 100% compile-time validation
- **Developer experience**: Excellent with IDE autocomplete
- **Query performance**: Optimized with appropriate GSIs

## References

- [ElectroDB Documentation](https://github.com/tywalch/electrodb)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

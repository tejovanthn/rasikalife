# Denormalization Patterns for Performance - Read Optimization

## Introduction

Denormalization is a fundamental technique for optimizing read performance in NoSQL databases. By strategically duplicating data, you can eliminate expensive joins and enable single-query access to related information. This blog post explores denormalization patterns used in the Rasika.life platform, covering embedded documents, array storage, trade-offs, and maintenance strategies.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)

## The Normalization vs. Denormalization Trade-off

### Normalized Approach (SQL)

```sql
-- Separate tables (normalized)
CREATE TABLE compositions (
  id UUID PRIMARY KEY,
  title VARCHAR(200),
  composer_id UUID REFERENCES artists(id),
  language VARCHAR(50)
);

CREATE TABLE artists (
  id UUID PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE ragas (
  id UUID PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE composition_ragas (
  composition_id UUID REFERENCES compositions(id),
  raga_id UUID REFERENCES ragas(id),
  PRIMARY KEY (composition_id, raga_id)
);

-- Query requires multiple joins
SELECT
  c.title,
  a.name as composer_name,
  array_agg(r.name) as raga_names
FROM compositions c
JOIN artists a ON c.composer_id = a.id
LEFT JOIN composition_ragas cr ON c.id = cr.composition_id
LEFT JOIN ragas r ON cr.raga_id = r.id
WHERE c.id = '...'
GROUP BY c.id, c.title, a.name;
```

**Pros:**
- ✅ No data duplication
- ✅ Single source of truth
- ✅ Easy updates (one place)
- ✅ Referential integrity

**Cons:**
- ❌ Requires joins (expensive)
- ❌ Multiple queries needed
- ❌ Complex query logic
- ❌ Poor performance at scale

### Denormalized Approach (DynamoDB)

```typescript
// Single document with embedded data (denormalized)
interface Composition {
  id: string;
  title: string;
  composerId: string;

  // Embedded composer (denormalized)
  composer: {
    id: string;
    name: string;
  };

  // Embedded ragas array (denormalized)
  ragas: Array<{
    id: string;
    name: string;
  }>;

  // Embedded talas array (denormalized)
  talas: Array<{
    id: string;
    name: string;
  }>;
}

// Single query - no joins!
const composition = await CompositionEntity.get({ id }).go();
console.log(composition.data.composer.name);      // Direct access
console.log(composition.data.ragas[0].name);      // Direct access
```

**Pros:**
- ✅ Single query access
- ✅ Faster reads (no joins)
- ✅ Simpler query logic
- ✅ Better performance at scale

**Cons:**
- ❌ Data duplication
- ❌ Cascade updates needed
- ❌ Larger item sizes
- ❌ Eventual consistency

**Related Reading:** [Single-Table Design Patterns](./single-table-design-patterns.md)

## Denormalization Patterns

### 1. Embedded Object Pattern

**Use Case:** One-to-one or many-to-one relationships where child data rarely changes

```typescript
// Composition entity with embedded composer
export const CompositionEntity = new Entity({
  model: {
    entity: 'composition',
    version: '1',
    service: 'rasikalife',
  },
  attributes: {
    id: { type: 'string', required: true },
    title: { type: 'string', required: true },

    // Store composer ID for relationships
    composerId: { type: 'string', required: true },

    // Embed composer data for fast display
    composer: {
      type: 'map',
      properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
      },
      required: true,
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
});

// Usage
const composition = await CompositionEntity.get({ id }).go();
console.log(composition.data.composer.name);  // No join needed!
```

**When to Use:**
- Display names and basic info
- Data that rarely changes
- Small, bounded data sets

**When to Avoid:**
- Frequently changing data
- Large nested objects
- Deep nesting (>2 levels)

### 2. Embedded Array Pattern

**Use Case:** One-to-many relationships with small, bounded collections

```typescript
// Composition with embedded ragas and talas arrays
export const CompositionEntity = new Entity({
  attributes: {
    id: { type: 'string', required: true },
    title: { type: 'string', required: true },

    // Embed ragas array (usually 1-3 ragas per composition)
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

    // Embed talas array (usually 1 tala per composition)
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
  },
});

// Usage
const composition = await CompositionEntity.get({ id }).go();
console.log(composition.data.ragas.map(r => r.name).join(', '));  // Direct access!
```

**When to Use:**
- Small collections (typically < 10 items)
- Bounded size (won't grow indefinitely)
- Display data (names, labels)
- Frequently accessed together

**When to Avoid:**
- Unbounded collections
- Large items (>10 items)
- Frequently updated items
- Deep nesting

### 3. Partial Denormalization Pattern

**Use Case:** Store only essential fields, query for full details when needed

```typescript
// Store minimal user info in edits
interface Edit {
  id: string;
  entityId: string;

  // Store only user ID for relationships
  userId: string;

  // Denormalize just the user name for display
  userName: string;  // Easier to display in lists

  // Fetch full user details when needed:
  // const fullUser = await User.getUser(edit.userId);
}

// Benefits:
// - Fast list display (name available)
// - Smaller item size (not full user object)
// - Detailed data fetched on demand
```

### 4. Computed Denormalization Pattern

**Use Case:** Store aggregated or computed values for fast access

```typescript
// Artist with computed statistics
interface Artist {
  id: string;
  name: string;

  // Denormalized computed fields
  compositionCount: number;     // Updated when compositions added/removed
  viewCount: number;            // Updated on each view
  lastCompositionDate: string;  // Updated when new composition added
}

// Update composition count when creating composition
export async function createComposition(input: CreateCompositionInput): Promise<Composition> {
  const composition = await CompositionEntity.create(input).go();

  // Update artist's composition count
  await ArtistEntity.update({ id: input.composerId })
    .add({ compositionCount: 1 })
    .go();

  return composition.data;
}
```

## Real-World Example: Composition Entity

### Full Entity Definition

```typescript
// packages/core/src/domain/composition/entity.ts
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

      // Composer relationship: ID + embedded data
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

      // Structured lyrics with metadata
      lyricsV1: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            type: { type: 'string', required: true },      // pallavi, anupallavi, charanam
            order: { type: 'number', required: true },     // Display order
            text: { type: 'string', required: true },      // Actual lyrics
            number: { type: 'number', required: false },   // Verse number (for charanam)
            ragaName: { type: 'string', required: false }, // For ragamalika compositions
          },
        },
        required: false,
        default: () => [],
      },

      // Embedded ragas array
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

      // Embedded talas array
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

      sourceAttribution: { type: 'string', required: false },

      // Metadata
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
      version: {
        type: 'number',
        required: true,
        default: () => 1,
      },
      lastEditedBy: { type: 'string', required: false },
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

### Benefits in Practice

```typescript
// Single query gets everything for display
const composition = await CompositionEntity.get({ id }).go();

// Render without additional queries
return (
  <div>
    <h1>{composition.data.title}</h1>
    <p>Composed by: {composition.data.composer.name}</p>
    <p>Ragas: {composition.data.ragas.map(r => r.name).join(', ')}</p>
    <p>Talas: {composition.data.talas.map(t => t.name).join(', ')}</p>

    {composition.data.lyricsV1.map(verse => (
      <div key={verse.order}>
        <h3>{verse.type}</h3>
        <p>{verse.text}</p>
      </div>
    ))}
  </div>
);
```

## Maintaining Consistency

### Cascade Updates

When denormalized data changes, cascade updates to all copies:

```typescript
// When artist name changes, update all compositions
export async function updateArtist(
  id: string,
  input: UpdateArtistInput
): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  // Cascade name change to compositions
  if (input.name) {
    await cascadeComposerNameUpdate(id, input.name);
  }

  return result.data;
}
```

**Related Reading:** [Cascade Updates in Denormalized Data](./cascade-updates-denormalized-data.md)

### Relationship Tables

Maintain separate relationship tables for queries:

```typescript
// CompositionRaga table for querying compositions by raga
export const CompositionRagaEntity = new Entity({
  attributes: {
    compositionId: { type: 'string', required: true },
    ragaId: { type: 'string', required: true },
  },
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['compositionId'], template: 'COMPOSITION#${compositionId}' },
      sk: { field: 'sk', composite: ['ragaId'], template: 'RAGA#${ragaId}' },
    },
    byRaga: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['ragaId'], template: 'RAGA#${ragaId}' },
      sk: { field: 'gsi1sk', composite: ['compositionId'], template: 'COMPOSITION#${compositionId}' },
    },
  },
});

// Query: Find all compositions in Bhairavi raga
const result = await CompositionRagaEntity.query
  .byRaga({ ragaId: 'bhairavi-id' })
  .go();
```

## Decision Framework

### When to Denormalize

**Denormalize if:**
- ✅ Data is read frequently
- ✅ Data changes infrequently
- ✅ Related data is always displayed together
- ✅ Collection size is bounded
- ✅ Read performance is critical

**Don't denormalize if:**
- ❌ Data changes frequently
- ❌ Collection size is unbounded
- ❌ Data is rarely accessed
- ❌ Strong consistency is required
- ❌ Storage cost is critical

### What to Denormalize

**Good candidates:**
- **Display names**: Artist names, raga names
- **Small collections**: Tags, categories, labels
- **Static data**: Types, statuses, enums
- **Computed values**: Counts, aggregates
- **Metadata**: Created by, updated by

**Poor candidates:**
- **Large objects**: Full user profiles, full descriptions
- **Unbounded collections**: Comments, followers, events
- **Frequently changing data**: View counts, like counts
- **Sensitive data**: Passwords, tokens, personal info

### How Much to Denormalize

```typescript
// ❌ Too little - still requires join
interface Composition {
  composerId: string;  // Only ID - must fetch composer
}

// ✅ Just right - essential display data
interface Composition {
  composerId: string;  // For relationships
  composer: {          // For display
    id: string;
    name: string;
  };
}

// ❌ Too much - bloated document
interface Composition {
  composerId: string;
  composer: {
    id: string;
    name: string;
    bio: string;           // Rarely displayed
    imageUrl: string;
    socialMedia: {...};    // Not needed here
    compositionCount: number;
    // ... entire artist object
  };
}
```

## Testing Denormalized Data

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createComposition } from '@rasika/core';

describe('Denormalized Composition', () => {
  it('should embed composer data on create', async () => {
    const artist = await createArtist({ name: 'Thyagaraja' });

    const composition = await createComposition({
      title: 'Endaro Mahanubhavulu',
      composerId: artist.id,
      composer: {
        id: artist.id,
        name: artist.name,
      },
    });

    expect(composition.composer.name).toBe('Thyagaraja');
  });

  it('should cascade composer name update', async () => {
    const artist = await createArtist({ name: 'Old Name' });
    const composition = await createComposition({
      title: 'Test Song',
      composerId: artist.id,
      composer: { id: artist.id, name: artist.name },
    });

    // Update artist name
    await updateArtist(artist.id, { name: 'New Name' });

    // Wait for cascade
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify composition updated
    const updated = await getComposition(composition.id);
    expect(updated.composer.name).toBe('New Name');
  });
});
```

### Consistency Tests

```typescript
describe('Denormalization Consistency', () => {
  it('should maintain consistency between composer and compositions', async () => {
    const artist = await createArtist({ name: 'Artist Name' });

    // Create multiple compositions
    const comp1 = await createComposition({
      title: 'Song 1',
      composerId: artist.id,
      composer: { id: artist.id, name: artist.name },
    });

    const comp2 = await createComposition({
      title: 'Song 2',
      composerId: artist.id,
      composer: { id: artist.id, name: artist.name },
    });

    // Update artist name
    await updateArtist(artist.id, { name: 'Updated Name' });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify all compositions updated
    const compositions = await getCompositionsByArtist(artist.id);
    compositions.items.forEach(comp => {
      expect(comp.composer.name).toBe('Updated Name');
    });
  });
});
```

## Performance Impact

### Read Performance

```typescript
// Normalized (SQL) - 3 queries
// Query 1: Get composition
const composition = await db.query('SELECT * FROM compositions WHERE id = ?', [id]);
// Query 2: Get composer
const composer = await db.query('SELECT * FROM artists WHERE id = ?', [composition.composer_id]);
// Query 3: Get ragas
const ragas = await db.query('SELECT r.* FROM ragas r JOIN composition_ragas cr ON r.id = cr.raga_id WHERE cr.composition_id = ?', [id]);

// Denormalized (DynamoDB) - 1 query
const composition = await CompositionEntity.get({ id }).go();
// All data included: composer, ragas, talas
```

**Read Performance:**
- **Normalized**: 3+ queries, multiple round trips
- **Denormalized**: 1 query, single round trip
- **Speed improvement**: 3-10x faster

### Write Performance

```typescript
// Normalized (SQL) - 1 update
UPDATE artists SET name = 'New Name' WHERE id = ?;

// Denormalized (DynamoDB) - 1 + N updates
// 1. Update artist
await ArtistEntity.update({ id }).set({ name: 'New Name' }).go();
// 2. Update all compositions (cascade)
await cascadeComposerNameUpdate(id, 'New Name');  // N updates
```

**Write Performance:**
- **Normalized**: Single update
- **Denormalized**: 1 + N updates (cascade)
- **Trade-off**: Slower writes for faster reads

### Storage Cost

```typescript
// Normalized: 3 items
// Artist: 100 bytes
// Composition: 200 bytes (no embedded data)
// CompositionRaga: 50 bytes
// Total: 350 bytes

// Denormalized: 2 items
// Artist: 100 bytes
// Composition: 400 bytes (with embedded data)
// Total: 500 bytes (43% larger)

// Trade-off: More storage for better performance
```

## Best Practices

### 1. Denormalize Display Data Only
```typescript
// ✅ Good - only what's displayed
composer: { id: string; name: string }

// ❌ Bad - entire object
composer: { ...entireArtistObject }
```

### 2. Keep Foreign Keys
```typescript
// Always store both ID and embedded data
composerId: string;      // For relationships and cascade
composer: { id, name };  // For display
```

### 3. Implement Cascade Updates
```typescript
// Always cascade changes to denormalized data
if (input.name) {
  await cascadeComposerNameUpdate(id, input.name);
}
```

### 4. Bound Collection Sizes
```typescript
// ✅ Good - bounded
ragas: Array<{ id, name }>;  // Usually 1-3 ragas

// ❌ Bad - unbounded
comments: Array<Comment>;    // Could be thousands
```

### 5. Version Fields for Updates
```typescript
// Track version for conditional updates
version: number;
lastEditedBy: string;
updatedAt: string;
```

## Common Pitfalls

### 1. Over-Denormalization
**Problem**: Storing too much data

**Solution**: Only denormalize what's displayed together

### 2. Forgetting Cascade Updates
**Problem**: Stale denormalized data

**Solution**: Always implement cascade updates

### 3. Unbounded Collections
**Problem**: Array grows indefinitely

**Solution**: Use separate items for large collections

### 4. No Foreign Keys
**Problem**: Can't query relationships

**Solution**: Always store both ID and embedded data

## Conclusion

Denormalization is a powerful technique for optimizing read performance in NoSQL databases. By strategically embedding related data and implementing proper cascade updates, you can achieve 3-10x faster reads while maintaining data consistency.

For the Rasika.life platform, denormalization enables single-query access to compositions with their composers, ragas, and talas, providing fast page loads and excellent user experience.

**Related Reading:**
- [Cascade Updates in Denormalized Data](./cascade-updates-denormalized-data.md)
- [Single-Table Design Patterns](./single-table-design-patterns.md)
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md)

## Resources

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Data Modeling Guidelines](https://www.dynamodbguide.com/data-modeling)
- [NoSQL Design Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/dynamodb-data-modeling/step3.html)
- [Single-Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/)

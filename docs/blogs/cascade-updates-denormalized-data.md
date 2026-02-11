# Cascade Updates in Denormalized Data - Maintaining Consistency

## Introduction

Denormalization is a key strategy in NoSQL databases like DynamoDB for achieving fast reads, but it comes with a challenge: when the source data changes, you must update all denormalized copies. This blog post explores cascade update patterns for maintaining consistency in denormalized data, covering batch updates, circular dependency handling, and practical implementation strategies.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)
- [ADR-005: ElectroDB for Type-Safe Database Operations](../adrs/adr-005-electrodb-type-safe-database-operations.md)

## The Denormalization Challenge

### Why Denormalize?

In relational databases, you'd use foreign keys and joins:

```sql
-- Normalized approach (SQL)
SELECT c.title, a.name as composer_name
FROM compositions c
JOIN artists a ON c.composer_id = a.id
WHERE c.id = '123';
```

DynamoDB doesn't support joins, so we denormalize:

```typescript
// Denormalized approach (DynamoDB)
interface Composition {
  id: string;
  title: string;
  composerId: string;
  composer: {
    id: string;
    name: string;  // Denormalized - duplicated from Artist
  };
}

// Single query - no joins needed
const composition = await CompositionEntity.get({ id: '123' }).go();
console.log(composition.composer.name); // Already available
```

### The Consistency Problem

```typescript
// Problem: When artist name changes, compositions still have old name
await ArtistEntity.update({ id: 'artist-123' })
  .set({ name: 'M. S. Subbulakshmi' })
  .go();

// All compositions still reference old name!
const composition = await CompositionEntity.get({ id: 'comp-456' }).go();
console.log(composition.composer.name); // Still shows "MS Subbulakshmi"
```

**Challenges:**
- **Consistency**: Keeping denormalized data in sync
- **Performance**: Updating potentially thousands of records
- **Atomicity**: Ensuring all updates complete or none do
- **Cost**: Write capacity usage for bulk updates
- **Circular dependencies**: Avoiding import cycles in module structure

## Cascade Update Architecture

### Strategy Overview

```typescript
// Cascade update pattern
export async function updateArtist(
  id: string,
  updates: UpdateArtistInput
): Promise<Artist> {
  // 1. Update the source entity
  const updatedArtist = await ArtistEntity.update({ id }).set(updates).go();

  // 2. If name changed, cascade to all compositions
  if (updates.name) {
    await cascadeComposerNameUpdate(id, updates.name);
  }

  return updatedArtist;
}
```

### Core Cascade Function

```typescript
// packages/core/src/domain/cascade.ts
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../db/client';

export const CASCADE_BATCH_SIZE = 1000;

export async function cascadeComposerNameUpdate(
  artistId: string,
  newName: string
): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { CompositionEntity } = await import('./composition/entity');

  // 1. Find all compositions by this artist
  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  // 2. Update all compositions in parallel
  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: { ':name': newName, ':updatedAt': now },
        })
      )
    )
  );
}
```

## Implementation Patterns

### Simple Cascade (Composer Name)

```typescript
// Straightforward nested object update
export async function cascadeComposerNameUpdate(
  artistId: string,
  newName: string
): Promise<void> {
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ id: string }>) || [];
  const now = new Date().toISOString();

  // Parallel updates using Promise.all
  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.id}`,
            sk: '#METADATA',
          },
          // Update nested composer.name field
          UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: { ':name': newName, ':updatedAt': now },
        })
      )
    )
  );
}
```

### Complex Cascade (Array Updates)

```typescript
// More complex: update raga name in all compositions' raga arrays
export async function cascadeRagaNameUpdate(
  ragaId: string,
  newName: string
): Promise<void> {
  const { CompositionRagaEntity } = await import('./composition_raga/entity');
  const { CompositionEntity } = await import('./composition/entity');

  // 1. Find all composition-raga relationships
  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

  // 2. For each composition, update the ragas array
  await Promise.all(
    items.map(async item => {
      // Fetch current composition
      const composition = await CompositionEntity.get({ id: item.compositionId }).go();
      if (!composition.data) return;

      // Get current ragas array
      const ragas = composition.data.ragas as Array<{ id: string; name: string }> | undefined;
      if (!ragas || ragas.length === 0) return;

      // Update the matching raga in the array
      const updatedRagas = ragas.map(r =>
        r.id === ragaId ? { ...r, name: newName } : r
      );

      // Write back the updated array
      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.compositionId}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET ragas = :ragas, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':ragas': updatedRagas, ':updatedAt': now },
        })
      );
    })
  );
}
```

### Tala Name Cascade

```typescript
// Similar pattern for tala updates
export async function cascadeTalaNameUpdate(
  talaId: string,
  newName: string
): Promise<void> {
  const { CompositionTalaEntity } = await import('./composition_tala/entity');
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionTalaEntity.query
    .byTala({ talaId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ compositionId: string }>) || [];
  const now = new Date().toISOString();

  await Promise.all(
    items.map(async item => {
      const composition = await CompositionEntity.get({ id: item.compositionId }).go();
      if (!composition.data) return;

      const talas = composition.data.talas as Array<{ id: string; name: string }> | undefined;
      if (!talas || talas.length === 0) return;

      const updatedTalas = talas.map(t =>
        t.id === talaId ? { ...t, name: newName } : t
      );

      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.compositionId}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET talas = :talas, updatedAt = :updatedAt',
          ExpressionAttributeValues: { ':talas': updatedTalas, ':updatedAt': now },
        })
      );
    })
  );
}
```

## Advanced Patterns

### Handling Circular Dependencies

```typescript
// Problem: cascade.ts imports from composition/entity.ts
// and composition/service.ts imports from cascade.ts
// This creates a circular dependency!

// Solution: Use dynamic imports
export async function cascadeComposerNameUpdate(
  artistId: string,
  newName: string
): Promise<void> {
  // Dynamic import breaks the circular dependency
  const { CompositionEntity } = await import('./composition/entity');

  // Rest of the implementation...
}
```

### Batch Size Management

```typescript
// Handle large datasets with pagination
export const CASCADE_BATCH_SIZE = 1000;

export async function cascadeComposerNameUpdateAll(
  artistId: string,
  newName: string
): Promise<void> {
  const { CompositionEntity } = await import('./composition/entity');

  let nextToken: string | undefined;
  let totalUpdated = 0;

  do {
    // Fetch batch
    const result = await CompositionEntity.query
      .byComposer({ composerId: artistId })
      .go({
        limit: CASCADE_BATCH_SIZE,
        cursor: nextToken,
      });

    const items = (result.data as Array<{ id: string }>) || [];

    // Update batch
    await Promise.all(
      items.map(item =>
        dynamoClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: `COMPOSITION#${item.id}`,
              sk: '#METADATA',
            },
            UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#name': 'name' },
            ExpressionAttributeValues: {
              ':name': newName,
              ':updatedAt': new Date().toISOString(),
            },
          })
        )
      )
    );

    totalUpdated += items.length;
    nextToken = result.cursor;
  } while (nextToken);

  console.log(`Cascaded name update to ${totalUpdated} compositions`);
}
```

### Error Handling and Rollback

```typescript
// Track successful and failed updates
export async function cascadeWithErrorHandling(
  artistId: string,
  newName: string
): Promise<{
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ id: string }>) || [];
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Use Promise.allSettled to capture both successes and failures
  const results = await Promise.allSettled(
    items.map(async item => {
      await dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: {
            ':name': newName,
            ':updatedAt': new Date().toISOString(),
          },
        })
      );
      return item.id;
    })
  );

  // Process results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded.push(items[index].id);
    } else {
      failed.push({
        id: items[index].id,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  return { succeeded, failed };
}
```

### Optimistic Updates with Retry

```typescript
// Retry failed updates
export async function cascadeWithRetry(
  artistId: string,
  newName: string,
  maxRetries = 3
): Promise<void> {
  let attempt = 0;
  let failedItems: string[] = [];

  while (attempt < maxRetries) {
    const result = await cascadeWithErrorHandling(artistId, newName);

    if (result.failed.length === 0) {
      // All succeeded
      return;
    }

    // Retry failed items
    failedItems = result.failed.map(f => f.id);
    attempt++;

    if (attempt < maxRetries) {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  if (failedItems.length > 0) {
    throw new ApplicationError(
      ErrorCode.DATABASE_ERROR,
      `Failed to cascade update to ${failedItems.length} compositions after ${maxRetries} attempts`
    );
  }
}
```

### Conditional Updates

```typescript
// Only update if the old value matches (prevents race conditions)
export async function cascadeComposerNameConditional(
  artistId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const { CompositionEntity } = await import('./composition/entity');

  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({ limit: CASCADE_BATCH_SIZE });

  const items = (result.data as Array<{ id: string }>) || [];

  await Promise.all(
    items.map(item =>
      dynamoClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: `COMPOSITION#${item.id}`,
            sk: '#METADATA',
          },
          UpdateExpression: 'SET composer.#name = :newName, updatedAt = :updatedAt',
          // Only update if current name matches oldName
          ConditionExpression: 'composer.#name = :oldName',
          ExpressionAttributeNames: { '#name': 'name' },
          ExpressionAttributeValues: {
            ':oldName': oldName,
            ':newName': newName,
            ':updatedAt': new Date().toISOString(),
          },
        })
      )
    )
  );
}
```

## Integration with Service Layer

### Artist Service with Cascade

```typescript
// packages/core/src/domain/artist/service.ts
import { cascadeComposerNameUpdate } from '../cascade';

export async function updateArtist(
  id: string,
  input: UpdateArtistInput
): Promise<Artist> {
  // 1. Update artist
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  // 2. Cascade name change to compositions (if name changed)
  if (input.name) {
    // Fire and forget (don't block the response)
    cascadeComposerNameUpdate(id, input.name).catch(error => {
      console.error('Failed to cascade composer name update:', error);
      // Could also send to error tracking service
    });
  }

  return result.data;
}
```

### Raga Service with Cascade

```typescript
// packages/core/src/domain/raga/service.ts
import { cascadeRagaNameUpdate } from '../cascade';

export async function updateRaga(
  id: string,
  input: UpdateRagaInput
): Promise<Raga> {
  const result = await RagaEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('raga', id);
  }

  // Cascade name changes
  if (input.name) {
    cascadeRagaNameUpdate(id, input.name).catch(error => {
      console.error('Failed to cascade raga name update:', error);
    });
  }

  return result.data;
}
```

### Tala Service with Cascade

```typescript
// packages/core/src/domain/tala/service.ts
import { cascadeTalaNameUpdate } from '../cascade';

export async function updateTala(
  id: string,
  input: UpdateTalaInput
): Promise<Tala> {
  const result = await TalaEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('tala', id);
  }

  // Cascade name changes
  if (input.name) {
    cascadeTalaNameUpdate(id, input.name).catch(error => {
      console.error('Failed to cascade tala name update:', error);
    });
  }

  return result.data;
}
```

## Background Job Pattern

### Lambda Function for Cascade Updates

```typescript
// packages/functions/src/cascade-updater.ts
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { cascadeComposerNameUpdate, cascadeRagaNameUpdate } from '@rasika/core';

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);

    try {
      switch (message.type) {
        case 'composer-name-update':
          await cascadeComposerNameUpdate(message.artistId, message.newName);
          break;

        case 'raga-name-update':
          await cascadeRagaNameUpdate(message.ragaId, message.newName);
          break;

        case 'tala-name-update':
          await cascadeTalaNameUpdate(message.talaId, message.newName);
          break;

        default:
          console.warn('Unknown cascade update type:', message.type);
      }
    } catch (error) {
      console.error('Cascade update failed:', error);
      throw error; // Re-throw to trigger SQS retry
    }
  }
};
```

### Async Cascade with SQS

```typescript
// Queue cascade updates instead of blocking
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.CASCADE_QUEUE_URL;

export async function queueCascadeUpdate(
  type: 'composer-name-update' | 'raga-name-update' | 'tala-name-update',
  params: Record<string, unknown>
): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({
        type,
        ...params,
        timestamp: new Date().toISOString(),
      }),
    })
  );
}

// Usage in service
export async function updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  // Queue cascade update (non-blocking)
  if (input.name) {
    await queueCascadeUpdate('composer-name-update', {
      artistId: id,
      newName: input.name,
    });
  }

  return result.data;
}
```

## Testing Cascade Updates

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cascadeComposerNameUpdate } from '@rasika/core';
import { dynamoClient } from '@rasika/core/db/client';

vi.mock('@rasika/core/db/client');

describe('Cascade Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update composer name in all compositions', async () => {
    const artistId = 'artist-123';
    const newName = 'M. S. Subbulakshmi';

    // Mock query result
    vi.mocked(dynamoClient.send).mockResolvedValueOnce({
      Items: [
        { id: 'comp-1', composerId: artistId },
        { id: 'comp-2', composerId: artistId },
      ],
    });

    // Mock update commands
    vi.mocked(dynamoClient.send).mockResolvedValue({});

    await cascadeComposerNameUpdate(artistId, newName);

    // Verify updates were called for both compositions
    expect(dynamoClient.send).toHaveBeenCalledTimes(3); // 1 query + 2 updates
  });

  it('should handle empty result set', async () => {
    const artistId = 'artist-123';
    const newName = 'New Name';

    vi.mocked(dynamoClient.send).mockResolvedValueOnce({
      Items: [],
    });

    await cascadeComposerNameUpdate(artistId, newName);

    // Only query should be called
    expect(dynamoClient.send).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

```typescript
describe('Cascade Integration', () => {
  it('should cascade artist name to compositions', async () => {
    // Create artist
    const artist = await createArtist({ name: 'Old Name' });

    // Create compositions
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
    await updateArtist(artist.id, { name: 'New Name' });

    // Wait for cascade (if async)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify cascade
    const updatedComp1 = await getComposition(comp1.id);
    const updatedComp2 = await getComposition(comp2.id);

    expect(updatedComp1.composer.name).toBe('New Name');
    expect(updatedComp2.composer.name).toBe('New Name');
  });
});
```

## Performance Considerations

### Batch Size Tuning

```typescript
// Adjust batch size based on item size and update complexity
export const CASCADE_BATCH_SIZE = {
  SIMPLE_UPDATE: 1000,    // Simple nested field updates
  ARRAY_UPDATE: 500,      // Array manipulation (fetch + update)
  COMPLEX_UPDATE: 250,    // Multiple fetches or complex logic
};

// Use appropriate batch size
export async function cascadeRagaNameUpdate(ragaId: string, newName: string): Promise<void> {
  // Array update requires fetch + transform + update
  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId })
    .go({ limit: CASCADE_BATCH_SIZE.ARRAY_UPDATE });

  // ...
}
```

### Monitoring and Metrics

```typescript
// Track cascade performance
export async function cascadeWithMetrics(
  artistId: string,
  newName: string
): Promise<void> {
  const startTime = Date.now();
  let itemsUpdated = 0;

  try {
    const result = await cascadeComposerNameUpdate(artistId, newName);
    itemsUpdated = result.succeeded.length;

    // Log metrics
    console.log({
      operation: 'cascade-composer-name',
      artistId,
      itemsUpdated,
      durationMs: Date.now() - startTime,
      status: 'success',
    });
  } catch (error) {
    console.error({
      operation: 'cascade-composer-name',
      artistId,
      itemsUpdated,
      durationMs: Date.now() - startTime,
      status: 'error',
      error: error.message,
    });
    throw error;
  }
}
```

## Best Practices

### 1. Use Dynamic Imports for Circular Dependencies
```typescript
// Always use dynamic imports in cascade.ts to avoid circular dependencies
const { CompositionEntity } = await import('./composition/entity');
```

### 2. Update Timestamps
```typescript
// Always update updatedAt when cascading
UpdateExpression: 'SET composer.#name = :name, updatedAt = :updatedAt'
```

### 3. Fire and Forget vs. Blocking
```typescript
// Fire and forget for non-critical updates
if (input.name) {
  cascadeComposerNameUpdate(id, input.name).catch(console.error);
}

// Blocking for critical updates
if (input.criticalField) {
  await cascadeCriticalUpdate(id, input.criticalField);
}
```

### 4. Handle Partial Failures
```typescript
// Use Promise.allSettled to track successes and failures
const results = await Promise.allSettled(updates);
```

### 5. Limit Batch Sizes
```typescript
// Don't try to update millions of items at once
const CASCADE_BATCH_SIZE = 1000; // Reasonable limit
```

## Common Pitfalls

### 1. Circular Dependencies
**Problem**: Importing entities directly causes circular deps
```typescript
// Wrong
import { CompositionEntity } from './composition/entity';
```

**Solution**: Use dynamic imports
```typescript
// Correct
const { CompositionEntity } = await import('./composition/entity');
```

### 2. Not Handling Failures
**Problem**: One failure breaks entire cascade

**Solution**: Use Promise.allSettled and track failures

### 3. Blocking the User
**Problem**: Waiting for cascade before returning response

**Solution**: Fire and forget for non-critical updates

### 4. Race Conditions
**Problem**: Concurrent updates overwrite each other

**Solution**: Use conditional updates or optimistic locking

## Conclusion

Cascade updates are essential for maintaining consistency in denormalized NoSQL databases. By implementing robust cascade patterns with error handling, batch processing, and proper dependency management, you can enjoy the performance benefits of denormalization while ensuring data consistency.

For the Rasika.life platform, cascade updates enable fast queries (no joins) while keeping composer, raga, and tala names synchronized across all compositions. This approach provides the best of both worlds: read performance and data consistency.

**Related Reading:**
- [Single-Table Design Patterns](./single-table-design-patterns.md)
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md)
- [ADR-001: Single-Table Design](../adrs/adr-001-single-table-dynamodb-design.md)

## Resources

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Denormalization Patterns](https://www.dynamodbguide.com/one-to-many-relationships)
- [Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- [AWS SDK v3 UpdateCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/UpdateItemCommand/)

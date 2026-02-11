# Cursor-Based Pagination - Efficient DynamoDB Queries

## Introduction

Pagination is essential for handling large datasets efficiently, but implementing it correctly can be challenging. Traditional offset-based pagination suffers from performance issues and inconsistencies with dynamic datasets. Cursor-based pagination solves these problems by using opaque tokens to mark positions in result sets. This blog post explores cursor-based pagination implementation for DynamoDB using ElectroDB, covering encoding strategies, query patterns, and best practices.

## The Pagination Challenge

### Offset-Based Pagination Problems

```typescript
// Offset-based pagination (problematic for DynamoDB)
export async function listArtistsOffset(page: number, pageSize: number): Promise<{
  items: Artist[];
  total: number;
  page: number;
}> {
  const offset = (page - 1) * pageSize;

  // Problem 1: DynamoDB doesn't support offset directly
  // Must scan through all items to reach offset
  const allItems = await ArtistEntity.scan.go();
  const items = allItems.data.slice(offset, offset + pageSize);

  return {
    items,
    total: allItems.data.length,
    page,
  };
}

// Problems with this approach:
// - Scans entire table for every request
// - Expensive read operations
// - Performance degrades with dataset size
// - Inconsistent results when data changes between pages
// - Wasted capacity units
```

### Why Offset Pagination Fails in DynamoDB

1. **No Native Offset Support**: DynamoDB doesn't support SQL-style OFFSET/LIMIT
2. **Scan Inefficiency**: Must read all items before offset to skip them
3. **Cost**: Consumes read capacity for skipped items
4. **Inconsistency**: Data changes between pages affect results
5. **Performance**: Degrades linearly with page number

## Cursor-Based Pagination Architecture

### Core Concepts

```typescript
// Cursor-based pagination response
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;    // Opaque cursor for next page
  hasMore: boolean;      // Indicates if more results exist
}

// Pagination parameters
export interface PaginationParams {
  limit?: number;        // Number of items to return (default: 20)
  nextToken?: string;    // Cursor from previous response
}
```

### How ElectroDB Cursors Work

```typescript
// ElectroDB automatically handles cursor encoding/decoding
const result = await ArtistEntity.query.list({}).go({
  limit: 20,
  cursor: params.nextToken,  // ElectroDB cursor (base64-encoded DynamoDB key)
});

// Result structure
{
  data: [...],           // Query results
  cursor: "...",         // Opaque token for next page (undefined if no more items)
}

// The cursor is automatically:
// - Base64-encoded by ElectroDB
// - Contains DynamoDB's ExclusiveStartKey
// - Safe to expose to clients
// - Handles pagination state internally
```

## Implementation Patterns

### Basic List Query with Pagination

```typescript
// packages/core/src/domain/artist/service.ts
export async function listArtists(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await ArtistEntity.query
    .list({})  // Query using list GSI
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

// Usage
const page1 = await listArtists({ limit: 20 });
// Returns: { items: [...20 items], nextToken: "abc123", hasMore: true }

const page2 = await listArtists({ limit: 20, nextToken: page1.nextToken });
// Returns: { items: [...20 items], nextToken: "def456", hasMore: true }

const page3 = await listArtists({ limit: 20, nextToken: page2.nextToken });
// Returns: { items: [...remaining items], nextToken: undefined, hasMore: false }
```

### Filtered Queries with Pagination

```typescript
// Get compositions by artist with pagination
export async function getCompositionsByArtist(
  artistId: string,
  params?: {
    limit?: number;
    nextToken?: string;
  }
): Promise<{
  items: Composition[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await CompositionEntity.query
    .byComposer({ composerId: artistId })
    .go({
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

### Sorted Queries with Pagination

```typescript
// Get user's edits sorted by date (most recent first)
export async function getUserEdits(
  userId: string,
  params?: {
    limit?: number;
    nextToken?: string;
  }
): Promise<{
  items: Edit[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await EditEntity.query
    .byUser({ userId })
    .go({
      limit,
      cursor: params?.nextToken,
      order: 'desc',  // Sort by SK in descending order
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

### Scan Operations with Pagination

```typescript
// Scan all artists (use sparingly)
export async function scanArtists(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 100;

  const result = await ArtistEntity.scan.go({
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

## Advanced Patterns

### Bidirectional Pagination

```typescript
// Support both forward and backward pagination
export interface BidirectionalPaginationParams {
  limit?: number;
  nextToken?: string;    // For forward pagination
  previousToken?: string; // For backward pagination
}

export async function listArtistsBidirectional(
  params?: BidirectionalPaginationParams
): Promise<{
  items: Artist[];
  nextToken?: string;
  previousToken?: string;
  hasMore: boolean;
  hasPrevious: boolean;
}> {
  const limit = params?.limit || 20;

  // Determine direction
  const cursor = params?.nextToken || params?.previousToken;
  const reverse = !!params?.previousToken;

  const result = await ArtistEntity.query
    .list({})
    .go({
      limit,
      cursor,
      order: reverse ? 'desc' : 'asc',
    });

  return {
    items: reverse ? result.data.reverse() : result.data,
    nextToken: !reverse && result.cursor ? result.cursor : undefined,
    previousToken: reverse && result.cursor ? result.cursor : undefined,
    hasMore: !reverse && !!result.cursor,
    hasPrevious: reverse && !!result.cursor,
  };
}
```

### Cursor with Total Count

```typescript
// Include total count (expensive - requires separate query)
export async function listArtistsWithCount(params?: {
  limit?: number;
  nextToken?: string;
  includeCount?: boolean;
}): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
  total?: number;
}> {
  const limit = params?.limit || 20;

  // Get paginated results
  const result = await ArtistEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  // Optionally get total count (expensive operation)
  let total: number | undefined;
  if (params?.includeCount) {
    const countResult = await ArtistEntity.query.list({}).go({
      attributes: ['id'],  // Only fetch ID for counting
    });
    total = countResult.data.length;
  }

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
    total,
  };
}
```

### Cursor Validation

```typescript
// Validate cursor before use
export function isValidCursor(cursor: string): boolean {
  try {
    // ElectroDB cursors are base64-encoded JSON
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    // Validate structure (cursors contain DynamoDB keys)
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

// Safe list with cursor validation
export async function listArtistsSafe(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<PaginatedResponse<Artist>> {
  const limit = params?.limit || 20;

  // Validate cursor if provided
  if (params?.nextToken && !isValidCursor(params.nextToken)) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid pagination cursor'
    );
  }

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

## tRPC Integration

### Pagination Schema

```typescript
// Reusable pagination schemas
export const PaginationInputSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  nextToken: z.string().optional(),
});

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextToken: z.string().optional(),
    hasMore: z.boolean(),
  });
```

### Router Implementation

```typescript
// packages/trpc/src/routers/artist.ts
import { z } from 'zod';
import { Artist } from '@rasika/core';
import { publicProcedure, router } from '../trpc';

export const artistRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await Artist.listArtists({
        limit: input.limit || 20,
        nextToken: input.nextToken,
      });
    }),

  listByTradition: publicProcedure
    .input(
      z.object({
        tradition: z.string(),
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await Artist.listByTradition(input.tradition, {
        limit: input.limit || 50,
        nextToken: input.nextToken,
      });
    }),
});
```

## Frontend Integration

### Remix Loader with Pagination

```typescript
// packages/web/app/routes/artists._index.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { trpc } from '~/lib/trpc';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') || undefined;
  const limit = Number(url.searchParams.get('limit')) || 20;

  const artists = await trpc.artist.list.query({
    limit,
    nextToken,
  });

  return json({ artists });
}

export default function ArtistsList() {
  const { artists } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleNextPage = () => {
    if (artists.nextToken) {
      setSearchParams({ nextToken: artists.nextToken });
    }
  };

  return (
    <div>
      <h1>Artists</h1>
      <ul>
        {artists.items.map(artist => (
          <li key={artist.id}>
            <a href={`/artists/${artist.id}`}>{artist.name}</a>
          </li>
        ))}
      </ul>

      {artists.hasMore && (
        <button onClick={handleNextPage}>Load More</button>
      )}
    </div>
  );
}
```

### Infinite Scroll Implementation

```tsx
// packages/web/app/components/InfiniteArtistList.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { trpc } from '~/lib/trpc';
import { useEffect, useRef } from 'react';

export function InfiniteArtistList() {
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['artists', 'infinite'],
    queryFn: async ({ pageParam }) => {
      return await trpc.artist.list.query({
        limit: 20,
        nextToken: pageParam,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextToken,
    initialPageParam: undefined,
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1 }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.items.map(artist => (
            <div key={artist.id}>{artist.name}</div>
          ))}
        </div>
      ))}

      <div ref={observerTarget} style={{ height: '20px' }}>
        {isFetchingNextPage && <p>Loading more...</p>}
      </div>
    </div>
  );
}
```

## Performance Optimization

### Limit Tuning

```typescript
// Choose appropriate limits based on use case
const PAGINATION_LIMITS = {
  UI_LIST: 20,          // User-facing lists
  API_BATCH: 100,       // API batch operations
  BACKGROUND_JOB: 500,  // Background processing
  SEARCH_RESULTS: 50,   // Search result pages
};

export async function listArtists(context: 'ui' | 'batch' | 'background' | 'search') {
  const limitMap = {
    ui: PAGINATION_LIMITS.UI_LIST,
    batch: PAGINATION_LIMITS.API_BATCH,
    background: PAGINATION_LIMITS.BACKGROUND_JOB,
    search: PAGINATION_LIMITS.SEARCH_RESULTS,
  };

  return await ArtistEntity.query.list({}).go({
    limit: limitMap[context],
  });
}
```

### Attribute Projection

```typescript
// Only fetch required attributes for better performance
export async function listArtistSummaries(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Array<Pick<Artist, 'id' | 'name' | 'artistType'>>;
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await ArtistEntity.query
    .list({})
    .go({
      limit,
      cursor: params?.nextToken,
      attributes: ['id', 'name', 'artistType'],  // Project only needed fields
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}
```

### Parallel Pagination

```typescript
// Fetch multiple pages in parallel (useful for background jobs)
export async function fetchAllArtists(
  batchSize = 100
): Promise<Artist[]> {
  const allArtists: Artist[] = [];
  let nextToken: string | undefined;

  do {
    const result = await ArtistEntity.query.list({}).go({
      limit: batchSize,
      cursor: nextToken,
    });

    allArtists.push(...(result.data || []));
    nextToken = result.cursor;
  } while (nextToken);

  return allArtists;
}
```

## Testing Pagination

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { listArtists } from '@rasika/core';

describe('Pagination', () => {
  it('should return first page with cursor', async () => {
    const result = await listArtists({ limit: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextToken).toBeDefined();
  });

  it('should return next page using cursor', async () => {
    const page1 = await listArtists({ limit: 10 });
    const page2 = await listArtists({
      limit: 10,
      nextToken: page1.nextToken,
    });

    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it('should return last page without cursor', async () => {
    let nextToken: string | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      const result = await listArtists({ limit: 1000, nextToken });
      nextToken = result.nextToken;
      hasMore = result.hasMore;
      pages++;

      if (pages > 100) {
        throw new Error('Too many pages');
      }
    }

    expect(hasMore).toBe(false);
    expect(nextToken).toBeUndefined();
  });
});
```

### Integration Tests

```typescript
describe('Pagination Integration', () => {
  beforeEach(async () => {
    // Seed database with test data
    await seedArtists(250);
  });

  it('should paginate through all items', async () => {
    const allItems: Artist[] = [];
    let nextToken: string | undefined;

    do {
      const result = await listArtists({ limit: 50, nextToken });
      allItems.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    expect(allItems).toHaveLength(250);
    // Verify no duplicates
    const ids = new Set(allItems.map(a => a.id));
    expect(ids.size).toBe(250);
  });
});
```

## Best Practices

### 1. Consistent Limit Values
- Use reasonable default limits (20-50 for UI, 100+ for batch)
- Enforce maximum limits to prevent abuse
- Document recommended limits for different use cases

### 2. Cursor Opacity
- Never expose internal cursor structure to clients
- Use ElectroDB's built-in base64 encoding
- Validate cursors before use
- Handle invalid cursors gracefully

### 3. Error Handling
- Handle expired cursors gracefully
- Provide clear error messages for invalid cursors
- Implement retry logic for transient failures

### 4. Performance Considerations
- Use GSI queries instead of scans when possible
- Project only required attributes
- Tune batch sizes based on item size
- Monitor read capacity consumption

### 5. Client-Side Best Practices
- Cache paginated results
- Implement optimistic UI updates
- Handle loading and error states
- Consider infinite scroll vs. discrete pages

## Common Pitfalls

### 1. Offset-Based Pagination
**Problem**: Using offset/skip patterns
**Solution**: Always use cursor-based pagination with DynamoDB

### 2. Exposing Raw Keys
**Problem**: Returning DynamoDB keys directly to clients
**Solution**: Use ElectroDB's encoded cursors

### 3. Missing Limit Enforcement
**Problem**: Allowing unlimited result sets
**Solution**: Always enforce reasonable limits

### 4. Cursor Tampering
**Problem**: Not validating cursors
**Solution**: Validate cursor format and handle errors

## Conclusion

Cursor-based pagination provides efficient, consistent, and scalable pagination for DynamoDB applications. By leveraging ElectroDB's cursor encoding, implementing proper query patterns, and following best practices, you can build performant pagination that works seamlessly across your application.

For the Rasika.life platform, cursor-based pagination enables smooth browsing of large catalogs of artists, compositions, and user contributions while maintaining optimal performance and cost efficiency.

## Resources

- [DynamoDB Pagination](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html)
- [ElectroDB Documentation](https://electrodb.dev/)
- [Cursor Pagination Best Practices](https://slack.engineering/evolving-api-pagination-at-slack/)
- [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm)

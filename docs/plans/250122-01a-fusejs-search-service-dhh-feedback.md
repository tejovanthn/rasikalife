# DHH Code Review: Fuse.js Search Service Spec

**Review Date:** January 22, 2026  
**Spec:** `/Users/tejovanthn/codes/rasikalife/docs/plans/250122-01a-fusejs-search-service.md`  
**Reviewer:** Code Review (DHH Standards)

---

## Overall Assessment

This spec represents a reasonable first iteration for a search service, but it suffers from **premature complexity** in several areas while **under-engineering critical production concerns**. The architecture choices are mostly sound (S3 for index storage, pre-built indexes), but the implementation details reveal a pattern of over-abstraction and missed opportunities for simplicity.

**Verdict:** Framework-worthy with significant revisions. The spec needs to shed unnecessary complexity (new package, over-engineered response types) while beefing up production readiness (error handling, health checks, observability).

---

## Critical Issues

### 1. Unnecessary Package Abstraction: `@rasika/search`

**Problem:** The spec creates a new separate package `packages/search` with its own infrastructure. This is premature abstraction that fragments the codebase and violates the existing domain-driven structure.

**Impact:**
- New package means new patterns, new tests, new conventions to learn
- Duplicates infrastructure code that already exists in `packages/core`
- Forces unnecessary mental overhead for developers navigating the codebase

**Evidence:**
```
packages/search/
├── src/
│   ├── index.ts              # Search Lambda handler
│   ├── handler.ts            # Search implementation
│   ├── types.ts              # TypeScript interfaces
│   ├── fuse.ts               # Fuse.js configuration
│   ├── indexer.ts            # Index building logic
...
```

**DHH Would Say:** "Don't create new packages until you absolutely have to. A search module in `packages/core/src/domain/search` would be simpler, follow existing conventions, and avoid inventing new patterns."

**Recommendation:** Fold the search module into `packages/core/src/domain/search`. The core package already has the repository pattern, domain types, and testing infrastructure. Adding a `search/` directory follows the existing architecture.

---

### 2. The 5-Minute Cache TTL is Arbitrary and Potentially Harmful

**Problem:** The 5-minute cache TTL creates an incoherent cache strategy:
- Index rebuilds every 6 hours (21,600 seconds)
- Cache expires every 5 minutes (300 seconds)
- On every cache miss, the Lambda fetches a ~5-50MB index from S3

**Impact:**
- **Cold start after every 5 minutes:** A 50MB JSON download on cache miss will cause significant latency spikes
- **Wasted bandwidth:** The index doesn't change for 6 hours, yet we're downloading it 72 times per day per Lambda instance
- **Memory pressure:** Keeping a 50MB index in Lambda memory when it barely changes is wasteful

**Evidence:**
```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

async function loadSearchIndex(): Promise<SearchIndex> {
  const now = Date.now();

  // Return cached index if still valid
  if (cachedIndex && cacheExpiry > now) {
    return cachedIndex;
  }

  // Fetch from S3 - this happens 72x per day per Lambda instance
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: process.env.SEARCH_INDEX_BUCKET,
      Key: 'search-index/latest/index.json',
    })
  );
```

**Better Approach:**
- **Option A (Simpler):** No TTL. Cache forever, force refresh on cron rebuild via a version check or ETag
- **Option B (Pragmatic):** 30-minute to 1-hour TTL, which still catches most requests while reducing cold start frequency

The current 5-minute value seems picked arbitrarily. Why not 1 minute? Why not 10 minutes?

**Recommendation:** Remove the TTL entirely. Use the Lambda execution context's inherent caching (warm starts) and rely on the cron job to publish new indexes. Add an optional `If-None-Match` header or version check to avoid re-downloading unchanged indexes.

---

### 3. Response Structure Over-Engineering: `SearchResult` and `SearchResponse` Types

**Problem:** The spec defines verbose response types that duplicate information and add no value:

```typescript
export interface SearchResult {
  document: SearchDocument;  // Full document (duplicated in response)
  score: number;             // Already part of Fuse.js result
  matches: Array<{ ... }>;   // Raw Fuse.js matches
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters?: SearchableField[];
  took: number;
}
```

**Impact:**
- The `document` field contains the entire original entity data, which is then serialized over the wire
- `matches` exposes raw Fuse.js internal structures
- The response includes `filters` which is just echoing back user input
- `took` is a premature optimization/observability feature that belongs in logs, not API responses

**DHH Would Say:** "Let the framework do the work. If tRPC or the API gateway needs timing, let them handle it. Don't pollute your API responses with debugging metadata."

**Recommendation:** Simplify to:

```typescript
export interface SearchResponse {
  items: Array<{
    id: string;
    type: 'artist' | 'raga' | 'tala' | 'composition';
    name: string;
    highlights: {
      field: string;
      matchedText: string;  // Or pre-rendered HTML
    }[];
  }>;
  total: number;
}
```

The frontend doesn't need the full document or raw match indices. It needs:
1. What is it? (id, type)
2. What name to display? (name)
3. Where did it match? (highlights)

---

### 4. Missing Production Concerns

**The spec is dangerously incomplete on production readiness:**

#### a) No Health Check Endpoint

A search service without a health check is debugging hell. If S3 is down, the service should fail fast with a clear error, not hang until Lambda timeout.

**Missing:**
```typescript
// Health check should verify:
1. S3 bucket exists and is accessible
2. Index file exists
3. Index is not stale (>24 hours old)
```

#### b) No Index Freshness Validation

What happens if the cron job fails for 3 days? The search continues serving stale data with no indication anything is wrong.

**Missing:**
```typescript
// In getIndexStatus():
if (indexAgeInHours > 12) {
  // Return warning status
  // Consider failing health check
}
```

#### c) No Circuit Breaker Pattern

If S3 has issues, every search request will fail. There's no fallback to degraded service.

**Missing:**
```typescript
// If S3 is down for >30 seconds:
// - Return cached stale index (with warning header)
// - Return error after cache expires
```

#### d) No Observability

No logging, no metrics, no distributed tracing support.

**Missing:**
```typescript
// Log on:
// - Index load (success/failure/duration)
// - Search query (anonymized)
// - Search duration
// - Result count

// Metrics:
// - search_request_duration_ms
// - index_load_duration_ms
// - s3_get_requests (for cost tracking)
// - search_results_count
```

#### e) No Rate Limiting

The spec explicitly says "no rate limiting" but doesn't consider:
- Cost implications of unbounded search queries
- Protection against search-as-a-service abuse
- DoS protection

---

### 5. Filter Implementation: Weak Type Safety

**Problem:** The filter implementation uses a string array that doesn't integrate with Zod schemas:

```typescript
filters: z
  .array(
    z.enum(['artistName', 'ragaName', 'talaName', 'compositionTitle', 'lyrics'])
  )
  .optional(),
```

**Impact:**
- The enum values are duplicated (also defined in `SearchableField` type)
- No compile-time guarantee that Zod schema matches TypeScript type
- Hard to add new searchable fields (must update 3 places)

**Recommendation:** Use the existing pattern from AGENTS.md - define schema once and derive types:

```typescript
import { z } from 'zod';

export const SearchableFieldSchema = z.enum([
  'artistName',
  'ragaName', 
  'talaName',
  'compositionTitle',
  'lyrics',
]);

export type SearchableField = z.infer<typeof SearchableFieldSchema>;

// Then in tRPC router:
filters: z.array(SearchableFieldSchema).optional(),
```

---

## Improvements Needed

### 1. Index Storage: S3 Decision is Correct, But Missing Details

The S3 vs DynamoDB decision is **correct**. S3 is the right choice for large, read-heavy, infrequently updated blobs. The spec correctly identifies:
- DynamoDB item size limits (400KB)
- S3 cost efficiency for large objects
- Versioning benefits

**However, missing details:**

```typescript
// Not specified:
- S3 bucket encryption settings
- Lifecycle policy (auto-delete old indexes after N days)
- Cross-region replication if needed
- CDN caching (CloudFront in front of S3)
```

---

### 2. Pre-Built Index Strategy: Good, But Incomplete

The pre-built index approach is **correct** for the dataset size (10k-100k items). Building the index on every request would be O(n²) expensive.

**But missing considerations:**

```typescript
// Not specified:
- Index size estimates (what's the actual MB size?)
- Upload progress for large indexes
- Atomic swap (update "latest" pointer only after full upload completes)
- Checksum verification after download
```

---

### 3. Error Handling: Too Generic

The spec defines error codes but doesn't specify how they're used:

```typescript
export enum ErrorCode {
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  SEARCH_INDEX_BUILD_FAILED = 'SEARCH_INDEX_BUILD_FAILED',
  SEARCH_QUERY_FAILED = 'SEARCH_QUERY_FAILED',
}
```

**Missing context:**

```typescript
// When to use each code:
// SEARCH_INDEX_ERROR: S3 unavailable, index corrupt, parse failed
// SEARCH_INDEX_BUILD_FAILED: DynamoDB scan failed, S3 upload failed  
// SEARCH_QUERY_FAILED: Fuse.js threw exception (shouldn't happen)

// Error responses should include:
// - User-friendly message
// - Error code for programmatic handling
// - Request ID for debugging
// - Timestamp

{
  error: {
    code: 'SEARCH_INDEX_ERROR',
    message: 'Search is temporarily unavailable. Please try again.',
    requestId: 'req-123',
    retryable: true,
    retryAfter: 30,
  }
}
```

---

### 4. Data Model: Unnecessary Denormalization

The `SearchDocument` contains both search fields and the full entity:

```typescript
export interface SearchDocument {
  // Searchable fields (normalized to strings)
  artistName: string;
  ragaName: string;
  // ...
  
  // Original entity data (for response)
  entity: {
    // Entire composition.artist object duplicated
  };
}
```

**Problem:** This duplicates the entire entity data. If the entity schema changes, the search document must also change.

**Better approach:** Store only the search fields and a reference:

```typescript
export interface SearchDocument {
  id: string;
  entityType: 'artist' | 'raga' | 'tala' | 'composition';
  
  // Searchable fields
  searchFields: {
    artistName: string;
    ragaName: string;
    talaName: string;
    compositionTitle: string;
    lyrics: string;
  };
  
  // Reference for fetching full entity if needed
  entityRef: {
    type: string;
    id: string;
  };
  
  indexedAt: string;
}
```

Then if the frontend needs full entity data, it can fetch it separately (or the search service can have an optional `includeEntities` flag that does a batch fetch).

---

### 5. Testing: Good Structure, Missing Critical Tests

The test structure is good (unit, integration, performance), but missing key scenarios:

```typescript
// Missing tests:

// 1. Index load failure scenarios
describe('Index Loading', () => {
  it('should fail fast when S3 is unavailable', async () => {
    // Mock S3 to throw error
    // Expect ApplicationError, not generic Error
  });

  it('should return stale cached index when S3 fails', async () => {
    // Load valid index
    // Mock S3 failure
    // Search should succeed with cached data + warning header
  });
});

// 2. Index freshness validation
describe('Index Freshness', () => {
  it('should warn when index is older than 6 hours', async () => {
    // Mock index with old builtAt
    // Expect warning in response or health check
  });
  
  it('should fail health check when index is older than 24 hours', async () => {
    // Mock very old index
    // Expect unhealthy status
  });
});

// 3. Concurrent index rebuild scenarios
describe('Concurrent Rebuilds', () => {
  it('should handle multiple cron triggers gracefully', async () => {
    // Two index builds running simultaneously
    // Should not corrupt "latest" pointer
  });
});

// 4. Performance under load
describe('Load Testing', () => {
  it('should handle 100 concurrent search requests', async () => {
    // 100 simultaneous searches
    // All should complete within 1 second
  });
});
```

---

## What Works Well

### 1. Architecture: Pre-Built Index with S3 Storage

This is the right choice for the problem. The architecture diagram is clear, and the rationale for S3 over DynamoDB is well-reasoned.

**Specifically good:**
- Cron-based periodic rebuild (6 hours is reasonable)
- "Latest" pointer pattern for atomic updates
- Parallel fetching for index building
- Pre-built Fuse.js index (Fuse.createIndex) for performance

### 2. Fuse.js Configuration

The Fuse.js settings are appropriate:
- `threshold: 0.4` - reasonable default for typo tolerance
- `ignoreLocation: true` - good for song titles and names
- `ignoreDiacritics: true` - essential for Indian classical music names
- Equal weightage - correct per requirements

### 3. Document Transformation Pattern

The `transformArtistToDocument`, `transformCompositionToDocument`, etc. functions are clean and follow the existing codebase patterns.

### 4. Pagination Implementation

The offset/limit pagination is pragmatic. Using `limit: limit + offset` to fetch extra items is a clever optimization.

### 5. Test Structure

The test organization (unit, integration, performance) follows good practices. The Vitest configuration aligns with the existing codebase.

---

## Refactored Spec

### Directory Structure (Revised)

```
packages/core/src/domain/search/
├── index.ts              # Barrel exports
├── types.ts              # Schema and types
├── schema.ts             # Zod schemas
├── transformer.ts        # Document transformation
├── indexer.ts            # Index building logic
├── service.ts            # Search service
├── search.test.ts        # Tests
├── index.ts              # Lambda handler
└── cron/
    └── refresh-index.ts  # Cron job handler
```

### Core Service (Revised)

```typescript
// packages/core/src/domain/search/service.ts

import Fuse from 'fuse.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type { SearchableField, SearchDocument } from './types';
import { createFuseOptions } from './fuse';

interface CachedIndex {
  data: {
    builtAt: string;
    documentCount: number;
    fuseIndex: unknown;
    documents: SearchDocument[];
  };
  loadedAt: number;
}

const cachedIndex: CachedIndex | null = null;
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET!;

interface SearchOptions {
  filters?: SearchableField[];
  limit?: number;
  offset?: number;
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<{
  items: Array<{
    id: string;
    type: string;
    name: string;
    highlights: Array<{ field: string; text: string }>;
  }>;
  total: number;
}> {
  const { filters, limit = 20, offset = 0 } = options;

  const index = await loadIndex();
  const fuseOptions = createFuseOptions(filters);
  const fuseIndex = Fuse.parseIndex(index.fuseIndex);
  const fuse = new Fuse(index.documents, fuseOptions, fuseIndex);

  const results = fuse.search(query, { limit: limit + offset });
  const paginated = results.slice(offset, offset + limit);

  return {
    items: paginated.map((result) => ({
      id: result.item.id,
      type: result.item.entityType,
      name: result.item.entity.name,
      highlights: (result.matches || []).map((match) => ({
        field: match.key,
        text: match.value,
      })),
    })),
    total: results.length,
  };
}

async function loadIndex() {
  if (cachedIndex) {
    return cachedIndex.data;
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: INDEX_BUCKET,
      Key: 'search-index/latest/index.json',
    })
  );

  const data = JSON.parse(await response.Body!.transformToString());
  cachedIndex = { data, loadedAt: Date.now() };
  return data;
}

export async function getHealth() {
  try {
    const index = await loadIndex();
    const indexAgeHours = (Date.now() - new Date(index.builtAt).getTime()) / (1000 * 60 * 60);

    return {
      status: indexAgeHours > 24 ? 'stale' : 'healthy',
      lastBuilt: index.builtAt,
      documentCount: index.documentCount,
    };
  } catch {
    return {
      status: 'unhealthy',
      lastBuilt: null,
      documentCount: 0,
    };
  }
}
```

### tRPC Router (Revised)

```typescript
// packages/trpc/src/routers/search.ts

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { search, getHealth } from '@rasika/core';

const SearchableFieldSchema = z.enum([
  'artistName',
  'ragaName',
  'talaName',
  'compositionTitle',
  'lyrics',
]);

export const searchRouter = createTRPCRouter({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        filters: z.array(SearchableFieldSchema).optional(),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(({ input }) =>
      search(input.query, {
        filters: input.filters,
        limit: input.limit,
        offset: input.offset,
      })
    ),

  health: publicProcedure.query(() => getHealth()),
});
```

---

## Summary of Required Changes

| Area | Current State | Required Change |
|------|---------------|-----------------|
| Package structure | Separate `packages/search` | Fold into `packages/core/src/domain/search` |
| Cache TTL | 5 minutes (arbitrary) | Remove TTL, use ETag/version check |
| Response types | Verbose `SearchResult`/`SearchResponse` | Simplified `items` array |
| Health check | Missing | Add `health` endpoint with freshness check |
| Error handling | Generic error codes | Detailed error responses with retry guidance |
| Filters | String enum + type duplication | Single Zod schema source of truth |
| Caching | In-memory with TTL | In-memory forever, version-check on reload |
| Observability | Missing | Add structured logging and metrics |
| Index freshness | Not validated | Fail health check if >24 hours old |
| Circuit breaker | Missing | Fallback to stale cache on S3 failure |

---

## Final Verdict

**This spec is a solid foundation but needs significant revision before implementation.** The core architecture (S3 for index storage, pre-built indexes, cron-based rebuilds) is sound. The problems are in the implementation details:

1. **Too much abstraction** (separate package, over-engineered response types)
2. **Too little production hardening** (no health checks, no circuit breaker, no observability)
3. **Incoherent caching strategy** (5-minute TTL makes no sense)

A developer implementing this spec as-written will create a search service that works but is harder to maintain and debug than necessary. With the suggested changes, the implementation would be simpler, more production-ready, and more aligned with the existing codebase patterns.

**Grade: B- (Good intent, needs execution refinement)**

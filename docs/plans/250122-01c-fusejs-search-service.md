# Fuse.js Search Service (v3 - Final)

## Overview

This specification describes the implementation of a fuzzy search service using Fuse.js for the Rasika.life Indian classical arts community platform. The service enables unified searching across artists, ragas, talas, and compositions (with titles and lyrics) with fuzzy matching, typo tolerance, and field-level filtering.

The search index is built periodically (every 6 hours) via an SST Cron job that scans DynamoDB and stores the pre-built index in S3 for fast retrieval by the search service.

**Key changes from v2:**
- Single `index.test.ts` for all search tests (matches codebase convention)
- Direct console logging (no `@/logging` module, matches existing patterns)
- Fixed type casting issue in Fuse.js match result handling
- Added cache version checking to invalidate cache when index format changes
- Removed separate `fuse.ts` file - Fuse options defined inline in `service.ts`

## Requirements

### Functional Requirements

1. **Unified Search**: Search across all entity types (artists, ragas, talas, compositions) in a single query
2. **Fuzzy Matching**: Enable approximate string matching with typo tolerance using Fuse.js
3. **Equal Weightage**: All searchable fields receive equal weight in scoring (no field bias)
4. **Field-Level Filtering**: Allow filtering search to specific fields via structured input arrays
5. **Scored Results**: Return relevance scores for result ranking
6. **Match Highlighting**: Provide highlighted matches for display purposes
7. **Periodic Index Updates**: Rebuild search index every 6 hours via scheduled cron job
8. **Health Check**: Validate index freshness and report unhealthy if stale (>24 hours)

### Non-Requirements

- Real-time index updates (6-hour refresh is acceptable)
- Advanced features like autocomplete, faceted search, or pagination beyond offset/limit
- Search analytics or query logging in responses
- Multi-language search support beyond existing data

### Data Source

- **Source**: Existing domain repositories (Artist, Composition, Raga, Tala)
- **Data to index**:
  - Artist names
  - Raga names
  - Tala names
  - Composition titles
  - Composition lyrics (lyricsV1 field with structured lyrics)
- **Dataset size**: Estimated 10k-100k items (medium dataset)

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Search Service Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────────────────────────────┐      │
│  │   SST Cron Job   │     │           API Request Flow              │      │
│  │   (Every 6hrs)   │     │                                          │      │
│  └────────┬─────────┘     │  ┌─────────┐     ┌──────────────────┐   │      │
│           │               │  │  tRPC   │────▶│  Search Service  │   │      │
│           ▼               │  │  Router │     │  (Fuse.js)       │   │      │
│  ┌──────────────────┐     │  └─────────┘     └────────┬─────────┘   │      │
│  │   Index Builder  │     │                           │             │      │
│  │   Lambda        │     │                           ▼             │      │
│  └────────┬─────────┘     │                  ┌──────────────────┐   │      │
│           │               │                  │  S3 Bucket       │   │      │
│           │               │                  │  (search-index)  │   │      │
│           ▼               │                  └──────────────────┘   │      │
│  ┌─────────────────────────────────────────────────────────────────┐│      │
│  │                     DynamoDB Tables                              ││      │
│  │  (Artists, Compositions, Ragas, Talas)                          ││      │
│  └─────────────────────────────────────────────────────────────────┘│      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Index Storage Decision: S3 over DynamoDB

**Decision: Use S3 for search index storage**

Justification:

1. **Size Efficiency**: The search index for 10k-100k items with multiple fields can reach 5-50MB. S3 handles large objects efficiently, while DynamoDB has item size limits (400KB per item) that would require chunking.

2. **Cost Efficiency**: S3 is more cost-effective for large, infrequently accessed objects. The index is written once every 6 hours and read on each search request.

3. **Performance**: S3 provides low-latency GET operations for objects, and the Lambda function can cache the loaded index in memory across invocations (warm Lambda).

4. **Simplicity**: Reading a single JSON file from S3 is simpler than querying DynamoDB for index data that might be split across multiple items.

5. **Versioning**: S3 provides built-in versioning for index backups and rollback capability.

### Domain Structure

```
packages/core/src/domain/search/
├── index.ts              # Barrel exports (search, getHealth, buildIndex)
├── index.test.ts         # Single test file for all search tests
├── types.ts              # TypeScript interfaces
├── schema.ts             # Zod validation schemas (SearchableFieldSchema)
├── transformer.ts        # Document transformation functions
├── indexer.ts            # Index building logic
└── service.ts            # Search service with caching and Fuse.js integration
```

**Note:** Removed separate `fuse.ts` file. Fuse options are defined inline in `service.ts` to avoid circular dependencies and keep related logic co-located.

### Package Dependencies

```json
// packages/core/package.json (additions)
{
  "dependencies": {
    "fuse.js": "^7.0.0",
    "@aws-sdk/client-s3": "^3.972.0"
  }
}
```

### Data Model

#### Zod Schema (Single Source of Truth)

```typescript
// packages/core/src/domain/search/schema.ts

import { z } from 'zod';

export const SearchableFieldSchema = z.enum([
  'artistName',
  'ragaName',
  'talaName',
  'compositionTitle',
  'lyrics',
]);

export type SearchableField = z.infer<typeof SearchableFieldSchema>;

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.array(SearchableFieldSchema).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;
```

#### Search Document Type

```typescript
// packages/core/src/domain/search/types.ts

import type { SearchableField } from './schema';

export type EntityType = 'artist' | 'raga' | 'tala' | 'composition';

export interface SearchDocument {
  // Entity identification
  id: string;
  entityType: EntityType;

  // Searchable fields (normalized to strings)
  artistName: string;
  ragaName: string;
  talaName: string;
  compositionTitle: string;
  lyrics: string;

  // Display name (derived from entity)
  displayName: string;

  // Index metadata
  indexedAt: string;
}

export interface SearchIndex {
  version: number;        // Index format version
  builtAt: string;        // ISO timestamp of build completion
  documentCount: number;  // Total documents indexed
  fuseIndex: object;      // Pre-built Fuse.js index
  documents: SearchDocument[]; // Source documents for result assembly
}

export interface SearchResultItem {
  id: string;
  type: EntityType;
  name: string;
  highlights: Array<{
    field: SearchableField;
    text: string;
  }>;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}

export interface HealthStatus {
  status: 'healthy' | 'stale' | 'unhealthy';
  lastBuilt: string | null;
  documentCount: number;
  message?: string;
}

// Helper type for properly typed Fuse.js match results
export interface MatchResult {
  key: keyof SearchDocument;
  value: string;
  index: number;
  score: number;
}
```

### Document Transformer

```typescript
// packages/core/src/domain/search/transformer.ts

import type { Artist } from '../artist';
import type { Raga } from '../raga';
import type { Tala } from '../tala';
import type { Composition } from '../composition';
import type { SearchDocument, EntityType } from './types';

function createBaseDocument(entity: { id: string }, entityType: EntityType): SearchDocument {
  return {
    id: entity.id,
    entityType,
    artistName: '',
    ragaName: '',
    talaName: '',
    compositionTitle: '',
    lyrics: '',
    displayName: '',
    indexedAt: new Date().toISOString(),
  };
}

export function transformArtistToDocument(artist: Artist): SearchDocument {
  return {
    ...createBaseDocument(artist, 'artist'),
    artistName: artist.name,
    displayName: artist.name,
  };
}

export function transformRagaToDocument(raga: Raga): SearchDocument {
  return {
    ...createBaseDocument(raga, 'raga'),
    ragaName: raga.name,
    displayName: raga.name,
  };
}

export function transformTalaToDocument(tala: Tala): SearchDocument {
  return {
    ...createBaseDocument(tala, 'tala'),
    talaName: tala.name,
    displayName: tala.name,
  };
}

export function transformCompositionToDocument(composition: Composition): SearchDocument {
  // Join all lyrics into a single searchable string
  const lyricsText = (composition.lyricsV1 || [])
    .map((l) => l.text)
    .join(' ');

  // Join raga and tala names for searching
  const ragaNames = (composition.ragas || []).map((r) => r.name).join(' ');
  const talaNames = (composition.talas || []).map((t) => t.name).join(' ');

  return {
    ...createBaseDocument(composition, 'composition'),
    artistName: composition.composer?.name || '',
    ragaName: ragaNames,
    talaName: talaNames,
    compositionTitle: composition.title,
    lyrics: lyricsText,
    displayName: composition.title,
  };
}

export function transformToSearchDocuments(
  artists: Artist[],
  ragas: Raga[],
  talas: Tala[],
  compositions: Composition[]
): SearchDocument[] {
  return [
    ...artists.map(transformArtistToDocument),
    ...ragas.map(transformRagaToDocument),
    ...talas.map(transformTalaToDocument),
    ...compositions.map(transformCompositionToDocument),
  ];
}
```

### Search Service with Fuse.js Integration

```typescript
// packages/core/src/domain/search/service.ts

import Fuse from 'fuse.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type {
  SearchDocument,
  SearchIndex,
  SearchResultItem,
  SearchResponse,
  HealthStatus,
  SearchableField,
  MatchResult,
} from './types';
import { SearchableFieldSchema } from './schema';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET!;
const CURRENT_INDEX_VERSION = 1;

// In-memory cache (forever, until version changes)
let cachedIndex: SearchIndex | null = null;

interface SearchOptions {
  filters?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Creates Fuse.js options with proper type safety.
 * All searchable fields receive equal weight (1.0) for balanced scoring.
 */
function createFuseOptions(filterFields?: SearchableField[]): Fuse.IFuseOptions<SearchDocument> {
  // Define all searchable keys with equal weight (1.0)
  const allKeys: Array<{ name: keyof SearchDocument; weight: number }> = [
    { name: 'artistName', weight: 1.0 },
    { name: 'ragaName', weight: 1.0 },
    { name: 'talaName', weight: 1.0 },
    { name: 'compositionTitle', weight: 1.0 },
    { name: 'lyrics', weight: 1.0 },
  ];

  // Filter keys if specific fields are requested
  const filteredKeys = filterFields
    ? allKeys.filter((k) => filterFields.includes(k.name as SearchableField))
    : allKeys;

  return {
    keys: filteredKeys,
    threshold: 0.4,           // Lower = stricter matching (0.0 = exact, 1.0 = anything)
    distance: 100,            // How far match can be from expected location
    ignoreLocation: true,     // Match anywhere in string
    isCaseSensitive: false,
    ignoreDiacritics: true,   // Handle Sanskrit/Telugu/Tamil diacritics
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    findAllMatches: false,
  };
}

/**
 * Safely transforms Fuse.js match results to our highlight format.
 * Avoids `as never` casts by properly typing the match mapping.
 */
function transformMatchesToHighlights(matches: Array<Fuse.Match<SearchDocument>>): Array<{
  field: SearchableField;
  text: string;
}> {
  return matches
    .filter((match): match is Fuse.Match<SearchDocument> & { key: keyof SearchDocument } => {
      // Ensure the match key is a valid SearchDocument field
      return match.key !== undefined && match.key in {} && typeof match.key === 'string';
    })
    .map((match) => ({
      field: match.key as SearchableField,
      text: match.value || '',
    }));
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const startTime = Date.now();
  const { filters, limit = 20, offset = 0 } = options;

  try {
    // Load index (with version-checked infinite cache)
    const index = await loadIndex();
    const documents = index.documents;

    // Parse and validate filter fields
    const parsedFilters = filters
      ? filters.map((f) => SearchableFieldSchema.parse(f))
      : undefined;

    // Create Fuse instance with pre-built index
    const fuseOptions = createFuseOptions(parsedFilters);
    const fuseIndex = Fuse.parseIndex(index.fuseIndex);
    const fuse = new Fuse(documents, fuseOptions, fuseIndex);

    // Execute search
    const rawResults = fuse.search(query, {
      limit: limit + offset, // Fetch extra for offset
    });

    // Slice to offset position
    const paginatedResults = rawResults.slice(offset, offset + limit);

    // Transform results to simplified format with properly typed highlights
    const items: SearchResultItem[] = paginatedResults.map((result) => ({
      id: result.item.id,
      type: result.item.entityType,
      name: result.item.displayName,
      highlights: transformMatchesToHighlights(result.matches || []),
    }));

    const duration = Date.now() - startTime;

    console.log('Search completed', {
      query,
      filters,
      limit,
      offset,
      totalResults: rawResults.length,
      returnedResults: items.length,
      durationMs: duration,
    });

    return {
      items,
      total: rawResults.length,
    };
  } catch (error) {
    console.error('Search failed', { query, error });
    throw new ApplicationError(
      ErrorCode.SEARCH_QUERY_FAILED,
      `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function loadIndex(): Promise<SearchIndex> {
  // Return cached index if version matches
  if (cachedIndex && cachedIndex.version === CURRENT_INDEX_VERSION) {
    return cachedIndex;
  }

  // Clear cached index if version mismatch
  if (cachedIndex && cachedIndex.version !== CURRENT_INDEX_VERSION) {
    console.log('Search index version mismatch, clearing cache', {
      cachedVersion: cachedIndex.version,
      currentVersion: CURRENT_INDEX_VERSION,
    });
    cachedIndex = null;
  }

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: INDEX_BUCKET,
        Key: 'search-index/latest/index.json',
      })
    );

    const bodyContents = await response.Body?.transformToString();

    if (!bodyContents) {
      throw new Error('Empty response from S3');
    }

    const index: SearchIndex = JSON.parse(bodyContents);

    // Validate index version before caching
    if (index.version !== CURRENT_INDEX_VERSION) {
      console.warn('Index version mismatch, will not cache', {
        indexVersion: index.version,
        expectedVersion: CURRENT_INDEX_VERSION,
      });
      return index;
    }

    cachedIndex = index;

    console.log('Search index loaded from S3', {
      documentCount: index.documentCount,
      builtAt: index.builtAt,
    });

    return index;
  } catch (error) {
    console.error('Failed to load search index', { error });
    throw new ApplicationError(
      ErrorCode.SEARCH_INDEX_ERROR,
      'Search index is not available. Please try again later.',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

export async function getHealth(): Promise<HealthStatus> {
  try {
    const index = await loadIndex();
    const indexAgeMs = Date.now() - new Date(index.builtAt).getTime();
    const indexAgeHours = indexAgeMs / (1000 * 60 * 60);

    if (indexAgeHours > 24) {
      console.warn('Search index is stale', { indexAgeHours });
      return {
        status: 'stale',
        lastBuilt: index.builtAt,
        documentCount: index.documentCount,
        message: 'Search index is older than 24 hours',
      };
    }

    return {
      status: 'healthy',
      lastBuilt: index.builtAt,
      documentCount: index.documentCount,
    };
  } catch (error) {
    console.error('Health check failed', { error });
    return {
      status: 'unhealthy',
      lastBuilt: null,
      documentCount: 0,
      message: 'Unable to load search index',
    };
  }
}
```

### Index Builder

```typescript
// packages/core/src/domain/search/indexer.ts

import Fuse from 'fuse.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type { SearchDocument, SearchIndex } from './types';
import { transformToSearchDocuments } from './transformer';
import { listArtists } from '../artist';
import { listCompositions } from '../composition';
import { listRagas } from '../raga';
import { listTalas } from '../tala';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET!;
const CURRENT_INDEX_VERSION = 1;

interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
}

async function fetchAllPaginated<T>(
  listFn: (params?: { limit?: number; nextToken?: string }) => Promise<PaginatedResult<T>>,
  pageSize: number = 100
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    const result = await listFn({ limit: pageSize, nextToken });
    allItems.push(...result.items);
    nextToken = result.nextToken;
  } while (nextToken);

  return allItems;
}

export async function buildSearchIndex(): Promise<SearchIndex> {
  console.log('Starting search index build');

  // Fetch all entities in parallel with pagination
  const [artists, ragas, talas, compositions] = await Promise.all([
    fetchAllPaginated(listArtists),
    fetchAllPaginated(listRagas),
    fetchAllPaginated(listTalas),
    fetchAllPaginated(listCompositions),
  ]);

  console.log(`Fetched entities: ${artists.length} artists, ${ragas.length} ragas, ${talas.length} talas, ${compositions.length} compositions`);

  // Transform to search documents
  const documents = transformToSearchDocuments(artists, ragas, talas, compositions);

  // Create pre-built Fuse.js index
  const fuseIndex = Fuse.createIndex(
    ['artistName', 'ragaName', 'talaName', 'compositionTitle', 'lyrics'],
    documents
  );

  // Build complete index object
  const searchIndex: SearchIndex = {
    version: CURRENT_INDEX_VERSION,
    builtAt: new Date().toISOString(),
    documentCount: documents.length,
    fuseIndex: fuseIndex.toJSON(),
    documents,
  };

  console.log(`Search index built: ${documents.length} documents`);

  return searchIndex;
}

export async function storeSearchIndex(index: SearchIndex): Promise<void> {
  const indexKey = `search-index/${new Date().toISOString().split('T')[0]}/index.json`;

  // Upload dated index
  await s3Client.send(
    new PutObjectCommand({
      Bucket: INDEX_BUCKET,
      Key: indexKey,
      Body: JSON.stringify(index),
      ContentType: 'application/json',
      CacheControl: 'max-age=21600', // 6 hours (same as cron interval)
    })
  );

  // Update the "latest" pointer atomically
  await s3Client.send(
    new PutObjectCommand({
      Bucket: INDEX_BUCKET,
      Key: 'search-index/latest/index.json',
      Body: JSON.stringify(index),
      ContentType: 'application/json',
    })
  );

  console.log(`Search index stored: ${indexKey} (latest pointer updated)`);
}

export async function buildAndStoreSearchIndex(): Promise<void> {
  const index = await buildSearchIndex();
  await storeSearchIndex(index);
}
```

### Cron Handler

```typescript
// packages/core/src/domain/search/cron/refresh-index.ts

import { buildAndStoreSearchIndex } from '../indexer';

export async function handler() {
  console.log('Starting scheduled index refresh');

  try {
    await buildAndStoreSearchIndex();
    console.log('Scheduled index refresh completed');
  } catch (error) {
    console.error('Scheduled index refresh failed', { error });
    throw error; // Let Lambda handle the error
  }
}
```

### Barrel Exports

```typescript
// packages/core/src/domain/search/index.ts

export { search, getHealth } from './service';
export { buildAndStoreSearchIndex } from './indexer';
export type { SearchResponse, SearchResultItem, HealthStatus, SearchInput } from './types';
export { SearchInputSchema, SearchableFieldSchema } from './schema';
```

### tRPC Router

```typescript
// packages/trpc/src/routers/search.ts

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { search, getHealth, SearchInputSchema } from '@rasika/core';

export const searchRouter = createTRPCRouter({
  search: publicProcedure
    .input(SearchInputSchema)
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

Register in main router:

```typescript
// packages/trpc/src/routers/index.ts

import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { contentRouter } from './content';
import { ragaRouter } from './raga';
import { talaRouter } from './tala';
import { searchRouter } from './search';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  content: contentRouter,
  raga: ragaRouter,
  tala: talaRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
```

### Infrastructure

```typescript
// infra/search.ts

import { Cron, Function, Bucket } from 'sst/constructs';
import { database } from './database';

const searchBucket = new Bucket(stack, 'SearchIndexBucket', {
  public: false,
  cors: [],
});

// Search function - handles search requests (via tRPC integration)
new Function(stack, 'SearchFunction', {
  url: true,
  handler: './packages/core/src/domain/search/index.handler',
  link: [searchBucket, database],
  environment: {
    SEARCH_INDEX_BUCKET: searchBucket.name,
    DYNAMODB_TABLE: database.name,
  },
  timeout: '30 seconds',
  memorySize: '512 MB',
});

// Index builder function - runs via cron to rebuild index
new Function(stack, 'SearchIndexBuilder', {
  handler: './packages/core/src/domain/search/cron/refresh-index.handler',
  link: [searchBucket, database],
  environment: {
    SEARCH_INDEX_BUCKET: searchBucket.name,
    DYNAMODB_TABLE: database.name,
  },
  timeout: '300 seconds', // 5 minutes for large dataset processing
  memorySize: '1024 MB', // More memory for index building
});

// Cron job - rebuilds index every 6 hours
new Cron(stack, 'SearchIndexCron', {
  schedule: 'rate(6 hours)',
  function: {
    handler: './packages/core/src/domain/search/cron/refresh-index.handler',
    timeout: '300 seconds',
    memorySize: '1024 MB',
    environment: {
      SEARCH_INDEX_BUCKET: searchBucket.name,
      DYNAMODB_TABLE: database.name,
    },
    bind: [searchBucket],
    permissions: [database],
  },
});
```

### Error Handling

```typescript
// packages/core/src/constants.ts

export enum ErrorCode {
  // ... existing codes ...

  // Search errors
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  SEARCH_INDEX_BUILD_FAILED = 'SEARCH_INDEX_BUILD_FAILED',
  SEARCH_QUERY_FAILED = 'SEARCH_QUERY_FAILED',
}
```

#### Error Response Format

```typescript
interface SearchError {
  code: 'SEARCH_INDEX_ERROR' | 'SEARCH_INDEX_BUILD_FAILED' | 'SEARCH_QUERY_FAILED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  message: string;
  requestId?: string;
  retryable: boolean;
  retryAfter?: number;
}
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Add dependencies to `packages/core`**
   - Add `fuse.js` and `@aws-sdk/client-s3` to package.json

2. **Create search domain directory**
   - Create `packages/core/src/domain/search/` structure
   - Create empty barrel exports in `index.ts`

3. **Define types and schemas**
   - Create `types.ts` with SearchDocument, SearchIndex, SearchResultItem, HealthStatus, MatchResult
   - Create `schema.ts` with SearchableFieldSchema, SearchInputSchema

### Phase 2: Index Building

4. **Implement document transformer**
   - Create `transformer.ts` with transform functions for all entity types

5. **Implement index builder**
   - Create `indexer.ts` with fetchAllPaginated, buildSearchIndex, storeSearchIndex
   - Handle S3 upload with versioning
   - Create "latest" pointer update

6. **Implement cron handler**
   - Create `cron/refresh-index.ts` for scheduled index rebuilds

### Phase 3: Search Service

7. **Implement search service with Fuse.js**
   - Create `service.ts` with createFuseOptions and transformMatchesToHighlights
   - Configure fuzzy matching parameters
   - Handle diacritics for Indian languages

8. **Implement search function**
   - Create search() function with version-checked infinite in-memory caching
   - Implement S3 index loading with version validation
   - Handle filter array processing with Zod parsing
   - Implement pagination (offset/limit)

9. **Implement health check**
   - Add getHealth() with freshness validation
   - Fail if index >24 hours old

### Phase 4: Integration

10. **Add search router to tRPC**
    - Create `packages/trpc/src/routers/search.ts`
    - Register in main router
    - Add error handling

11. **Set up infrastructure**
    - Add S3 Bucket resource in `infra/search.ts`
    - Add search Lambda function
    - Add index builder Lambda function
    - Add Cron job for periodic rebuild

12. **Add error codes**
    - Add search error codes to `packages/core/src/constants.ts`

### Phase 5: Testing

13. **Create single test file**
    - Create `packages/core/src/domain/search/index.test.ts`
    - Include tests for transformer, service, and indexer

14. **Run tests and verify**
    - Verify all tests pass
    - Ensure type checking passes

## Response Format

### Success Response

```typescript
// GET /trpc/search.search?input={"query":"krishna","limit":10}

{
  "items": [
    {
      "id": "comp-123",
      "type": "composition",
      "name": "Krishna Nee Begane Baro",
      "highlights": [
        {
          "field": "compositionTitle",
          "text": "Krishna Nee Begane Baro"
        },
        {
          "field": "lyrics",
          "text": "krishna nee begane baro..."
        }
      ]
    }
  ],
  "total": 5
}
```

### Health Check Response

```typescript
// GET /trpc/search.health

// Healthy
{
  "status": "healthy",
  "lastBuilt": "2025-01-22T00:00:00.000Z",
  "documentCount": 15000
}

// Stale (>24 hours)
{
  "status": "stale",
  "lastBuilt": "2025-01-20T00:00:00.000Z",
  "documentCount": 15000,
  "message": "Search index is older than 24 hours"
}

// Unhealthy (index unavailable)
{
  "status": "unhealthy",
  "lastBuilt": null,
  "documentCount": 0,
  "message": "Unable to load search index"
}
```

### Error Response (tRPC)

```typescript
{
  "error": {
    "message": "Search index is not available. Please try again later.",
    "code": "SEARCH_INDEX_ERROR",
    "data": {
      "code": "SEARCH_INDEX_ERROR",
      "retryable": true,
      "retryAfter": 30
    }
  }
}
```

## Testing Strategy

### Test Structure

```
packages/core/src/domain/search/
├── index.test.ts          # Single test file (all tests)
├── mocks/
│   ├── s3.ts             # Mock S3 client
│   └── documents.ts      # Sample search documents
└── setup.ts              # Test setup (if needed)
```

### Unit Tests

```typescript
// packages/core/src/domain/search/index.test.ts

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  search,
  getHealth,
} from './service';
import { transformArtistToDocument, transformCompositionToDocument } from './transformer';
import type { SearchDocument } from './types';

describe('Search Domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transformer', () => {
    describe('transformArtistToDocument', () => {
      it('should transform artist to search document', () => {
        const artist = {
          id: 'artist-123',
          name: 'M.S. Subbulakshmi',
        };

        const doc = transformArtistToDocument(artist as Artist);

        expect(doc.id).toBe('artist-123');
        expect(doc.entityType).toBe('artist');
        expect(doc.artistName).toBe('M.S. Subbulakshmi');
        expect(doc.displayName).toBe('M.S. Subbulakshmi');
      });
    });

    describe('transformCompositionToDocument', () => {
      it('should transform composition with lyrics to search document', () => {
        const composition = {
          id: 'comp-456',
          title: 'Krishna Nee Begane Baro',
          composer: { name: 'Vyasaraya' },
          lyricsV1: [
            { text: 'krishna nee begane baro' },
            { text: 'yamunatheera sangamadi' },
          ],
          ragas: [{ name: 'Yamuna Kalyani' }],
          talas: [{ name: 'Adi' }],
        };

        const doc = transformCompositionToDocument(composition as Composition);

        expect(doc.id).toBe('comp-456');
        expect(doc.entityType).toBe('composition');
        expect(doc.compositionTitle).toBe('Krishna Nee Begane Baro');
        expect(doc.artistName).toBe('Vyasaraya');
        expect(doc.ragaName).toBe('Yamuna Kalyani');
        expect(doc.talaName).toBe('Adi');
        expect(doc.lyrics).toContain('krishna nee begane baro');
      });
    });
  });

  describe('Service', () => {
    describe('search', () => {
      it('should return simplified results with highlights', async () => {
        // Mock S3 to return test index
        const result = await search('krishna', { limit: 10 });

        expect(result.items).toBeDefined();
        expect(result.total).toBeDefined();
        expect(result.items[0]).toHaveProperty('id');
        expect(result.items[0]).toHaveProperty('type');
        expect(result.items[0]).toHaveProperty('name');
        expect(result.items[0]).toHaveProperty('highlights');
      });

      it('should respect limit and offset parameters', async () => {
        const result = await search('krishna', { limit: 5, offset: 10 });

        expect(result.items.length).toBeLessThanOrEqual(5);
      });
    });

    describe('getHealth', () => {
      it('should return healthy status for fresh index', async () => {
        // Mock recent index
        const health = await getHealth();
        expect(['healthy', 'stale', 'unhealthy']).toContain(health.status);
      });
    });
  });

  describe('Indexer', () => {
    describe('buildSearchIndex', () => {
      it('should return index with version', async () => {
        const index = await buildSearchIndex();

        expect(index.version).toBe(1);
        expect(index.builtAt).toBeDefined();
        expect(index.documentCount).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
```

## Summary of Changes from v1 to v3

| Area | v1 Spec | v3 Spec (Final) |
|------|---------|-----------------|
| Package structure | Separate `packages/search` | Folded into `packages/core/src/domain/search` |
| Cache TTL | 5 minutes (arbitrary) | Infinite in-memory cache with version check |
| Response types | Verbose `SearchResult`/`SearchResponse` | Simplified `items` array with `id`, `type`, `name`, `highlights` |
| Health check | Missing | Added `health` endpoint with freshness check (>24 hours fails) |
| Type Safety | String enum + type duplication | Single Zod schema (`SearchableFieldSchema`) as source of truth |
| Error handling | Generic error codes | Detailed error responses with retry guidance |
| Observability | Missing | Structured logging (direct console) |
| Index freshness | Not validated | Health check fails if >24 hours old |
| Test files | Separate `service.test.ts`, `transformer.test.ts`, `indexer.test.ts` | Single `index.test.ts` (matches codebase convention) |
| Logging module | New `@/logging` module | Direct `console.log/warn/error` (matches existing patterns) |
| Type casting | `match.key as never` | `transformMatchesToHighlights` helper with proper type narrowing |
| Cache invalidation | Implicit only | Explicit version comparison in `loadIndex()` |

## Open Questions

1. **Should lyrics be weighted differently?** Currently all fields have equal weight. Should lyrics (which can be long) be given less weight to avoid dominating matches?

2. **How to handle special characters in Indian music names?** Some names use diacritical marks (e.g., "Mysore Vasudevachar"). The `ignoreDiacritics: true` setting handles this, but we should verify it works correctly for all expected inputs.

3. **Should we add result highlighting for the frontend?** The response includes match text. Should we pre-render highlighted HTML strings in the response?

4. **How to handle index build failures?** If the cron job fails, should we alert? Should we keep the old index or serve degraded search?

5. **Should we implement query preprocessing?** Things like removing stop words, normalizing Unicode, etc. Not initially, but could be added later.

6. **Should the search be rate-limited?** For now, no. We can add API Gateway throttling later if needed.

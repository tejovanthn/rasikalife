# Fuse.js Search Service

## Overview

This specification describes the implementation of a fuzzy search service using Fuse.js for the Rasika.life Indian classical arts community platform. The service enables unified searching across artists, ragas, talas, compositions (with titles and lyrics) with fuzzy matching, typo tolerance, and field-level filtering.

The search index is built periodically (every 6 hours) via an SST Cron job that scans DynamoDB and stores the index in S3 for fast retrieval by the search Lambda.

## Requirements

### Functional Requirements

1. **Unified Search**: Search across all entity types (artist names, raga names, tala names, composition titles, composition lyrics) in a single query
2. **Fuzzy Matching**: Enable approximate string matching with typo tolerance using Fuse.js
3. **Equal Weightage**: All searchable fields receive equal weight in scoring (no field bias)
4. **Field-Level Filtering**: Allow filtering search to specific fields via structured input arrays
5. **Scored Results**: Return relevance scores for result ranking
6. **Match Highlighting**: Provide highlighted matches for display purposes
7. **Periodic Index Updates**: Rebuild search index every 6 hours via scheduled cron job

### Non-Requirements

- Real-time index updates (6-hour refresh is acceptable)
- Advanced features like autocomplete, faceted search, or pagination
- Search analytics or query logging
- Multi-language search support beyond existing data

### Data Source

- **Source**: Existing repositories (ArtistRepository, CompositionRepository, RagaRepository, TalaRepository)
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
│           │               │  │  tRPC   │────▶│  Search Lambda   │   │      │
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

### Data Model

#### Search Document Structure

Each searchable entity is transformed into a flattened search document:

```typescript
// packages/core/src/domain/search/types.ts

export type SearchableField = 
  | 'artistName'
  | 'ragaName'
  | 'talaName'
  | 'compositionTitle'
  | 'lyrics';

export interface SearchDocument {
  // Entity identification
  id: string;
  entityType: 'artist' | 'raga' | 'tala' | 'composition';

  // Searchable fields (normalized to strings)
  artistName: string;
  ragaName: string;
  talaName: string;
  compositionTitle: string;
  lyrics: string;

  // Original entity data (for response)
  entity: {
    // Common fields
    id: string;
    name: string;
    type: string;

    // Composition-specific fields
    composer?: { id: string; name: string };
    language?: string;
    lyricsV1?: Array<{
      type: string;
      order: number;
      text: string;
      number?: number;
      ragaName?: string;
    }>;
    ragas?: Array<{ id: string; name: string }>;
    talas?: Array<{ id: string; name: string }>;
    sourceAttribution?: string;
  };

  // Index metadata
  indexedAt: string;
}
```

#### Index File Structure

The S3 index file contains:

```typescript
// packages/core/src/domain/search/types.ts

export interface SearchIndex {
  version: number;        // Index format version
  builtAt: string;        // ISO timestamp of build completion
  documentCount: number;  // Total documents indexed
  fuseIndex: object;      // Pre-built Fuse.js index
  documents: SearchDocument[]; // Source documents for result assembly
}
```

### Fuse.js Configuration

For equal weightage across all fields with fuzzy matching:

```typescript
// packages/core/src/domain/search/fuse.ts

import Fuse from 'fuse.js';

export const createFuseOptions = (filterFields?: SearchableField[]): Fuse.IFuseOptions<SearchDocument> => {
  // Define all searchable keys with equal weight (1.0)
  const keys: Array<{ name: keyof SearchDocument; weight: number }> = [
    { name: 'artistName', weight: 1.0 },
    { name: 'ragaName', weight: 1.0 },
    { name: 'talaName', weight: 1.0 },
    { name: 'compositionTitle', weight: 1.0 },
    { name: 'lyrics', weight: 1.0 },
  ];

  // Filter keys if specific fields are requested
  const filteredKeys = filterFields
    ? keys.filter((k) => filterFields.includes(k.name as SearchableField))
    : keys;

  return {
    // Keys to search
    keys: filteredKeys,

    // Fuzzy matching settings
    threshold: 0.4, // Lower = stricter matching (0.0 = exact, 1.0 = anything)
    distance: 100, // How far match can be from expected location
    ignoreLocation: true, // Match anywhere in string

    // Case handling for Indian music names
    isCaseSensitive: false,
    ignoreDiacritics: true, // Handle Sanskrit/Telugu/Tamil diacritics

    // Include scoring and matches for response
    includeScore: true,
    includeMatches: true,

    // Sorting
    shouldSort: true,

    // Continue matching after perfect match
    findAllMatches: false,
  };
};
```

### Index Build Process

#### Data Fetching Strategy

The index builder uses parallel fetching for efficiency:

```typescript
// packages/core/src/domain/search/indexer.ts

import { listArtists } from '../artist';
import { listCompositions } from '../composition';
import { listRagas } from '../raga';
import { listTalas } from '../tala';
import type { SearchDocument } from './types';

interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
}

async function fetchAllDocuments(): Promise<SearchDocument[]> {
  // Fetch all entities in parallel with pagination
  const [artists, ragas, talas, compositions] = await Promise.all([
    fetchAllPaginated<Artist>(listArtists),
    fetchAllPaginated<Raga>(listRagas),
    fetchAllPaginated<Tala>(listTalas),
    fetchAllPaginated<Composition>(listCompositions),
  ]);

  // Transform to search documents
  const documents: SearchDocument[] = [
    ...artists.map(transformArtistToDocument),
    ...ragas.map(transformRagaToDocument),
    ...talas.map(transformTalaToDocument),
    ...compositions.map(transformCompositionToDocument),
  ];

  return documents;
}

async function fetchAllPaginated<T>(
  listFn: (params?: { limit?: number; nextToken?: string }) => Promise<PaginatedResult<T>>
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;
  const limit = 100; // Page size

  do {
    const result = await listFn({ limit, nextToken });
    allItems.push(...result.items);
    nextToken = result.nextToken;
  } while (nextToken);

  return allItems;
}
```

#### Document Transformation

```typescript
// packages/core/src/domain/search/indexer.ts

function transformArtistToDocument(artist: Artist): SearchDocument {
  return {
    id: artist.id,
    entityType: 'artist',
    artistName: artist.name,
    ragaName: '',
    talaName: '',
    compositionTitle: '',
    lyrics: '',
    entity: {
      id: artist.id,
      name: artist.name,
      type: 'artist',
    },
    indexedAt: new Date().toISOString(),
  };
}

function transformCompositionToDocument(composition: Composition): SearchDocument {
  // Join all lyrics into a single searchable string
  const lyricsText = (composition.lyricsV1 || [])
    .map((l) => l.text)
    .join(' ');

  // Join raga and tala names for searching
  const ragaNames = (composition.ragas || []).map((r) => r.name).join(' ');
  const talaNames = (composition.talas || []).map((t) => t.name).join(' ');

  return {
    id: composition.id,
    entityType: 'composition',
    artistName: composition.composer?.name || '',
    ragaName: ragaNames,
    talaName: talaNames,
    compositionTitle: composition.title,
    lyrics: lyricsText,
    entity: {
      id: composition.id,
      name: composition.title,
      type: 'composition',
      composer: composition.composer,
      language: composition.language,
      lyricsV1: composition.lyricsV1,
      ragas: composition.ragas,
      talas: composition.talas,
      sourceAttribution: composition.sourceAttribution,
    },
    indexedAt: new Date().toISOString(),
  };
}
```

#### Index Building and Storage

```typescript
// packages/core/src/domain/search/indexer.ts

import Fuse from 'fuse.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function buildAndStoreSearchIndex(): Promise<void> {
  // Step 1: Fetch all documents
  const documents = await fetchAllDocuments();

  // Step 2: Create Fuse.js index
  // Using pre-built index for performance with large datasets
  const fuseIndex = Fuse.createIndex(
    ['artistName', 'ragaName', 'talaName', 'compositionTitle', 'lyrics'],
    documents
  );

  // Step 3: Build complete index object
  const searchIndex: SearchIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    documentCount: documents.length,
    fuseIndex: fuseIndex.toJSON(),
    documents, // Store documents for result assembly
  };

  // Step 4: Upload to S3
  const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const indexKey = `search-index/${new Date().toISOString().split('T')[0]}/index.json`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.SEARCH_INDEX_BUCKET,
      Key: indexKey,
      Body: JSON.stringify(searchIndex),
      ContentType: 'application/json',
      CacheControl: 'max-age=21600', // 6 hours (same as cron interval)
    })
  );

  // Also update the "latest" pointer
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.SEARCH_INDEX_BUCKET,
      Key: 'search-index/latest/index.json',
      Body: JSON.stringify(searchIndex),
      ContentType: 'application/json',
    })
  );

  console.log(`Search index built: ${documents.length} documents stored at ${indexKey}`);
}
```

### Search API

#### tRPC Router Definition

```typescript
// packages/trpc/src/routers/search.ts

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { search } from '@rasika/core';

export const searchRouter = createTRPCRouter({
  // Main search endpoint
  search: publicProcedure
    .input(
      z.object({
        // Search query (required)
        query: z.string().min(1).max(100),

        // Optional field filters - specify which fields to search
        filters: z
          .array(
            z.enum(['artistName', 'ragaName', 'talaName', 'compositionTitle', 'lyrics'])
          )
          .optional(),

        // Result limit (default 20, max 100)
        limit: z.number().min(1).max(100).optional(),

        // Result offset for pagination (default 0)
        offset: z.number().min(0).optional(),
      })
    )
    .query(({ input }) =>
      search.search(input.query, {
        filters: input.filters,
        limit: input.limit,
        offset: input.offset,
      })
    ),

  // Get search index status (for debugging/monitoring)
  status: publicProcedure.query(() => search.getIndexStatus()),
});
```

#### Search Service Implementation

```typescript
// packages/core/src/domain/search/index.ts

import Fuse from 'fuse.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import type { SearchDocument, SearchIndex, SearchableField } from './types';
import { createFuseOptions } from './fuse';

// In-memory cache for the search index
let cachedIndex: SearchIndex | null = null;
let cacheExpiry: number = 0;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export interface SearchResult {
  document: SearchDocument;
  score: number;
  matches: Array<{
    key: string;
    indices: Array<[number, number]>;
    value: string;
  }>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters?: SearchableField[];
  took: number; // Query time in milliseconds
}

export interface SearchOptions {
  filters?: SearchableField[];
  limit?: number;
  offset?: number;
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const { filters, limit = 20, offset = 0 } = options;

  // Load index (with caching)
  const index = await loadSearchIndex();
  const documents = index.documents;

  // Create Fuse instance with pre-built index
  const fuseOptions = createFuseOptions(filters);
  const fuseIndex = Fuse.parseIndex(index.fuseIndex);
  const fuse = new Fuse(documents, fuseOptions, fuseIndex);

  // Execute search
  const rawResults = fuse.search(query, {
    limit: limit + offset, // Fetch extra for offset
  });

  // Slice to offset position
  const paginatedResults = rawResults.slice(offset, offset + limit);

  // Transform results
  const results: SearchResult[] = paginatedResults.map((result) => ({
    document: result.item,
    score: result.score ?? 1,
    matches: (result.matches || []).map((match) => ({
      key: match.key,
      indices: Array.from(match.indices),
      value: match.value,
    })),
  }));

  return {
    results,
    total: rawResults.length,
    query,
    filters,
    took: Date.now() - startTime,
  };
}

async function loadSearchIndex(): Promise<SearchIndex> {
  const now = Date.now();

  // Return cached index if still valid
  if (cachedIndex && cacheExpiry > now) {
    return cachedIndex;
  }

  // Fetch from S3
  const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const command = new GetObjectCommand({
    Bucket: process.env.SEARCH_INDEX_BUCKET,
    Key: 'search-index/latest/index.json',
  });

  const response = await s3Client.send(command);
  const bodyContents = await response.Body?.transformToString();
  
  if (!bodyContents) {
    throw new Error('Failed to load search index');
  }

  const index: SearchIndex = JSON.parse(bodyContents);

  // Update cache
  cachedIndex = index;
  cacheExpiry = now + CACHE_TTL;

  return index;
}

export async function getIndexStatus(): Promise<{
  lastBuilt: string | null;
  documentCount: number;
  version: number;
}> {
  try {
    const index = await loadSearchIndex();
    return {
      lastBuilt: index.builtAt,
      documentCount: index.documentCount,
      version: index.version,
    };
  } catch {
    return {
      lastBuilt: null,
      documentCount: 0,
      version: 0,
    };
  }
}
```

### Infrastructure

#### SST Resources

```typescript
// infra/search.ts

import { Cron, Function, Bucket } from 'sst/constructs';
import { database } from './database';

const searchBucket = new Bucket(stack, 'SearchIndexBucket', {
  public: false,
});

// Search function - handles search API requests
new Function(stack, 'SearchFunction', {
  url: true,
  handler: './packages/search/src/index.handler',
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
  handler: './packages/search/src/cron/refresh-index.handler',
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
    handler: './packages/search/src/cron/refresh-index.handler',
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

#### Package Structure

```
packages/search/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Search Lambda handler
│   ├── handler.ts            # Search implementation
│   ├── types.ts              # TypeScript interfaces
│   ├── fuse.ts               # Fuse.js configuration
│   ├── indexer.ts            # Index building logic
│   ├── cron/
│   │   ├── refresh-index.handler.ts  # Cron handler
│   │   └── refresh-index.ts          # Cron implementation
│   └── test/
│       ├── search.test.ts
│       └── indexer.test.ts
└── vitest.config.ts
```

#### Search Package Dependencies

```json
{
  "name": "@rasika/search",
  "dependencies": {
    "@rasika/core": "workspace:*",
    "fuse.js": "^7.0.0",
    "@aws-sdk/client-s3": "^3.972.0"
  }
}
```

### Response Format

#### Success Response

```typescript
// Example response for search query "krishna"

{
  "results": [
    {
      "document": {
        "id": "comp-123",
        "entityType": "composition",
        "artistName": "Tyagaraja",
        "ragaName": "Kalyani",
        "talaName": "Adi",
        "compositionTitle": "Krishna Nee Begane Baro",
        "lyrics": "krishna nee begane baro...",
        "entity": {
          "id": "comp-123",
          "name": "Krishna Nee Begane Baro",
          "type": "composition",
          "composer": { "id": "artist-456", "name": "Tyagaraja" },
          "language": "Kannada",
          "lyricsV1": [
            { "type": "lyric", "order": 1, "text": "krishna nee begane baro" }
          ],
          "ragas": [{ "id": "raga-789", "name": "Kalyani" }],
          "talas": [{ "id": "tala-012", "name": "Adi" }]
        },
        "indexedAt": "2025-01-22T00:00:00.000Z"
      },
      "score": 0.12,
      "matches": [
        {
          "key": "compositionTitle",
          "indices": [[0, 6]],
          "value": "Krishna Nee Begane Baro"
        },
        {
          "key": "lyrics",
          "indices": [[0, 6]],
          "value": "krishna nee begane baro..."
        }
      ]
    }
  ],
  "total": 5,
  "query": "krishna",
  "filters": ["compositionTitle", "lyrics"],
  "took": 45
}
```

#### Error Response (via tRPC)

```typescript
// Standard tRPC error format
{
  "error": {
    "message": "Search index not available. Please try again later.",
    "code": "SEARCH_INDEX_ERROR",
    "data": {
      "code": "SEARCH_INDEX_ERROR",
      "zodError": null
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Create search package** (`packages/search`)
   - Initialize with `package.json`, `tsconfig.json`
   - Add dependencies (fuse.js, @aws-sdk/client-s3)
   - Set up vitest configuration

2. **Define TypeScript types**
   - Create `SearchDocument`, `SearchIndex` interfaces
   - Define `SearchableField` union type
   - Add response type definitions

3. **Set up infrastructure**
   - Add S3 Bucket resource in `infra/search.ts`
   - Add search Lambda function
   - Add index builder Lambda function
   - Add Cron job for periodic rebuild

### Phase 2: Index Building

4. **Implement document transformation**
   - Create `transformArtistToDocument()`
   - Create `transformRagaToDocument()`
   - Create `transformTalaToDocument()`
   - Create `transformCompositionToDocument()`

5. **Implement index builder**
   - Create paginated fetch utilities
   - Implement `buildAndStoreSearchIndex()` function
   - Handle S3 upload with versioning
   - Create "latest" pointer update

6. **Implement cron handler**
   - Create `refresh-index.handler.ts`
   - Connect to existing domain functions
   - Add error handling and logging

### Phase 3: Search Service

7. **Implement Fuse.js integration**
   - Create `createFuseOptions()` with equal weightage
   - Implement pre-built index creation
   - Configure fuzzy matching parameters
   - Handle diacritics for Indian languages

8. **Implement search function**
   - Create `search()` function with caching
   - Implement S3 index loading
   - Handle filter array processing
   - Implement pagination (offset/limit)

9. **Create search handler**
   - Create Lambda handler entry point
   - Add memory caching for warm starts

### Phase 4: tRPC Integration

10. **Add search router**
    - Create `packages/trpc/src/routers/search.ts`
    - Define input schema with validation
    - Implement search and status procedures
    - Add to main router in `routers/index.ts`

11. **Error handling**
    - Add `SEARCH_INDEX_ERROR` to ErrorCode enum
    - Handle index loading failures gracefully
    - Return meaningful error messages

### Phase 5: Testing

12. **Unit tests for indexer**
    - Test document transformation
    - Test pagination logic
    - Test S3 upload

13. **Unit tests for search**
    - Test Fuse.js options
    - Test search with various queries
    - Test filter behavior
    - Test pagination

14. **Integration tests**
    - Test full search flow with mock data
    - Test index build process
    - Test error scenarios

## Testing Strategy

### Test Structure

```
packages/search/src/
├── test/
│   ├── mocks/
│   │   ├── s3.ts           # Mock S3 client
│   │   └── documents.ts    # Sample search documents
│   ├── unit/
│   │   ├── transformer.test.ts
│   │   ├── fuse.test.ts
│   │   └── indexer.test.ts
│   ├── integration/
│   │   └── search.test.ts
│   └── setup.ts
```

### Unit Tests

```typescript
// packages/search/src/test/unit/fuse.test.ts

import { describe, expect, it } from 'vitest';
import { createFuseOptions } from '../fuse';
import type { SearchDocument } from '../types';

describe('Fuse Configuration', () => {
  describe('createFuseOptions', () => {
    it('should include all keys with equal weight when no filters', () => {
      const options = createFuseOptions();

      expect(options.keys).toHaveLength(5);
      options.keys?.forEach((key) => {
        expect(key.weight).toBe(1.0);
      });
    });

    it('should filter keys when filters are provided', () => {
      const options = createFuseOptions(['artistName', 'ragaName']);

      expect(options.keys).toHaveLength(2);
      const keyNames = options.keys?.map((k) => k.name);
      expect(keyNames).toContain('artistName');
      expect(keyNames).toContain('ragaName');
    });

    it('should have correct fuzzy matching settings', () => {
      const options = createFuseOptions();

      expect(options.threshold).toBe(0.4);
      expect(options.ignoreLocation).toBe(true);
      expect(options.ignoreDiacritics).toBe(true);
      expect(options.includeScore).toBe(true);
      expect(options.includeMatches).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
// packages/search/src/test/integration/search.test.ts

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { search } from '../handler';

const mockDocuments: SearchDocument[] = [
  {
    id: 'artist-1',
    entityType: 'artist',
    artistName: 'M.S. Subbulakshmi',
    ragaName: '',
    talaName: '',
    compositionTitle: '',
    lyrics: '',
    entity: { id: 'artist-1', name: 'M.S. Subbulakshmi', type: 'artist' },
    indexedAt: new Date().toISOString(),
  },
  {
    id: 'comp-1',
    entityType: 'composition',
    artistName: 'Tyagaraja',
    ragaName: 'Kalyani',
    talaName: 'Adi',
    compositionTitle: 'Krishna Nee Begane Baro',
    lyrics: 'krishna nee begane baro',
    entity: {
      id: 'comp-1',
      name: 'Krishna Nee Begane Baro',
      type: 'composition',
      composer: { id: 'artist-2', name: 'Tyagaraja' },
      language: 'Kannada',
    },
    indexedAt: new Date().toISOString(),
  },
];

describe('Search Integration', () => {
  it('should find matching documents with fuzzy search', async () => {
    // Setup: mock S3 to return test index
    const result = await search('krishna', { limit: 10 });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].document.compositionTitle).toBe(
      'Krishna Nee Begane Baro'
    );
    expect(result.results[0].score).toBeLessThan(0.5);
  });

  it('should filter by specified fields', async () => {
    const result = await search('Kalyani', {
      filters: ['ragaName'],
      limit: 10,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].matches[0].key).toBe('ragaName');
  });

  it('should return results with correct highlighting', async () => {
    const result = await search('krishna');

    expect(result.results[0].matches.length).toBeGreaterThan(0);
    expect(result.results[0].matches[0].indices[0]).toBeDefined();
  });

  it('should handle pagination correctly', async () => {
    const allResults = await search('test', { limit: 10 });
    const page1 = await search('test', { limit: 5, offset: 0 });
    const page2 = await search('test', { limit: 5, offset: 5 });

    expect(page1.results.length + page2.results.length).toBe(allResults.results.length);
  });

  it('should return empty results for no matches', async () => {
    const result = await search('xyznonexistent');

    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

### Performance Tests

```typescript
// packages/search/src/test/performance/benchmark.test.ts

describe('Search Performance', () => {
  it('should complete search in under 100ms for 10k items', async () => {
    const start = Date.now();
    await search('test query');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should complete search in under 500ms for 100k items', async () => {
    const start = Date.now();
    await search('test query');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
```

## Error Codes

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

## Open Questions

1. **Should lyrics be weighted differently?** Currently all fields have equal weight. Should lyrics (which can be long) be given less weight to avoid dominating matches?

2. **How to handle special characters in Indian music names?** Some names use diacritical marks (e.g., "Mysore Vasudevachar"). The `ignoreDiacritics: true` setting handles this, but we should verify it works correctly for all expected inputs.

3. **Should we add result highlighting for the frontend?** The response includes match indices for manual highlighting. Should we pre-render highlighted HTML strings in the response?

4. **How to handle index build failures?** If the cron job fails, should we alert? Should we keep the old index or serve degraded search?

5. **Should we implement query preprocessing?** Things like removing stop words, normalizing Unicode, etc. Not initially, but could be added later.

6. **Should the search be rate-limited?** For now, no. We can add API Gateway throttling later if needed.

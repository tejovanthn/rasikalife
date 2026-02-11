# Hybrid Search Architecture - DynamoDB + S3 + Fuse.js

## Introduction

While DynamoDB excels at structured queries and relationships, it's not ideal for full-text search and fuzzy matching. This document covers our hybrid search architecture that combines DynamoDB's strengths with full-text search using S3 and Fuse.js for powerful, scalable search capabilities.

**Related ADRs:**
- [ADR-001: Single-Table Design with ElectroDB](../adrs/adr-001-single-table-dynamodb-design.md)

## Architecture Components

- **DynamoDB**: Primary data storage
- **S3**: Search index storage and persistence
- **Fuse.js**: Fuzzy search and text matching
- **DynamoDB Streams**: Index updates (future)

## Search Service Implementation

### Search Function

```typescript
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ApplicationError, ErrorCode } from '@rasika/core';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET;

let cachedIndex: SearchIndex | null = null;

interface SearchOptions {
  filters?: SearchableField[];
  limit?: number;
  offset?: number;
}

function createFuseOptions(filterFields?: SearchableField[]) {
  const allKeys: Array<{ name: keyof SearchDocument; weight: number }> = [
    { name: 'artistName', weight: 1.0 },
    { name: 'ragaName', weight: 1.0 },
    { name: 'talaName', weight: 1.0 },
    { name: 'compositionTitle', weight: 1.0 },
    { name: 'lyrics', weight: 1.0 },
  ];

  return {
    keys: filterFields || allKeys,
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
    ignoreLocation: true,
    isCaseSensitive: false,
    ignoreDiacritics: true,
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    findAllMatches: true,
  };
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const { filters, limit = 20, offset = 0 } = options;

  try {
    const index = await loadIndex();
    const documents = index.documents;
    const fuseOptions = createFuseOptions(filters);

    // Search each entity type separately
    const entityTypes = ['artist', 'raga', 'tala', 'composition'] as const;
    const resultsByType: Record<string, FuseResult<SearchDocument>[]> = {};

    for (const entityType of entityTypes) {
      const typeDocuments = documents.filter(d => d.entityType === entityType);
      const fuse = new Fuse<SearchDocument>(typeDocuments, fuseOptions);
      resultsByType[entityType] = fuse.search(query);
    }

    // Interleave results from each type
    const maxPerType = Math.ceil(limit / entityTypes.length);
    const rawResults: FuseResult<SearchDocument>[] = [];

    for (const entityType of entityTypes) {
      rawResults.push(...resultsByType[entityType].slice(0, maxPerType));
    }

    rawResults.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    const paginatedResults = rawResults.slice(offset, offset + limit);

    const items: SearchResultItem[] = paginatedResults.map(
      (result: FuseResult<SearchDocument>) => ({
        id: result.item.id,
        type: result.item.entityType,
        name: result.item.displayName,
        score: result.score ?? 1,
        highlights: transformMatchesToHighlights(result.matches || []),
      })
    );

    return {
      items,
      total: rawResults.length,
    };
  } catch (error) {
    throw new ApplicationError(
      ErrorCode.SEARCH_QUERY_FAILED,
      `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### Index Loading

```typescript
async function loadIndex(): Promise<SearchIndex> {
  if (cachedIndex && cachedIndex.version === CURRENT_INDEX_VERSION) {
    return cachedIndex;
  }

  if (!INDEX_BUCKET) {
    throw new ApplicationError(
      ErrorCode.SEARCH_INDEX_ERROR,
      'SEARCH_INDEX_BUCKET environment variable is not set'
    );
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
    cachedIndex = index;

    return index;
  } catch (error) {
    throw new ApplicationError(
      ErrorCode.SEARCH_INDEX_ERROR,
      'Search index is not available. Please try again later.'
    );
  }
}
```

### Search with Full Data

```typescript
export async function searchWithFullData(
  query: string,
  options: SearchOptions = {}
): Promise<SearchWithFullDataResponse> {
  const { filters, limit = 20, offset = 0 } = options;

  // First, run the regular search to get IDs
  const searchResponse = await search(query, { filters, limit, offset });

  // Group results by entity type
  const compositionIds: Array<{ id: string }> = [];
  const artistIds: Array<{ id: string }> = [];
  const ragaIds: Array<{ id: string }> = [];
  const talaIds: Array<{ id: string }> = [];

  for (const item of searchResponse.items) {
    switch (item.type) {
      case 'composition':
        compositionIds.push({ id: item.id });
        break;
      case 'artist':
        artistIds.push({ id: item.id });
        break;
      case 'raga':
        ragaIds.push({ id: item.id });
        break;
      case 'tala':
        talaIds.push({ id: item.id });
        break;
    }
  }

  // Batch fetch full entity data in parallel
  const [compositionsResult, artistsResult, ragasResult, talasResult] = await Promise.all([
    compositionIds.length > 0 ? CompositionEntity.get(compositionIds).go() : { data: [] },
    artistIds.length > 0 ? ArtistEntity.get(artistIds).go() : { data: [] },
    ragaIds.length > 0 ? RagaEntity.get(ragaIds).go() : { data: [] },
    talaIds.length > 0 ? TalaEntity.get(talaIds).go() : { data: [] },
  ]);

  return {
    compositions: compositionsResult.data || [],
    artists: artistsResult.data || [],
    ragas: ragasResult.data || [],
    talas: talasResult.data || [],
    total: searchResponse.total,
  };
}
```

## Best Practices

### 1. Entity Type Separation
Search each entity type separately for balanced results.

### 2. Caching
Cache the search index in memory for performance.

### 3. Batch Fetches
Use batch fetches to avoid N+1 queries.

### 4. Error Handling
Provide meaningful error messages for search failures.

## Conclusion

The hybrid search architecture provides powerful full-text search capabilities while maintaining the benefits of DynamoDB for structured data storage. By storing search indexes in S3 and using Fuse.js for fuzzy matching, we achieve fast, flexible search without the complexity of dedicated search services.

**Related Reading:**
- [Single-Table Design Patterns](./single-table-design-patterns.md) - Structured data modeling
- [SST v3 Infrastructure Patterns](./sst-infrastructure-patterns.md) - S3 and Lambda setup
- [ElectroDB Type-Safe DynamoDB](./electrodb-type-safe-dynamodb.md) - Data layer integration
- [Cursor-Based Pagination](./cursor-pagination-dynamodb.md) - Paginating search results

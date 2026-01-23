// packages/core/src/domain/search/service.ts

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { ApplicationError, ErrorCode } from '@rasika/core';
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js';
import type { SearchableField } from './schema';
import type {
  HealthStatus,
  SearchDocument,
  SearchIndex,
  SearchResponse,
  SearchResultItem,
} from './types';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET;

const CURRENT_INDEX_VERSION = 1;

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

  const filteredKeys = filterFields
    ? allKeys.filter(k => filterFields.includes(k.name as SearchableField))
    : allKeys;

  return {
    keys: filteredKeys,
    threshold: 0.4,
    distance: 100,
    ignoreLocation: true,
    isCaseSensitive: false,
    ignoreDiacritics: true,
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    findAllMatches: false,
  };
}

function transformMatchesToHighlights(
  matches: readonly FuseResultMatch[]
): Array<{ field: SearchableField; text: string }> {
  return matches
    .filter((match): match is FuseResultMatch & { key: string } => {
      return match.key !== undefined && typeof match.key === 'string';
    })
    .map(match => ({
      field: match.key as SearchableField,
      text: match.value || '',
    }));
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const startTime = Date.now();
  const { filters, limit = 20, offset = 0 } = options;

  try {
    const index = await loadIndex();
    const documents = index.documents;

    const fuseOptions = createFuseOptions(filters);
    const fuse = new Fuse<SearchDocument>(documents, fuseOptions);

    const rawResults = fuse.search(query, {
      limit: limit + offset,
    });

    const paginatedResults = rawResults.slice(offset, offset + limit);

    const items: SearchResultItem[] = paginatedResults.map(
      (result: FuseResult<SearchDocument>) => ({
        id: result.item.id,
        type: result.item.entityType,
        name: result.item.displayName,
        highlights: transformMatchesToHighlights(result.matches || []),
      })
    );

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

    if (index.version !== CURRENT_INDEX_VERSION) {
      console.warn('Index version mismatch', {
        indexVersion: index.version,
        expectedVersion: CURRENT_INDEX_VERSION,
      });
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

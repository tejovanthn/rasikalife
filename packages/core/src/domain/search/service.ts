// packages/core/src/domain/search/service.ts

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { ApplicationError, ErrorCode } from '@rasika/core';
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js';
import { ArtistEntity } from '../artist/entity';
import type { Artist } from '../artist/entity';
import { CompositionEntity } from '../composition/entity';
import type { CompositionWithRelations } from '../composition/index';
import { RagaEntity } from '../raga/entity';
import type { Raga } from '../raga/entity';
import { TalaEntity } from '../tala/entity';
import type { Tala } from '../tala/entity';
import type { SearchableField } from './schema';
import type {
  EntityType,
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

    // Search each entity type separately to ensure balanced results
    const entityTypes = ['artist', 'raga', 'tala', 'composition'] as const;
    const resultsByType: Record<string, FuseResult<SearchDocument>[]> = {};

    for (const entityType of entityTypes) {
      const typeDocuments = documents.filter(d => d.entityType === entityType);
      const fuse = new Fuse<SearchDocument>(typeDocuments, fuseOptions);
      resultsByType[entityType] = fuse.search(query);
    }

    // Interleave results from each type, sorted by score within each type
    const rawResults: FuseResult<SearchDocument>[] = [];
    const maxPerType = Math.ceil(limit / entityTypes.length);

    for (const entityType of entityTypes) {
      rawResults.push(...resultsByType[entityType].slice(0, maxPerType));
    }

    // Sort all results by score (lower is better in Fuse)
    rawResults.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    console.log('Search results:', {
      query,
      byType: {
        artists: resultsByType.artist?.length ?? 0,
        compositions: resultsByType.composition?.length ?? 0,
        ragas: resultsByType.raga?.length ?? 0,
        talas: resultsByType.tala?.length ?? 0,
      },
    });

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

export interface SearchWithFullDataResponse {
  compositions: CompositionWithRelations[];
  artists: Artist[];
  ragas: Raga[];
  talas: Tala[];
  total: number;
}

/**
 * Search with full entity data - returns enriched results with all relations
 * Uses batch fetches to avoid N+1 queries
 */
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

  // Transform compositions to CompositionWithRelations format
  const compositions: CompositionWithRelations[] = (compositionsResult.data || []).map(comp => ({
    id: comp.id,
    title: comp.title,
    composer: comp.composer,
    language: comp.language,
    lyricsV1: comp.lyricsV1 || [],
    ragas: comp.ragas || [],
    talas: comp.talas || [],
    sourceAttribution: comp.sourceAttribution,
    createdAt: comp.createdAt,
    updatedAt: comp.updatedAt,
  }));

  return {
    compositions,
    artists: artistsResult.data || [],
    ragas: ragasResult.data || [],
    talas: talasResult.data || [],
    total: searchResponse.total,
  };
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

export interface DocumentsResponse {
  documents: SearchDocument[];
  builtAt: string;
}

/**
 * Get all documents from the search index.
 * Useful for generating sitemaps without re-scanning the database.
 */
export async function getDocuments(
  type?: EntityType,
  startsWith?: string
): Promise<DocumentsResponse> {
  const index = await loadIndex();

  let documents = index.documents;
  if (type) {
    documents = documents.filter(doc => doc.entityType === type);
  }

  if (startsWith) {
    const prefix = startsWith.toLowerCase();
    // Special handling for 'other' or numeric/special chars if needed,
    // but strict prefix matching is requested.
    // If startsWith is '1', it matches '1...'
    // If startsWith is 'other', we might want non-alpha?
    // For now, let's implement strict prefix.
    documents = documents.filter(doc => doc.displayName.toLowerCase().startsWith(prefix));
  }

  return {
    documents,
    builtAt: index.builtAt,
  };
}

// packages/core/src/domain/search/service.ts

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { ApplicationError, ErrorCode } from '@rasika/core';
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js';
import { type CityEntry, foldCities } from '../../shared/city';
import { ArtistEntity } from '../artist/entity';
import type { Artist } from '../artist/entity';
import { CompositionEntity } from '../composition/entity';
import { toCompositionWithRelations } from '../composition/index';
import type { CompositionWithRelations } from '../composition/index';
import { EventEntity } from '../event/entity';
import type { Event } from '../event/entity';
import { FestivalEntity } from '../festival/entity';
import type { Festival } from '../festival/entity';
import { OrganiserEntity } from '../organiser/entity';
import type { Organiser } from '../organiser/entity';
import { RagaEntity } from '../raga/entity';
import type { Raga } from '../raga/entity';
import { type Relative, findRelatives } from '../raga/relatives';
import { TalaEntity } from '../tala/entity';
import type { Tala } from '../tala/entity';
import { VenueEntity } from '../venue/entity';
import type { Venue } from '../venue/entity';
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
    { name: 'name', weight: 1.0 },
    { name: 'description', weight: 0.8 },
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
    const entityTypes = [
      'artist',
      'raga',
      'tala',
      'composition',
      'venue',
      'organiser',
      'event',
      'festival',
    ] as const;
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
      byType: Object.fromEntries(entityTypes.map(t => [t, resultsByType[t]?.length ?? 0])),
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
  venues: Venue[];
  organisers: Organiser[];
  events: Event[];
  festivals: Festival[];
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
  const venueIds: Array<{ id: string }> = [];
  const organiserIds: Array<{ id: string }> = [];
  const eventIds: Array<{ id: string }> = [];
  const festivalIds: Array<{ id: string }> = [];

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
      case 'venue':
        venueIds.push({ id: item.id });
        break;
      case 'organiser':
        organiserIds.push({ id: item.id });
        break;
      case 'event':
        eventIds.push({ id: item.id });
        break;
      case 'festival':
        festivalIds.push({ id: item.id });
        break;
    }
  }

  // Batch fetch full entity data in parallel
  const [
    compositionsResult,
    artistsResult,
    ragasResult,
    talasResult,
    venuesResult,
    organisersResult,
    eventsResult,
    festivalsResult,
  ] = await Promise.all([
    compositionIds.length > 0 ? CompositionEntity.get(compositionIds).go() : { data: [] },
    artistIds.length > 0 ? ArtistEntity.get(artistIds).go() : { data: [] },
    ragaIds.length > 0 ? RagaEntity.get(ragaIds).go() : { data: [] },
    talaIds.length > 0 ? TalaEntity.get(talaIds).go() : { data: [] },
    venueIds.length > 0 ? VenueEntity.get(venueIds).go() : { data: [] },
    organiserIds.length > 0 ? OrganiserEntity.get(organiserIds).go() : { data: [] },
    eventIds.length > 0 ? EventEntity.get(eventIds).go() : { data: [] },
    festivalIds.length > 0 ? FestivalEntity.get(festivalIds).go() : { data: [] },
  ]);

  // Transform compositions to CompositionWithRelations format
  const compositions: CompositionWithRelations[] = (compositionsResult.data || []).map(
    toCompositionWithRelations
  );

  return {
    compositions,
    artists: artistsResult.data || [],
    ragas: ragasResult.data || [],
    talas: talasResult.data || [],
    venues: (venuesResult.data || []) as Venue[],
    organisers: (organisersResult.data || []) as Organiser[],
    events: (eventsResult.data || []) as Event[],
    festivals: (festivalsResult.data || []) as Festival[],
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

export interface ArtistRanking {
  ids: string[];
  total: number;
  /** Shown or hidden: the "Verified" filter is offered only when this is above zero. */
  verifiedCount: number;
}

/**
 * Orders the artist documents for /artists?sort=popular and ?verified=1. Ties break on name,
 * so a page of artists with no events yet is alphabetical rather than arbitrary.
 */
export function rankArtistDocuments(
  documents: SearchDocument[],
  opts: { sort: 'popular' | 'name'; verifiedOnly?: boolean; offset: number; limit: number }
): ArtistRanking {
  const artists = documents.filter(doc => doc.entityType === 'artist');
  const verifiedCount = artists.filter(doc => doc.verified).length;
  const pool = opts.verifiedOnly ? artists.filter(doc => doc.verified) : artists;
  const byName = (a: SearchDocument, b: SearchDocument) =>
    a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' });
  const sorted = [...pool].sort(
    opts.sort === 'popular'
      ? (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || byName(a, b)
      : byName
  );
  return {
    ids: sorted.slice(opts.offset, opts.offset + opts.limit).map(doc => doc.id),
    total: pool.length,
    verifiedCount,
  };
}

export async function rankArtists(opts: {
  sort: 'popular' | 'name';
  verifiedOnly?: boolean;
  offset: number;
  limit: number;
}): Promise<ArtistRanking> {
  const index = await loadIndex();
  return rankArtistDocuments(index.documents, opts);
}

/**
 * Every city a venue sits in, from the index the search Lambda already holds in memory. It
 * replaced a scan of the whole venue table on every uncached listing request. Refreshed with
 * the index, so a venue's new city appears within six hours or on the next reindex.
 */
export async function listVenueCities(): Promise<CityEntry[]> {
  const index = await loadIndex();
  return foldCities(index.documents.filter(doc => doc.entityType === 'venue').map(doc => doc.city));
}

/**
 * Ragas whose scales are one or two notes from this one's (`findRelatives`), read from the
 * index the search Lambda already holds. Merged-away ragas are not indexed, so none is
 * offered. Empty when the raga has no indexed scale.
 */
export async function ragaRelatives(id: string, limit = 6): Promise<Relative[]> {
  const index = await loadIndex();
  const ragas = index.documents
    .filter(doc => doc.entityType === 'raga')
    .map(doc => ({
      id: doc.id,
      name: doc.displayName,
      arohanam: doc.arohanam,
      avarohanam: doc.avarohanam,
      popularity: doc.popularity,
    }));
  const self = ragas.find(r => r.id === id);
  return self ? findRelatives(self, ragas, limit) : [];
}

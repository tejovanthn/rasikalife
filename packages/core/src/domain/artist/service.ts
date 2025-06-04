import { formatKey, EntityPrefix, SecondaryPrefix } from '../../shared/singleTable';
import { createQuery, updateItem, scan } from '../../db';
import { cache, CacheKeys, CacheTTL, withCache, invalidateCachePattern } from '../../shared/cache';
import { ArtistRepository } from './repository';
import { CreateArtistInput, Artist, UpdateArtistInput } from './schema';
import { ArtistSearchParams, ArtistSearchResult, ArtistDynamoItem } from './types';

export const createArtist = async (input: CreateArtistInput): Promise<Artist> => {
  // Add any business logic here (e.g., validation, enrichment)
  return ArtistRepository.create(input);
};

// Cached version of getById with automatic cache management
const cachedGetById = withCache(
  (id: string) => CacheKeys.artist(id),
  CacheTTL.ARTIST_PROFILE
)(ArtistRepository.getById);

export const getArtist = cachedGetById;

export const updateArtist = async (id: string, input: UpdateArtistInput): Promise<Artist> => {
  // Verify artist exists
  const existing = await getArtist(id);
  if (!existing) {
    throw new Error(`Artist ${id} not found`);
  }

  const updatedArtist = await ArtistRepository.update(id, input);

  // Invalidate caches using pattern matching
  cache.delete(CacheKeys.artist(id));
  invalidateCachePattern('popular_artists:');

  return updatedArtist;
};

// Cached search for simple name queries only
const cachedSimpleSearch = withCache(
  (params: ArtistSearchParams) =>
    CacheKeys.artistSearch(params.query!, params.limit || 20, params.nextToken),
  CacheTTL.SEARCH_RESULTS
)(ArtistRepository.search);

export const searchArtists = async (params: ArtistSearchParams): Promise<ArtistSearchResult> => {
  // Only cache simple name searches to avoid complex cache key management
  if (params.query && !params.tradition && !params.instrument) {
    return cachedSimpleSearch(params);
  }

  // Don't cache complex searches
  return ArtistRepository.search(params);
};

// Core function to fetch popular artists from database
const fetchPopularArtists = async (limit = 10): Promise<Artist[]> => {
  const result = await createQuery<ArtistDynamoItem>()
    .withIndex('GSI5')
    .withPartitionKey('GSI5PK', 'POPULARITY')
    .withSortOrder(false) // Descending order by view count
    .withLimit(limit)
    .execute();

  return result.items;
};

/**
 * Retrieves popular artists sorted by view count
 *
 * Uses GSI5 (popularity index) to efficiently query artists
 * sorted by their view count in descending order. View count
 * serves as a proxy for popularity based on actual user engagement.
 *
 * GSI Structure:
 * - GSI5PK: 'POPULARITY' (all artists share this partition)
 * - GSI5SK: 'VIEWS#{paddedViewCount}#{artistId}' (enables view-based sorting)
 *
 * Results are cached for improved performance since popular artists
 * don't change frequently.
 *
 * @param limit Maximum number of artists to return (default: 10)
 * @returns Promise resolving to array of popular artists
 */
export const getPopularArtists = withCache(
  (limit = 10) => CacheKeys.popularArtists(limit),
  CacheTTL.POPULAR_ARTISTS
)(fetchPopularArtists);

/**
 * Atomically increments the view count for an artist
 *
 * Uses DynamoDB's native ADD operation to ensure atomic increments
 * without race conditions. This is more reliable than read-modify-write
 * operations, especially under concurrent access.
 *
 * Also updates the popularity GSI (GSI5SK) to reflect the new view count
 * for proper sorting in popular artists queries.
 *
 * Note: Direct DynamoDB operations are used here instead of the generic
 * updateItem function because the generic function doesn't support ADD operations.
 *
 * @param id Artist ID to increment view count for
 */
export const incrementViewCount = async (id: string): Promise<void> => {
  const { UpdateCommand, GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const { docClient, getTableName } = await import('../../db/client');

  // First, get current view count to calculate new GSI5SK
  const current = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        PK: formatKey(EntityPrefix.ARTIST, id),
        SK: SecondaryPrefix.METADATA,
      },
      ProjectionExpression: 'viewCount',
    })
  );

  const currentViewCount = current.Item?.viewCount || 0;
  const newViewCount = currentViewCount + 1;
  const newGSI5SK = `VIEWS#${String(newViewCount).padStart(10, '0')}#${id}`;

  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: {
        PK: formatKey(EntityPrefix.ARTIST, id),
        SK: SecondaryPrefix.METADATA,
      },
      UpdateExpression: 'ADD viewCount :increment SET GSI5SK = :newGSI5SK',
      ExpressionAttributeValues: {
        ':increment': 1,
        ':newGSI5SK': newGSI5SK,
      },
    })
  );

  // Invalidate caches since view count changed
  cache.delete(CacheKeys.artist(id));
  invalidateCachePattern('popular_artists:');
};

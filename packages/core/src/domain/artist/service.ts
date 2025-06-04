import { formatKey, EntityPrefix, SecondaryPrefix } from '../../shared/singleTable';
import { createQuery, updateItem, scan } from '../../db';
import { ArtistRepository } from './repository';
import { CreateArtistInput, Artist, UpdateArtistInput } from './schema';
import { ArtistSearchParams, ArtistSearchResult, ArtistDynamoItem } from './types';

export const createArtist = async (input: CreateArtistInput): Promise<Artist> => {
  // Add any business logic here (e.g., validation, enrichment)
  return ArtistRepository.create(input);
};

export const getArtist = async (id: string): Promise<Artist | null> => {
  return ArtistRepository.getById(id);
};

export const updateArtist = async (id: string, input: UpdateArtistInput): Promise<Artist> => {
  // Verify artist exists
  const existing = await getArtist(id);
  if (!existing) {
    throw new Error(`Artist ${id} not found`);
  }

  return ArtistRepository.update(id, input);
};

export const searchArtists = async (params: ArtistSearchParams): Promise<ArtistSearchResult> => {
  return ArtistRepository.search(params);
};

/**
 * Retrieves popular artists sorted by popularity score
 *
 * Uses GSI5 (popularity index) to efficiently query artists
 * sorted by their popularity score in descending order.
 *
 * GSI Structure:
 * - GSI5PK: 'POPULARITY' (all artists share this partition)
 * - GSI5SK: 'SCORE#{paddedScore}#{artistId}' (enables score-based sorting)
 *
 * @param limit Maximum number of artists to return (default: 10)
 * @returns Promise resolving to array of popular artists
 */
export const getPopularArtists = async (limit = 10): Promise<Artist[]> => {
  const result = await createQuery<ArtistDynamoItem>()
    .withIndex('GSI5')
    .withPartitionKey('GSI5PK', 'POPULARITY')
    .withSortOrder(false) // Descending order by popularity score
    .withLimit(limit)
    .execute();

  return result.items;
};

/**
 * Atomically increments the view count for an artist
 *
 * Uses DynamoDB's native ADD operation to ensure atomic increments
 * without race conditions. This is more reliable than read-modify-write
 * operations, especially under concurrent access.
 *
 * Note: Direct DynamoDB operations are used here instead of the generic
 * updateItem function because the generic function doesn't support ADD operations.
 *
 * @param id Artist ID to increment view count for
 */
export const incrementViewCount = async (id: string): Promise<void> => {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  const { docClient, getTableName } = await import('../../db/client');

  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: {
        PK: formatKey(EntityPrefix.ARTIST, id),
        SK: SecondaryPrefix.METADATA,
      },
      UpdateExpression: 'ADD viewCount :increment',
      ExpressionAttributeValues: {
        ':increment': 1,
      },
    })
  );
};

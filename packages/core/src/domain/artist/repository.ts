import { createQuery, putItem, scan, updateItem } from '../../db';
import { ErrorCode } from '../../constants';
import { ApplicationError } from '../../types/common';
import { getByGlobalIndex, getByPrimaryKey } from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  EntityPrefix,
  SecondaryPrefix,
  createBaseItem,
  formatIndexKey,
  formatKey,
} from '../../shared/singleTable';
import { type Artist, createArtistSchema, updateArtistSchema } from './schema';
import {
  type ArtistDynamoItem,
  type ArtistSearchParams,
  type ArtistSearchResult,
  type Tradition,
  VerificationStatus,
} from './types';

const populateIndexes = (
  artist: {
    name?: string;
    instruments?: string[];
    traditions?: string[];
    location?: { country?: string; state?: string; city?: string };
    viewCount?: number;
  },
  id: string
) => ({
  ...(artist.name && {
    GSI1PK: formatIndexKey('ARTIST_NAME', artist.name.toLowerCase()),
    GSI1SK: formatKey(EntityPrefix.ARTIST, id),
    searchName: artist.name.toLowerCase(),
  }),
  ...(artist.instruments?.length && {
    GSI2PK: formatIndexKey('INSTRUMENT', artist.instruments[0]),
    GSI2SK: formatKey(EntityPrefix.ARTIST, id),
  }),
  ...(artist.traditions?.length && {
    GSI3PK: formatIndexKey('TRADITION', artist.traditions[0]),
    GSI3SK: formatKey(EntityPrefix.ARTIST, id),
  }),
  ...(artist.location && {
    GSI4PK: formatIndexKey(
      'LOCATION',
      [artist.location.country, artist.location.state, artist.location.city]
        .filter(Boolean)
        .join('#')
    ),
    GSI4SK: formatKey(EntityPrefix.ARTIST, id),
  }),
  ...(artist.viewCount !== undefined && {
    GSI5PK: 'POPULARITY',
    GSI5SK: `VIEWS#${String(artist.viewCount).padStart(10, '0')}#${id}`,
  }),
});

export class ArtistRepository {
  static async create(input: unknown): Promise<ArtistDynamoItem> {
    const validatedInput = createArtistSchema.parse(input);
    const baseItem = await createBaseItem(EntityPrefix.ARTIST);

    const artistItem: ArtistDynamoItem = {
      ...baseItem,
      ...validatedInput,
      isVerified: false,
      verificationStatus: VerificationStatus.PENDING,
      viewCount: 0,
      favoriteCount: 0,
      popularityScore: 0,
      ...populateIndexes({ ...validatedInput, viewCount: 0 }, baseItem.id),
    };

    await putItem(artistItem);
    return artistItem;
  }

  static async getById(id: string): Promise<Artist | null> {
    return getByPrimaryKey<ArtistDynamoItem>(EntityPrefix.ARTIST, id, SecondaryPrefix.METADATA);
  }

  static async update(id: string, input: unknown): Promise<Artist> {
    const validatedInput = updateArtistSchema.parse({
      id,
      ...(input || {}),
    });

    // Get current artist to merge with updates for GSI population
    const current = await ArtistRepository.getById(id);
    if (!current) {
      throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `Artist ${id} not found`);
    }

    const merged = { ...current, ...validatedInput };
    const updates = {
      ...validatedInput,
      ...populateIndexes(merged, id),
    };

    await updateItem(
      {
        PK: formatKey(EntityPrefix.ARTIST, id),
        SK: SecondaryPrefix.METADATA,
      },
      updates
    );

    return ArtistRepository.getById(id) as Promise<Artist>;
  }

  /**
   * WARNING: This uses a table scan and will not scale beyond ~1000 artists.
   * For production fuzzy search, integrate ElasticSearch, Algolia, or similar.
   *
   * This is acceptable for MVP / low-traffic scenarios only.
   * DynamoDB doesn't support partial text matching on GSI keys.
   */
  static async searchByName(
    name: string,
    limit = 20,
    nextToken?: string
  ): Promise<ArtistSearchResult> {
    const searchTerm = name.toLowerCase();
    const result = await scan<ArtistDynamoItem>({
      FilterExpression:
        'begins_with(PK, :pkPrefix) AND SK = :skValue AND contains(#searchName, :searchTerm)',
      ExpressionAttributeNames: {
        '#searchName': 'searchName',
      },
      ExpressionAttributeValues: {
        ':pkPrefix': `${EntityPrefix.ARTIST}#`,
        ':skValue': SecondaryPrefix.METADATA,
        ':searchTerm': searchTerm,
      },
      Limit: limit * 3, // Use 3x multiplier to ensure sufficient results after filtering
      ExclusiveStartKey: nextToken
        ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
        : undefined,
    });

    const scoredItems = scoreSearchResults(result.items, name, [{ name: 'name', weight: 1 }]);
    // Limit results to requested amount since we scanned more
    const limitedItems = scoredItems.slice(0, limit);
    return createPaginatedResponse(limitedItems, result.lastEvaluatedKey);
  }

  static async getByTradition(
    tradition: Tradition,
    limit = 20,
    nextToken?: string
  ): Promise<ArtistSearchResult> {
    const result = await getByGlobalIndex<ArtistDynamoItem>(
      'GSI3',
      'GSI3PK',
      formatIndexKey('TRADITION', tradition),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async getByInstrument(
    instrument: string,
    limit = 20,
    nextToken?: string
  ): Promise<ArtistSearchResult> {
    const result = await getByGlobalIndex<ArtistDynamoItem>(
      'GSI2',
      'GSI2PK',
      formatIndexKey('INSTRUMENT', instrument),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async search(params: ArtistSearchParams): Promise<ArtistSearchResult> {
    // If tradition filter is specified, search within that tradition
    if (params.tradition) {
      if (params.query) {
        // For tradition + query, use searchByName and then filter by tradition
        // This is simpler than trying to do complex tradition filtering with pagination
        const searchResults = await ArtistRepository.searchByName(
          params.query,
          params.limit,
          params.nextToken
        );
        const filteredItems = searchResults.items.filter(artist =>
          params.tradition ? artist.traditions.includes(params.tradition) : false
        );
        return {
          items: filteredItems,
          hasMore: searchResults.hasMore,
          nextToken: searchResults.nextToken,
        };
      }
      return ArtistRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    // If instrument filter is specified
    if (params.instrument) {
      return ArtistRepository.getByInstrument(params.instrument, params.limit, params.nextToken);
    }

    // If only query is specified, do a broader search
    if (params.query) {
      return ArtistRepository.searchByName(params.query, params.limit, params.nextToken);
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }

  static async getPopular(limit = 10): Promise<Artist[]> {
    const result = await createQuery<ArtistDynamoItem>()
      .withIndex('GSI5')
      .withPartitionKey('GSI5PK', 'POPULARITY')
      .withSortOrder(false) // Descending order by view count
      .withLimit(limit)
      .execute();

    return result.items;
  }

  static async incrementViewCount(id: string): Promise<void> {
    const { UpdateCommand, GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient, getTableName } = await import('../../db/client');

    // Get current view count to calculate new GSI5SK
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
  }
}

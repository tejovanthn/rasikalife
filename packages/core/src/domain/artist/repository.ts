import { putItem, updateItem, query } from '../../db';
import { getByPrimaryKey, getByGlobalIndex } from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  createBaseItem,
  EntityPrefix,
  formatIndexKey,
  formatKey,
  SecondaryPrefix,
} from '../../shared/singleTable';
import { createArtistSchema, Artist, updateArtistSchema } from './schema';
import {
  ArtistDynamoItem,
  VerificationStatus,
  UpdateArtistDynamoItem,
  ArtistSearchResult,
  Tradition,
  ArtistSearchParams,
} from './types';

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

      // GSI fields for search
      GSI1PK: formatIndexKey('ARTIST_NAME', validatedInput.name.toLowerCase()),
      GSI1SK: formatKey(EntityPrefix.ARTIST, baseItem.id),
    };

    // Add instrument index if provided
    if (validatedInput.instruments.length > 0) {
      artistItem.GSI2PK = formatIndexKey('INSTRUMENT', validatedInput.instruments[0]);
      artistItem.GSI2SK = formatKey(EntityPrefix.ARTIST, baseItem.id);
    }

    // Add tradition index
    artistItem.GSI3PK = formatIndexKey('TRADITION', validatedInput.traditions[0]);
    artistItem.GSI3SK = formatKey(EntityPrefix.ARTIST, baseItem.id);

    // Add location index if provided
    if (validatedInput.location) {
      const locationKey = [
        validatedInput.location.country,
        validatedInput.location.state,
        validatedInput.location.city,
      ]
        .filter(Boolean)
        .join('#');

      artistItem.GSI4PK = formatIndexKey('LOCATION', locationKey);
      artistItem.GSI4SK = formatKey(EntityPrefix.ARTIST, baseItem.id);
    }

    await putItem(artistItem);
    return artistItem;
  }

  static async getById(id: string): Promise<Artist | null> {
    return getByPrimaryKey<ArtistDynamoItem>(EntityPrefix.ARTIST, id, SecondaryPrefix.METADATA);
  }

  static async update(id: string, input: unknown): Promise<Artist> {
    const validatedInput: UpdateArtistDynamoItem = updateArtistSchema.parse({
      id,
      ...(input || {}),
    });

    // Update GSI fields if name is changing
    if (validatedInput.name) {
      validatedInput.GSI1PK = formatIndexKey('ARTIST_NAME', validatedInput.name.toLowerCase());
    }

    // Update other GSI fields as needed
    if (validatedInput.instruments?.length) {
      validatedInput.GSI2PK = formatIndexKey('INSTRUMENT', validatedInput.instruments[0]);
    }

    if (validatedInput.traditions?.length) {
      validatedInput.GSI3PK = formatIndexKey('TRADITION', validatedInput.traditions[0]);
    }

    if (validatedInput.location) {
      const locationKey = [
        validatedInput.location.country,
        validatedInput.location.state,
        validatedInput.location.city,
      ]
        .filter(Boolean)
        .join('#');

      validatedInput.GSI4PK = formatIndexKey('LOCATION', locationKey);
    }

    return updateItem<ArtistDynamoItem>(
      {
        PK: formatKey(EntityPrefix.ARTIST, id),
        SK: SecondaryPrefix.METADATA,
      },
      validatedInput
    );
  }

  static async searchByName(name: string, limit = 20): Promise<ArtistSearchResult> {
    const result = await query<ArtistDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': formatIndexKey('ARTIST_NAME', name.toLowerCase()),
      },
      Limit: limit,
    });

    const scoredItems = scoreSearchResults(result.items, name, [{ name: 'name', weight: 1 }]);

    return createPaginatedResponse(scoredItems, result.lastEvaluatedKey);
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
    // This is a simplified search - can be expanded based on needs
    if (params.query) {
      return ArtistRepository.searchByName(params.query, params.limit);
    }

    if (params.instrument) {
      return ArtistRepository.getByInstrument(params.instrument, params.limit, params.nextToken);
    }

    if (params.tradition) {
      return ArtistRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }
}

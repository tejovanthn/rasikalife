import { putItem, updateItem, query, scan } from '../../db';
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
      searchName: validatedInput.name.toLowerCase(), // For case-insensitive search

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

    // Add popularity index (GSI5 for popularity)
    // Uses padded score in sort key to enable proper numeric sorting in DynamoDB
    artistItem.GSI5PK = 'POPULARITY';
    artistItem.GSI5SK = `SCORE#${String(artistItem.popularityScore).padStart(10, '0')}#${baseItem.id}`;

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

  /**
   * Search artists by name using DynamoDB scan with filters
   *
   * Since DynamoDB doesn't excel at full-text search, this implementation
   * uses a scan operation with filters to find artists whose names contain
   * the search term. While not as efficient as a dedicated search engine,
   * this provides acceptable performance for moderate datasets.
   *
   * Optimization notes:
   * - Scans more items than requested (limit * 3) to improve hit rate
   * - Uses exact case matching for reliability
   * - Supports pagination via nextToken
   * - Applies search scoring to rank results by relevance
   *
   * @param name Search term to match against artist names
   * @param limit Maximum number of results to return
   * @param nextToken Pagination token for continued search
   * @returns Promise resolving to paginated search results
   */
  static async searchByName(
    name: string,
    limit = 20,
    nextToken?: string
  ): Promise<ArtistSearchResult> {
    const result = await scan<ArtistDynamoItem>({
      FilterExpression:
        'begins_with(PK, :pkPrefix) AND SK = :skValue AND contains(#name, :searchTerm)',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':pkPrefix': EntityPrefix.ARTIST + '#',
        ':skValue': SecondaryPrefix.METADATA,
        ':searchTerm': name, // Case-sensitive matching
      },
      Limit: limit * 3, // Scan more items to improve hit rate
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
          artist.traditions.includes(params.tradition!)
        );
        return {
          items: filteredItems,
          hasMore: searchResults.hasMore,
          nextToken: searchResults.nextToken,
        };
      } else {
        return ArtistRepository.getByTradition(params.tradition, params.limit, params.nextToken);
      }
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
}

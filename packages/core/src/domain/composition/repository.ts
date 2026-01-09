import { putItem, query, updateItem } from '../../db';
import { createQuery } from '../../db';
import { ErrorCode } from '../../constants';
import { ApplicationError } from '../../types/common';
import {
  getAllByPartitionKey,
  getByGlobalIndex,
  getByPrimaryKey,
} from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  EntityPrefix,
  SecondaryPrefix,
  createBaseItem,
  formatIndexKey,
  formatKey,
} from '../../shared/singleTable';
import { getCurrentISOString } from '../../utils/dateTime';
import {
  type Composition,
  type CompositionAttribution,
  type CreateAttributionInput,
  type CreateCompositionInput,
  type UpdateAttributionInput,
  type UpdateCompositionInput,
  attributionSchema,
  compositionSchema,
} from './schema';
import {
  type AttributionDynamoItem,
  type AttributionSearchParams,
  type AttributionSearchResult,
  AttributionType,
  type CompositionDynamoItem,
  type CompositionSearchParams,
  type CompositionSearchResult,
  type CompositionWithAttributions,
} from './types';

const normalizeLanguage = (language: string): string => {
  const languageMap: Record<string, string> = {
    sanskrit: 'Sanskrit',
    tamil: 'Tamil',
    telugu: 'Telugu',
    kannada: 'Kannada',
    hindi: 'Hindi',
    urdu: 'Urdu',
    marathi: 'Marathi',
    gujarati: 'Gujarati',
    bengali: 'Bengali',
    punjabi: 'Punjabi',
    malayalam: 'Malayalam',
  };

  const lowerLanguage = language.toLowerCase();
  return (
    languageMap[lowerLanguage] || language.charAt(0).toUpperCase() + language.slice(1).toLowerCase()
  );
};

// Centralized GSI management
const populateIndexes = (
  composition: { title?: string; tradition?: string; language?: string },
  id: string
) => ({
  ...(composition.title && {
    GSI1PK: formatIndexKey('TITLE', composition.title.toLowerCase()),
    GSI1SK: formatKey(EntityPrefix.COMPOSITION, id),
  }),
  ...(composition.tradition && {
    GSI2PK: formatIndexKey('TRADITION', composition.tradition),
    GSI2SK: formatKey(EntityPrefix.COMPOSITION, id),
  }),
  ...(composition.language && {
    GSI3PK: formatIndexKey('LANGUAGE', composition.language.toLowerCase()),
    GSI3SK: formatKey(EntityPrefix.COMPOSITION, id),
  }),
});

export class CompositionRepository {
  static async create(input: CreateCompositionInput): Promise<Composition> {
    const baseItem = await createBaseItem(EntityPrefix.COMPOSITION);
    const timestamp = getCurrentISOString();

    const normalizedInput = {
      ...input,
      title: input.title.trim(),
      language: normalizeLanguage(input.language),
    };

    const compositionItem: CompositionDynamoItem = {
      PK: baseItem.PK,
      SK: SecondaryPrefix.METADATA,
      id: baseItem.id,
      createdAt: baseItem.createdAt,
      updatedAt: timestamp,
      ...normalizedInput,
      editedBy: [input.editorId],
      viewCount: 0,
      favoriteCount: 0,
      popularityScore: 0,
      ...populateIndexes({ ...normalizedInput }, baseItem.id),
    };

    await putItem(compositionItem);
    return compositionSchema.parse(compositionItem);
  }

  static async getById(id: string): Promise<Composition | null> {
    return getByPrimaryKey<CompositionDynamoItem>(
      EntityPrefix.COMPOSITION,
      id,
      SecondaryPrefix.METADATA
    );
  }

  static async getWithAttributions(id: string): Promise<CompositionWithAttributions | null> {
    const composition = await CompositionRepository.getById(id);
    if (!composition) return null;

    const attributions = await CompositionRepository.getAttributionsByCompositionId(id);

    return {
      ...composition,
      attributions: attributions.items,
    };
  }

  static async update(id: string, input: UpdateCompositionInput): Promise<Composition> {
    const current = await CompositionRepository.getById(id);
    if (!current) {
      throw new ApplicationError(ErrorCode.COMPOSITION_NOT_FOUND, `Composition ${id} not found`);
    }

    const normalizedInput = {
      ...input,
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.language ? { language: normalizeLanguage(input.language) } : {}),
    };

    const timestamp = getCurrentISOString();
    const merged = { ...current, ...normalizedInput };
    const updates = {
      ...normalizedInput,
      updatedAt: timestamp,
      editedBy: [...new Set([...current.editedBy, input.editorId])],
      ...populateIndexes(merged, id),
    };

    await updateItem(
      {
        PK: formatKey(EntityPrefix.COMPOSITION, id),
        SK: SecondaryPrefix.METADATA,
      },
      updates
    );

    return CompositionRepository.getById(id) as Promise<Composition>;
  }

  static async searchByTitle(title: string, limit = 20): Promise<CompositionSearchResult> {
    const result = await query<CompositionDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':pk': formatIndexKey('TITLE', title.toLowerCase()),
        ':sk': SecondaryPrefix.METADATA,
      },
      Limit: limit,
    });

    const scoredItems = scoreSearchResults(result.items, title, [
      { name: 'title', weight: 1 },
      { name: 'alternativeTitles', weight: 0.5 },
    ]);

    return createPaginatedResponse(scoredItems, result.lastEvaluatedKey);
  }

  static async getByTradition(
    tradition: string,
    limit = 20,
    nextToken?: string
  ): Promise<CompositionSearchResult> {
    const result = await getByGlobalIndex<CompositionDynamoItem>(
      'GSI2',
      'GSI2PK',
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

  static async getByLanguage(
    language: string,
    limit = 20,
    nextToken?: string
  ): Promise<CompositionSearchResult> {
    const normalizedLanguage = normalizeLanguage(language);
    const result = await getByGlobalIndex<CompositionDynamoItem>(
      'GSI3',
      'GSI3PK',
      formatIndexKey('LANGUAGE', normalizedLanguage.toLowerCase()),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async search(params: CompositionSearchParams): Promise<CompositionSearchResult> {
    if (params.query) {
      return CompositionRepository.searchByTitle(params.query, params.limit);
    }

    if (params.tradition) {
      return CompositionRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    if (params.language) {
      return CompositionRepository.getByLanguage(params.language, params.limit, params.nextToken);
    }

    if (params.artistId) {
      const attributions = await CompositionRepository.getCompositionsByArtistId(
        params.artistId,
        params.limit,
        params.nextToken
      );

      const compositions = await Promise.all(
        attributions.items.map(attr => CompositionRepository.getById(attr.compositionId))
      );

      const validCompositions = compositions.filter((comp): comp is Composition => comp !== null);

      return {
        items: validCompositions,
        nextToken: attributions.nextToken,
        hasMore: attributions.hasMore,
      };
    }

    return { items: [], hasMore: false };
  }

  static async incrementViewCount(id: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient, getTableName } = await import('../../db/client');

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: formatKey(EntityPrefix.COMPOSITION, id),
          SK: SecondaryPrefix.METADATA,
        },
        UpdateExpression: 'ADD viewCount :increment, popularityScore :scoreIncrement',
        ExpressionAttributeValues: {
          ':increment': 1,
          ':scoreIncrement': 0.1,
        },
      })
    );
  }

  // Attribution methods
  static async createAttribution(input: CreateAttributionInput): Promise<CompositionAttribution> {
    const timestamp = getCurrentISOString();

    const item: AttributionDynamoItem = {
      PK: formatKey(EntityPrefix.COMPOSITION, input.compositionId),
      SK: formatKey('ATTRIBUTION', input.artistId),
      GSI1PK: formatKey(EntityPrefix.ARTIST, input.artistId),
      GSI1SK: formatKey('COMPOSES', input.compositionId),
      GSI2PK: formatKey('ATTRIBUTION_TYPE', input.attributionType),
      GSI2SK: formatKey(EntityPrefix.COMPOSITION, input.compositionId),
      ...input,
      createdAt: timestamp,
      verifiedBy: [],
    };

    await putItem(item);
    return attributionSchema.parse(item);
  }

  static async updateAttribution(input: UpdateAttributionInput): Promise<CompositionAttribution> {
    const key = {
      PK: formatKey(EntityPrefix.COMPOSITION, input.compositionId),
      SK: formatKey('ATTRIBUTION', input.artistId),
    };

    const existing = await getByPrimaryKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      input.compositionId,
      formatKey('ATTRIBUTION', input.artistId)
    );

    if (!existing) {
      throw new ApplicationError(
        ErrorCode.COMPOSITION_NOT_FOUND,
        `Attribution for composition ${input.compositionId} and artist ${input.artistId} not found`
      );
    }

    const updates: Partial<AttributionDynamoItem> = { ...input };

    if (input.attributionType) {
      updates.GSI2PK = formatKey('ATTRIBUTION_TYPE', input.attributionType);
    }

    const updated = await updateItem<AttributionDynamoItem>(key, updates);
    return attributionSchema.parse(updated);
  }

  static async getAttribution(
    compositionId: string,
    artistId: string
  ): Promise<CompositionAttribution | null> {
    return getByPrimaryKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      compositionId,
      formatKey('ATTRIBUTION', artistId)
    );
  }

  static async getAttributionsByCompositionId(
    compositionId: string
  ): Promise<AttributionSearchResult> {
    const result = await getAllByPartitionKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      compositionId,
      { sortKeyPrefix: 'ATTRIBUTION#' }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async getCompositionsByArtistId(
    artistId: string,
    limit = 20,
    nextToken?: string
  ): Promise<AttributionSearchResult> {
    const result = await getByGlobalIndex<AttributionDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatKey(EntityPrefix.ARTIST, artistId),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async getDisputedAttributions(
    limit = 20,
    nextToken?: string
  ): Promise<AttributionSearchResult> {
    const result = await getByGlobalIndex<AttributionDynamoItem>(
      'GSI2',
      'GSI2PK',
      formatKey('ATTRIBUTION_TYPE', AttributionType.DISPUTED),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async verifyAttribution(
    compositionId: string,
    artistId: string,
    userId: string
  ): Promise<CompositionAttribution> {
    const key = {
      PK: formatKey(EntityPrefix.COMPOSITION, compositionId),
      SK: formatKey('ATTRIBUTION', artistId),
    };

    const existing = await getByPrimaryKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      compositionId,
      formatKey('ATTRIBUTION', artistId)
    );

    if (!existing) {
      throw new ApplicationError(
        ErrorCode.COMPOSITION_NOT_FOUND,
        `Attribution for composition ${compositionId} and artist ${artistId} not found`
      );
    }

    const verifiedBy = existing.verifiedBy || [];
    if (!verifiedBy.includes(userId)) {
      verifiedBy.push(userId);
    }

    const updated = await updateItem<AttributionDynamoItem>(key, { verifiedBy });
    return attributionSchema.parse(updated);
  }

  static async searchAttributions(
    params: AttributionSearchParams
  ): Promise<AttributionSearchResult> {
    if (params.compositionId) {
      return CompositionRepository.getAttributionsByCompositionId(params.compositionId);
    }

    if (params.artistId) {
      return CompositionRepository.getCompositionsByArtistId(
        params.artistId,
        params.limit,
        params.nextToken
      );
    }

    if (params.attributionType === AttributionType.DISPUTED) {
      return CompositionRepository.getDisputedAttributions(params.limit, params.nextToken);
    }

    return { items: [], hasMore: false };
  }

  static async getPopular(limit = 10): Promise<Composition[]> {
    const result = await createQuery<CompositionDynamoItem>()
      .withIndex('GSI5')
      .withPartitionKey('GSI5PK', 'POPULARITY')
      .withSortOrder(false) // Descending order by view count
      .withLimit(limit)
      .execute();

    return result.items;
  }

  static async getBySourceUrl(sourceUrl: string): Promise<Composition | null> {
    const result = await getByGlobalIndex<CompositionDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatIndexKey('SOURCE_URL', sourceUrl),
      { limit: 1 }
    );

    return result.items[0] || null;
  }
}

import { type DynamoItem, batchPutItems, query, updateItem, putItem } from '../../db';

import {
  type CreateCompositionInput,
  type Composition,
  compositionSchema,
  type UpdateCompositionInput,
  type CreateAttributionInput,
  type CompositionAttribution,
  attributionSchema,
  type UpdateAttributionInput,
} from './schema';
import {
  type CompositionDynamoItem,
  type CompositionWithAttributions,
  type CompositionVersion,
  type CompositionSearchResult,
  type AttributionDynamoItem,
  type AttributionSearchResult,
  AttributionType,
} from './types';
import { getByPrimaryKey, getAllByPartitionKey, getByGlobalIndex } from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import { createBaseItem, EntityPrefix, formatVersionKey, formatIndexKey, formatKey } from '../../shared/singleTable';
import { getCurrentISOString } from '../../utils';

export class CompositionRepository {
  static async create(input: CreateCompositionInput): Promise<Composition> {
    // Create a new base Composition item
    const baseItem = await createBaseItem(EntityPrefix.COMPOSITION);
    const timestamp = getCurrentISOString();
    const version = 'v1';

    // Create primary version record
    const compositionItem: CompositionDynamoItem = {
      ...baseItem,
      ...input,
      version,
      addedBy: input.editorId,
      editedBy: [input.editorId],
      viewCount: 0,
      favoriteCount: 0,
      popularityScore: 0,
      isLatest: true,

      // Dynamo specific fields
      SK: formatVersionKey(version, timestamp),
      GSI1PK: formatIndexKey('TITLE', input.title.toLowerCase()),
      GSI1SK: formatKey(EntityPrefix.COMPOSITION, baseItem.id),
    };

    // Add tradition index
    compositionItem.GSI2PK = formatIndexKey('TRADITION', input.tradition);
    compositionItem.GSI2SK = formatKey(EntityPrefix.COMPOSITION, baseItem.id);

    // Add language index if provided
    if (input.language) {
      compositionItem.GSI3PK = formatIndexKey('LANGUAGE', input.language.toLowerCase());
      compositionItem.GSI3SK = formatKey(EntityPrefix.COMPOSITION, baseItem.id);
    }

    // Create Latest version pointer
    const latestPointer: DynamoItem = {
      PK: compositionItem.PK,
      SK: 'VERSION#LATEST',
      version,
      timestamp,
      isLatest: true,
    };

    // Create records in a transaction
    await batchPutItems([compositionItem, latestPointer]);

    return compositionSchema.parse(compositionItem);
  }

  static async getById(id: string, version?: string): Promise<Composition | null> {
    if (version) {
      // Get specific version
      return getByPrimaryKey<CompositionDynamoItem>(
        EntityPrefix.COMPOSITION,
        id,
        formatVersionKey(version)
      );
    }

    // Get latest version pointer
    const latestPointer = await getByPrimaryKey<any>(
      EntityPrefix.COMPOSITION,
      id,
      'VERSION#LATEST'
    );

    if (!latestPointer) return null;

    // Get the actual latest version
    return getByPrimaryKey<CompositionDynamoItem>(
      EntityPrefix.COMPOSITION,
      id,
      formatVersionKey(latestPointer.version, latestPointer.timestamp)
    );
  }

  static async getWithAttributions(id: string): Promise<CompositionWithAttributions | null> {
    // Get the composition
    const composition = await CompositionRepository.getById(id);
    if (!composition) return null;

    // Get attributions
    const attributions = await CompositionRepository.getAttributionsByCompositionId(id);

    // Return combined result
    return {
      ...composition,
      attributions: attributions.items,
    };
  }

  static async update(id: string, input: UpdateCompositionInput): Promise<Composition> {
    // Get current latest version
    const current = await CompositionRepository.getById(id);
    if (!current) {
      throw new Error(`Composition ${id} not found`);
    }

    // Create new version number
    const currentVersion = current.version;
    const versionNum = Number.parseInt(currentVersion.replace('v', ''));
    const newVersion = `v${versionNum + 1}`;
    const timestamp = getCurrentISOString();

    // Build new version with updates
    const compositionItem: CompositionDynamoItem = {
      ...current,
      ...input,
      version: newVersion,
      updatedAt: timestamp,
      editedBy: [...new Set([...current.editedBy, input.editorId])],

      // Keys - maintain same PK but new version SK
      PK: formatKey(EntityPrefix.COMPOSITION, id),
      SK: formatVersionKey(newVersion, timestamp),
    };

    // Update GSI fields if relevant
    if (input.title) {
      compositionItem.GSI1PK = formatIndexKey('TITLE', input.title.toLowerCase());
      compositionItem.GSI1SK = formatKey(EntityPrefix.COMPOSITION, id);
    }

    if (input.tradition) {
      compositionItem.GSI2PK = formatIndexKey('TRADITION', input.tradition);
      compositionItem.GSI2SK = formatKey(EntityPrefix.COMPOSITION, id);
    }

    if (input.language) {
      compositionItem.GSI3PK = formatIndexKey('LANGUAGE', input.language.toLowerCase());
      compositionItem.GSI3SK = formatKey(EntityPrefix.COMPOSITION, id);
    }

    // Update latest pointer
    const latestPointer: DynamoItem = {
      PK: compositionItem.PK,
      SK: 'VERSION#LATEST',
      version: newVersion,
      timestamp,
      isLatest: true,
    };

    // Mark old version as non-latest
    const oldVersionUpdate = {
      PK: compositionItem.PK,
      SK: formatVersionKey(currentVersion, current.updatedAt),
      isLatest: false,
    };

    // Create records in a transaction
    await batchPutItems([compositionItem, latestPointer, oldVersionUpdate]);

    return compositionSchema.parse(compositionItem);
  }

  static async getVersionHistory(id: string): Promise<CompositionVersion[]> {
    // Query all versions
    const result = await getAllByPartitionKey(EntityPrefix.COMPOSITION, id, {
      sortKeyPrefix: 'VERSION#v',
    });

    return result.items.map(item => ({
      id,
      version: item.version,
      timestamp: item.updatedAt || item.createdAt,
      editorId: item.editedBy[item.editedBy.length - 1],
    }));
  }

  static async searchByTitle(title: string, limit = 20): Promise<CompositionSearchResult> {
    // Basic search by title
    const result = await query<CompositionDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':start': formatIndexKey('TITLE', title.toLowerCase()),
        ':end': formatIndexKey('TITLE', `${title.toLowerCase()}\uffff`),
      },
      Limit: limit,
    });

    // Filter for latest versions
    const latestVersions = result.items.filter(item => item.isLatest);

    // Score by relevance
    const scoredItems = scoreSearchResults(latestVersions, title, [
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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

    return createPaginatedResponse(latestVersions, result.lastEvaluatedKey);
  }

  static async getByLanguage(
    language: string,
    limit = 20,
    nextToken?: string
  ): Promise<CompositionSearchResult> {
    const result = await getByGlobalIndex<CompositionDynamoItem>(
      'GSI3',
      'GSI3PK',
      formatIndexKey('LANGUAGE', language.toLowerCase()),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

    return createPaginatedResponse(latestVersions, result.lastEvaluatedKey);
  }

  static async incrementViewCount(id: string): Promise<void> {
    // Get current latest version
    const latestPointer = await getByPrimaryKey<any>(
      EntityPrefix.COMPOSITION,
      id,
      'VERSION#LATEST'
    );

    if (!latestPointer) return;

    // Update the view count on the latest version
    await updateItem(
      {
        PK: formatKey(EntityPrefix.COMPOSITION, id),
        SK: formatVersionKey(latestPointer.version, latestPointer.timestamp),
      },
      {
        viewCount: { $increment: 1 },
        // We can also update popularity score here using a formula
        popularityScore: { $add: 0.1 },
      }
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

    // Check if attribution exists
    const existing = await getByPrimaryKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      input.compositionId,
      formatKey('ATTRIBUTION', input.artistId)
    );

    if (!existing) {
      throw new Error(
        `Attribution for composition ${input.compositionId} and artist ${input.artistId} not found`
      );
    }

    // Update attribution
    const updates = { ...input };

    // Update GSI2PK if attributionType changes
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

    const attribution = await getByPrimaryKey<AttributionDynamoItem>(
      EntityPrefix.COMPOSITION,
      compositionId,
      formatKey('ATTRIBUTION', artistId)
    );

    if (!attribution) {
      throw new Error(
        `Attribution for composition ${compositionId} and artist ${artistId} not found`
      );
    }

    // Add user to verifiedBy list if not already there
    const verifiedBy = attribution.verifiedBy || [];
    if (!verifiedBy.includes(userId)) {
      verifiedBy.push(userId);
    }

    const updated = await updateItem<AttributionDynamoItem>(key, { verifiedBy });

    return attributionSchema.parse(updated);
  }
}

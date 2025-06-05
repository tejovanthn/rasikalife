import { query, updateItem, putItem } from '../../db';
import { VersioningService, type VersioningConfig } from '../../shared/versioning';

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
import {
  getByPrimaryKey,
  getAllByPartitionKey,
  getByGlobalIndex,
} from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  EntityPrefix,
  formatIndexKey,
  formatKey,
} from '../../shared/singleTable';

/**
 * Versioning configuration for compositions
 */
const compositionVersioningConfig: VersioningConfig<
  Composition,
  CompositionDynamoItem,
  CreateCompositionInput,
  UpdateCompositionInput
> = {
  entityPrefix: EntityPrefix.COMPOSITION,
  schema: compositionSchema,
  applyDefaults: (input) => ({
    addedBy: input.editorId,
    favoriteCount: 0,
    popularityScore: 0,
  }),
  applyGSIMappings: (item, input) => {
    const mappings: Partial<CompositionDynamoItem> = {};

    // GSI1: Title search (always required for compositions)
    if ('title' in input && input.title) {
      mappings.GSI1PK = formatIndexKey('TITLE', input.title.toLowerCase());
      mappings.GSI1SK = formatKey(EntityPrefix.COMPOSITION, item.id);
    }

    // GSI2: Tradition search (always required for compositions)
    if ('tradition' in input && input.tradition) {
      mappings.GSI2PK = formatIndexKey('TRADITION', input.tradition);
      mappings.GSI2SK = formatKey(EntityPrefix.COMPOSITION, item.id);
    }

    // GSI3: Language search
    if ('language' in input && input.language) {
      mappings.GSI3PK = formatIndexKey('LANGUAGE', input.language.toLowerCase());
      mappings.GSI3SK = formatKey(EntityPrefix.COMPOSITION, item.id);
    }

    return mappings;
  },
};

export class CompositionRepository {
  static async create(input: CreateCompositionInput): Promise<Composition> {
    return VersioningService.create(input, compositionVersioningConfig);
  }

  static async getById(id: string, version?: string): Promise<Composition | null> {
    return VersioningService.getById(id, compositionVersioningConfig, version);
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
    return VersioningService.update(
      id, 
      input, 
      compositionVersioningConfig, 
      CompositionRepository.getById
    );
  }

  static async getVersionHistory(id: string): Promise<CompositionVersion[]> {
    return VersioningService.getVersionHistory(id, EntityPrefix.COMPOSITION);
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

    // Optimized: Filter for latest versions using SK pattern instead of isLatest flag
    const latestVersions = result.items.filter(item => item.SK === 'VERSION#LATEST');

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

    // Optimized: Filter for latest versions using SK pattern instead of isLatest flag
    const latestVersions = result.items.filter(item => item.SK === 'VERSION#LATEST');

    return createPaginatedResponse(latestVersions, result.lastEvaluatedKey);
  }

  static async incrementViewCount(id: string): Promise<void> {
    // Optimized: Update both the specific version and the denormalized latest pointer
    // This ensures consistent view counts across both records
    const pk = formatKey(EntityPrefix.COMPOSITION, id);
    const latestSK = 'VERSION#LATEST';
    
    // Get latest pointer to find the version SK
    const latestPointer = await getByPrimaryKey<any>(
      EntityPrefix.COMPOSITION,
      id,
      latestSK
    );

    if (!latestPointer) return;

    const versionSK = formatVersionKey(latestPointer.version, latestPointer.timestamp);
    
    // Update both records atomically using batch operations
    await Promise.all([
      // Update the specific version record
      updateItem(
        { PK: pk, SK: versionSK },
        {
          viewCount: { $increment: 1 },
          popularityScore: { $add: 0.1 },
        }
      ),
      // Update the denormalized latest pointer for consistency
      updateItem(
        { PK: pk, SK: latestSK },
        {
          viewCount: { $increment: 1 },
          popularityScore: { $add: 0.1 },
        }
      ),
    ]);
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

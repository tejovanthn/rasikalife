import { query, updateItem } from '../../db';
import { VersioningService, type VersioningConfig } from '../../shared/versioning';
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
import type { Tradition } from '../artist';
import { type CreateTalaInput, type Tala, talaSchema, type UpdateTalaInput } from './schema';
import type { TalaDynamoItem, TalaVersion, TalaSearchResult } from './types';

/**
 * Versioning configuration for talas
 */
const talaVersioningConfig: VersioningConfig<
  Tala,
  TalaDynamoItem,
  CreateTalaInput,
  UpdateTalaInput
> = {
  entityPrefix: EntityPrefix.TALA,
  schema: talaSchema,
  applyGSIMappings: (item, input) => {
    const mappings: Partial<TalaDynamoItem> = {};

    // GSI1: Name search
    if ('name' in input && input.name) {
      mappings.GSI1PK = formatIndexKey('TALA_NAME', input.name.toLowerCase());
      mappings.GSI1SK = formatKey(EntityPrefix.TALA, item.id);
    }

    // GSI2: Aksharas search
    if ('aksharas' in input && input.aksharas) {
      mappings.GSI2PK = formatIndexKey('AKSHARAS', input.aksharas.toString());
      mappings.GSI2SK = formatKey(EntityPrefix.TALA, item.id);
    }

    // GSI3: Type search
    if ('type' in input && input.type) {
      mappings.GSI3PK = formatIndexKey('TALA_TYPE', input.type.toLowerCase());
      mappings.GSI3SK = formatKey(EntityPrefix.TALA, item.id);
    }

    // GSI4: Tradition search
    if ('tradition' in input && input.tradition) {
      mappings.GSI4PK = formatIndexKey('TRADITION', input.tradition);
      mappings.GSI4SK = formatKey(EntityPrefix.TALA, item.id);
    }

    return mappings;
  },
};

export class TalaRepository {
  static async create(input: CreateTalaInput): Promise<Tala> {
    return VersioningService.create(input, talaVersioningConfig);
  }

  static async getById(id: string, version?: string): Promise<Tala | null> {
    return VersioningService.getById(id, talaVersioningConfig, version);
  }

  static async update(id: string, input: UpdateTalaInput): Promise<Tala> {
    return VersioningService.update(
      id,
      input,
      talaVersioningConfig,
      TalaRepository.getById
    );
  }

  static async getVersionHistory(id: string): Promise<TalaVersion[]> {
    return VersioningService.getVersionHistory(id, EntityPrefix.TALA);
  }

  static async getByName(name: string): Promise<Tala | null> {
    // Use GSI1 to lookup by name
    const results = await getByGlobalIndex<TalaDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatIndexKey('TALA_NAME', name.toLowerCase()),
      { limit: 1 }
    );

    if (results.items.length === 0) return null;

    // Get the latest version
    return TalaRepository.getById(results.items[0].id);
  }

  static async getByAksharas(
    aksharas: number,
    limit = 20,
    nextToken?: string
  ): Promise<TalaSearchResult> {
    const result = await getByGlobalIndex<TalaDynamoItem>(
      'GSI2',
      'GSI2PK',
      formatIndexKey('AKSHARAS', aksharas.toString()),
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

  static async getByType(type: string, limit = 20, nextToken?: string): Promise<TalaSearchResult> {
    const result = await getByGlobalIndex<TalaDynamoItem>(
      'GSI3',
      'GSI3PK',
      formatIndexKey('TALA_TYPE', type.toLowerCase()),
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

  static async getByTradition(
    tradition: Tradition,
    limit = 20,
    nextToken?: string
  ): Promise<TalaSearchResult> {
    const result = await getByGlobalIndex<TalaDynamoItem>(
      'GSI4',
      'GSI4PK',
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

  static async search(name: string, limit = 20): Promise<TalaSearchResult> {
    // Basic search by name
    const result = await query<TalaDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':start': formatIndexKey('TALA_NAME', name.toLowerCase()),
        ':end': formatIndexKey('TALA_NAME', `${name.toLowerCase()}\uffff`),
      },
      Limit: limit,
    });

    // Filter for latest versions
    const latestVersions = result.items.filter(item => item.isLatest);

    // Score by relevance
    const scoredItems = scoreSearchResults(latestVersions, name, [
      { name: 'name', weight: 1 },
      { name: 'alternativeNames', weight: 0.5 },
    ]);

    return createPaginatedResponse(scoredItems, result.lastEvaluatedKey);
  }

  static async incrementViewCount(id: string): Promise<void> {
    // Get current latest version
    const latestPointer = await getByPrimaryKey<any>(EntityPrefix.TALA, id, 'VERSION#LATEST');

    if (!latestPointer) return;

    // Update the view count on the latest version
    await updateItem(
      {
        PK: formatKey(EntityPrefix.TALA, id),
        SK: formatVersionKey(latestPointer.version, latestPointer.timestamp),
      },
      { viewCount: { $increment: 1 } }
    );
  }
}

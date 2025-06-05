import { query, updateItem } from '../../db';
import { VersioningService, type VersioningConfig } from '../../shared/versioning';
import {
  getByPrimaryKey,
  getByGlobalIndex,
} from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  EntityPrefix,
  formatIndexKey,
  formatKey,
  formatVersionKey,
} from '../../shared/singleTable';
import type { Tradition } from '../artist';
import { type CreateRagaInput, type Raga, ragaSchema, type UpdateRagaInput } from './schema';
import type { RagaDynamoItem, RagaVersion, RagaSearchResult } from './types';

/**
 * Versioning configuration for ragas
 */
const ragaVersioningConfig: VersioningConfig<
  Raga,
  RagaDynamoItem,
  CreateRagaInput,
  UpdateRagaInput
> = {
  entityPrefix: EntityPrefix.RAGA,
  schema: ragaSchema,
  applyGSIMappings: (item, input) => {
    const mappings: Partial<RagaDynamoItem> = {};

    // GSI1: Name search
    if ('name' in input && input.name) {
      mappings.GSI1PK = formatIndexKey('RAGA_NAME', input.name.toLowerCase());
      mappings.GSI1SK = formatKey(EntityPrefix.RAGA, item.id);
    }

    // GSI2: Melakarta search
    if ('melakarta' in input && input.melakarta) {
      mappings.GSI2PK = formatIndexKey('MELAKARTA', input.melakarta.toString());
      mappings.GSI2SK = formatKey(EntityPrefix.RAGA, item.id);
    }

    // GSI3: Tradition search
    if ('tradition' in input && input.tradition) {
      mappings.GSI3PK = formatIndexKey('TRADITION', input.tradition);
      mappings.GSI3SK = formatKey(EntityPrefix.RAGA, item.id);
    }

    return mappings;
  },
};

export class RagaRepository {
  static async create(input: CreateRagaInput): Promise<Raga> {
    return VersioningService.create(input, ragaVersioningConfig);
  }

  static async getById(id: string, version?: string): Promise<Raga | null> {
    return VersioningService.getById(id, ragaVersioningConfig, version);
  }

  static async update(id: string, input: UpdateRagaInput): Promise<Raga> {
    return VersioningService.update(
      id,
      input,
      ragaVersioningConfig,
      RagaRepository.getById
    );
  }

  static async getVersionHistory(id: string): Promise<RagaVersion[]> {
    return VersioningService.getVersionHistory(id, EntityPrefix.RAGA);
  }

  static async getByName(name: string): Promise<Raga | null> {
    // Use GSI1 to lookup by name
    const results = await getByGlobalIndex<RagaDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatIndexKey('RAGA_NAME', name.toLowerCase()),
      { limit: 1 }
    );

    if (results.items.length === 0) return null;

    // Get the latest version
    return RagaRepository.getById(results.items[0].id);
  }

  static async getByMelakarta(
    melakarta: number,
    limit = 20,
    nextToken?: string
  ): Promise<RagaSearchResult> {
    const result = await getByGlobalIndex<RagaDynamoItem>(
      'GSI2',
      'GSI2PK',
      formatIndexKey('MELAKARTA', melakarta.toString()),
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
  ): Promise<RagaSearchResult> {
    const result = await getByGlobalIndex<RagaDynamoItem>(
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

    // Optimized: Filter for latest versions using SK pattern instead of isLatest flag
    const latestVersions = result.items.filter(item => item.SK === 'VERSION#LATEST');

    return createPaginatedResponse(latestVersions, result.lastEvaluatedKey);
  }

  static async search(name: string, limit = 20): Promise<RagaSearchResult> {
    // Basic search by name
    const result = await query<RagaDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':start': formatIndexKey('RAGA_NAME', name.toLowerCase()),
        ':end': formatIndexKey('RAGA_NAME', `${name.toLowerCase()}\uffff`),
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
    const latestPointer = await getByPrimaryKey<any>(EntityPrefix.RAGA, id, 'VERSION#LATEST');

    if (!latestPointer) return;

    // Update the view count on the latest version
    await updateItem(
      {
        PK: formatKey(EntityPrefix.RAGA, id),
        SK: formatVersionKey(latestPointer.version, latestPointer.timestamp),
      },
      { viewCount: { $increment: 1 } }
    );
  }
}

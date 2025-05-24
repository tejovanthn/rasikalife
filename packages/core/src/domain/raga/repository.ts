import { type DynamoItem, batchPutItems, query, updateItem } from '../../db';
import { getByPrimaryKey, getAllByPartitionKey, getByGlobalIndex } from '../../shared/accessPatterns';
import { createPaginatedResponse } from '../../shared/pagination';
import { scoreSearchResults } from '../../shared/search';
import {
  createBaseItem,
  EntityPrefix,
  formatVersionKey,
  formatIndexKey,
  formatKey,
} from '../../shared/singleTable';
import { getCurrentISOString } from '../../utils';
import type { Tradition } from '../artist';
import { type CreateRagaInput, type Raga, ragaSchema, type UpdateRagaInput } from './schema';
import type { RagaDynamoItem, RagaVersion, RagaSearchResult } from './types';

export class RagaRepository {
  static async create(input: CreateRagaInput): Promise<Raga> {
    // Create a new base Raga item
    const baseItem = await createBaseItem(EntityPrefix.RAGA);
    const timestamp = getCurrentISOString();
    const version = 'v1';

    // Create primary version record
    const ragaItem: RagaDynamoItem = {
      ...baseItem,
      ...input,
      version,
      viewCount: 0,
      editedBy: [input.editorId],
      isLatest: true,

      // Dynamo specific fields
      SK: formatVersionKey(version, timestamp),
      GSI1PK: formatIndexKey('RAGA_NAME', input.name.toLowerCase()),
      GSI1SK: formatKey(EntityPrefix.RAGA, baseItem.id),
    };

    // Add melakarta index if provided
    if (input.melakarta) {
      ragaItem.GSI2PK = formatIndexKey('MELAKARTA', input.melakarta.toString());
      ragaItem.GSI2SK = formatKey(EntityPrefix.RAGA, baseItem.id);
    }

    // Add tradition index
    ragaItem.GSI3PK = formatIndexKey('TRADITION', input.tradition);
    ragaItem.GSI3SK = formatKey(EntityPrefix.RAGA, baseItem.id);

    // Create Latest version pointer
    const latestPointer: DynamoItem = {
      PK: ragaItem.PK,
      SK: 'VERSION#LATEST',
      version,
      timestamp,
      isLatest: true,
    };

    // Create records in a transaction
    await batchPutItems([ragaItem, latestPointer]);

    return ragaSchema.parse(ragaItem);
  }

  static async getById(id: string, version?: string): Promise<Raga | null> {
    if (version) {
      // Get specific version
      return getByPrimaryKey<RagaDynamoItem>(EntityPrefix.RAGA, id, formatVersionKey(version));
    }

    // Get latest version pointer
    const latestPointer = await getByPrimaryKey<any>(EntityPrefix.RAGA, id, 'VERSION#LATEST');

    if (!latestPointer) return null;

    // Get the actual latest version
    return getByPrimaryKey<RagaDynamoItem>(
      EntityPrefix.RAGA,
      id,
      formatVersionKey(latestPointer.version, latestPointer.timestamp)
    );
  }

  static async update(id: string, input: UpdateRagaInput): Promise<Raga> {
    // Get current latest version
    const current = await RagaRepository.getById(id);
    if (!current) {
      throw new Error(`Raga ${id} not found`);
    }

    // Create new version number
    const currentVersion = current.version;
    const versionNum = Number.parseInt(currentVersion.replace('v', ''));
    const newVersion = `v${versionNum + 1}`;
    const timestamp = getCurrentISOString();

    // Build new version with updates
    const ragaItem: RagaDynamoItem = {
      ...current,
      ...input,
      version: newVersion,
      updatedAt: timestamp,
      editedBy: [...new Set([...current.editedBy, input.editorId])],

      // Keys - maintain same PK but new version SK
      PK: formatKey(EntityPrefix.RAGA, id),
      SK: formatVersionKey(newVersion, timestamp),
    };

    // Update GSI fields if relevant
    if (input.name) {
      ragaItem.GSI1PK = formatIndexKey('RAGA_NAME', input.name.toLowerCase());
      ragaItem.GSI1SK = formatKey(EntityPrefix.RAGA, id);
    }

    if (input.melakarta) {
      ragaItem.GSI2PK = formatIndexKey('MELAKARTA', input.melakarta.toString());
      ragaItem.GSI2SK = formatKey(EntityPrefix.RAGA, id);
    }

    if (input.tradition) {
      ragaItem.GSI3PK = formatIndexKey('TRADITION', input.tradition);
      ragaItem.GSI3SK = formatKey(EntityPrefix.RAGA, id);
    }

    // Update latest pointer
    const latestPointer: DynamoItem = {
      PK: ragaItem.PK,
      SK: 'VERSION#LATEST',
      version: newVersion,
      timestamp,
      isLatest: true,
    };

    // Mark old version as non-latest
    const oldVersionUpdate = {
      PK: ragaItem.PK,
      SK: formatVersionKey(currentVersion, current.updatedAt),
      isLatest: false,
    };

    // Create records in a transaction
    await batchPutItems([ragaItem, latestPointer, oldVersionUpdate]);

    return ragaSchema.parse(ragaItem);
  }

  static async getVersionHistory(id: string): Promise<RagaVersion[]> {
    // Query all versions
    const result = await getAllByPartitionKey(EntityPrefix.RAGA, id, {
      sortKeyPrefix: 'VERSION#v',
    });

    return result.items.map(item => ({
      id,
      version: item.version,
      timestamp: item.updatedAt || item.createdAt,
      editorId: item.editedBy[item.editedBy.length - 1],
    }));
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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

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

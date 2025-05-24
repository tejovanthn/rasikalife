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
import { type CreateTalaInput, type Tala, talaSchema, type UpdateTalaInput } from './schema';
import type { TalaDynamoItem, TalaVersion, TalaSearchResult } from './types';

export class TalaRepository {
  static async create(input: CreateTalaInput): Promise<Tala> {
    // Create a new base Tala item
    const baseItem = await createBaseItem(EntityPrefix.TALA);
    const timestamp = getCurrentISOString();
    const version = 'v1';

    // Create primary version record
    const talaItem: TalaDynamoItem = {
      ...baseItem,
      ...input,
      version,
      viewCount: 0,
      editedBy: [input.editorId],
      isLatest: true,

      // Dynamo specific fields
      SK: formatVersionKey(version, timestamp),
      GSI1PK: formatIndexKey('TALA_NAME', input.name.toLowerCase()),
      GSI1SK: formatKey(EntityPrefix.TALA, baseItem.id),
    };

    // Add beats/aksharas index
    talaItem.GSI2PK = formatIndexKey('AKSHARAS', input.aksharas.toString());
    talaItem.GSI2SK = formatKey(EntityPrefix.TALA, baseItem.id);

    // Add type index if provided
    if (input.type) {
      talaItem.GSI3PK = formatIndexKey('TALA_TYPE', input.type.toLowerCase());
      talaItem.GSI3SK = formatKey(EntityPrefix.TALA, baseItem.id);
    }

    // Add tradition index
    talaItem.GSI4PK = formatIndexKey('TRADITION', input.tradition);
    talaItem.GSI4SK = formatKey(EntityPrefix.TALA, baseItem.id);

    // Create Latest version pointer
    const latestPointer: DynamoItem = {
      PK: talaItem.PK,
      SK: 'VERSION#LATEST',
      version,
      timestamp,
      isLatest: true,
    };

    // Create records in a transaction
    await batchPutItems([talaItem, latestPointer]);

    return talaSchema.parse(talaItem);
  }

  static async getById(id: string, version?: string): Promise<Tala | null> {
    if (version) {
      // Get specific version
      return getByPrimaryKey<TalaDynamoItem>(EntityPrefix.TALA, id, formatVersionKey(version));
    }

    // Get latest version pointer
    const latestPointer = await getByPrimaryKey<any>(EntityPrefix.TALA, id, 'VERSION#LATEST');

    if (!latestPointer) return null;

    // Get the actual latest version
    return getByPrimaryKey<TalaDynamoItem>(
      EntityPrefix.TALA,
      id,
      formatVersionKey(latestPointer.version, latestPointer.timestamp)
    );
  }

  static async update(id: string, input: UpdateTalaInput): Promise<Tala> {
    // Get current latest version
    const current = await TalaRepository.getById(id);
    if (!current) {
      throw new Error(`Tala ${id} not found`);
    }

    // Create new version number
    const currentVersion = current.version;
    const versionNum = Number.parseInt(currentVersion.replace('v', ''));
    const newVersion = `v${versionNum + 1}`;
    const timestamp = getCurrentISOString();

    // Build new version with updates
    const talaItem: TalaDynamoItem = {
      ...current,
      ...input,
      version: newVersion,
      updatedAt: timestamp,
      editedBy: [...new Set([...current.editedBy, input.editorId])],

      // Keys - maintain same PK but new version SK
      PK: formatKey(EntityPrefix.TALA, id),
      SK: formatVersionKey(newVersion, timestamp),
    };

    // Update GSI fields if relevant
    if (input.name) {
      talaItem.GSI1PK = formatIndexKey('TALA_NAME', input.name.toLowerCase());
      talaItem.GSI1SK = formatKey(EntityPrefix.TALA, id);
    }

    if (input.aksharas) {
      talaItem.GSI2PK = formatIndexKey('AKSHARAS', input.aksharas.toString());
      talaItem.GSI2SK = formatKey(EntityPrefix.TALA, id);
    }

    if (input.type) {
      talaItem.GSI3PK = formatIndexKey('TALA_TYPE', input.type.toLowerCase());
      talaItem.GSI3SK = formatKey(EntityPrefix.TALA, id);
    }

    if (input.tradition) {
      talaItem.GSI4PK = formatIndexKey('TRADITION', input.tradition);
      talaItem.GSI4SK = formatKey(EntityPrefix.TALA, id);
    }

    // Update latest pointer
    const latestPointer: DynamoItem = {
      PK: talaItem.PK,
      SK: 'VERSION#LATEST',
      version: newVersion,
      timestamp,
      isLatest: true,
    };

    // Mark old version as non-latest
    const oldVersionUpdate = {
      PK: talaItem.PK,
      SK: formatVersionKey(currentVersion, current.updatedAt),
      isLatest: false,
    };

    // Create records in a transaction
    await batchPutItems([talaItem, latestPointer, oldVersionUpdate]);

    return talaSchema.parse(talaItem);
  }

  static async getVersionHistory(id: string): Promise<TalaVersion[]> {
    // Query all versions
    const result = await getAllByPartitionKey(EntityPrefix.TALA, id, {
      sortKeyPrefix: 'VERSION#v',
    });

    return result.items.map(item => ({
      id,
      version: item.version,
      timestamp: item.updatedAt || item.createdAt,
      editorId: item.editedBy[item.editedBy.length - 1],
    }));
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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

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

    // Filter for latest versions only
    const latestVersions = result.items.filter(item => item.isLatest);

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

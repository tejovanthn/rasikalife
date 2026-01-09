import { putItem, query, updateItem } from '../../db';
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
import { getCurrentISOString } from '../../utils/dateTime';
import type { Tradition } from '../artist';
import { type CreateTalaInput, type Tala, type UpdateTalaInput, talaSchema } from './schema';
import type { TalaDynamoItem, TalaSearchParams, TalaSearchResult } from './types';

const normalizeTalaName = (name: string): string => {
  const words = name.split(' ');
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const normalizeType = (type: string): string => {
  const typeMap: Record<string, string> = {
    suladi: 'Suladi',
    sapta: 'Sapta',
    chapu: 'Chapu',
    jati: 'Jati',
    misra: 'Misra',
    khanda: 'Khanda',
    tisra: 'Tisra',
    chatusra: 'Chatusra',
    sankeerna: 'Sankeerna',
  };

  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const populateIndexes = (
  tala: { name?: string; aksharas?: number; type?: string; tradition?: string },
  id: string
) => ({
  ...(tala.name && {
    GSI1PK: formatIndexKey('TALA_NAME', tala.name.toLowerCase()),
    GSI1SK: formatKey(EntityPrefix.TALA, id),
  }),
  ...(tala.aksharas && {
    GSI2PK: formatIndexKey('AKSHARAS', tala.aksharas.toString()),
    GSI2SK: formatKey(EntityPrefix.TALA, id),
  }),
  ...(tala.type && {
    GSI3PK: formatIndexKey('TALA_TYPE', tala.type.toLowerCase()),
    GSI3SK: formatKey(EntityPrefix.TALA, id),
  }),
  ...(tala.tradition && {
    GSI4PK: formatIndexKey('TRADITION', tala.tradition),
    GSI4SK: formatKey(EntityPrefix.TALA, id),
  }),
});

export class TalaRepository {
  static async create(input: CreateTalaInput): Promise<Tala> {
    const baseItem = await createBaseItem(EntityPrefix.TALA);
    const timestamp = getCurrentISOString();

    const normalizedInput = {
      ...input,
      name: normalizeTalaName(input.name),
      ...(input.type ? { type: normalizeType(input.type) } : {}),
    };

    const talaItem: TalaDynamoItem = {
      PK: baseItem.PK,
      SK: SecondaryPrefix.METADATA,
      id: baseItem.id,
      createdAt: baseItem.createdAt,
      updatedAt: timestamp,
      ...normalizedInput,
      editedBy: [input.editorId],
      viewCount: 0,
      ...populateIndexes({ ...normalizedInput }, baseItem.id),
    };

    await putItem(talaItem);
    return talaSchema.parse(talaItem);
  }

  static async getById(id: string): Promise<Tala | null> {
    return getByPrimaryKey<TalaDynamoItem>(EntityPrefix.TALA, id, SecondaryPrefix.METADATA);
  }

  static async update(id: string, input: UpdateTalaInput): Promise<Tala> {
    const current = await TalaRepository.getById(id);
    if (!current) {
      throw new ApplicationError(ErrorCode.TALA_NOT_FOUND, `Tala ${id} not found`);
    }

    const normalizedInput = {
      ...input,
      ...(input.name ? { name: normalizeTalaName(input.name) } : {}),
      ...(input.type ? { type: normalizeType(input.type) } : {}),
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
        PK: formatKey(EntityPrefix.TALA, id),
        SK: SecondaryPrefix.METADATA,
      },
      updates
    );

    return TalaRepository.getById(id) as Promise<Tala>;
  }

  static async getByName(name: string): Promise<Tala | null> {
    const result = await getByGlobalIndex<TalaDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatIndexKey('TALA_NAME', name.toLowerCase()),
      { limit: 1 }
    );

    if (result.items.length === 0) {
      // Try with normalized name
      const normalizedResults = await getByGlobalIndex<TalaDynamoItem>(
        'GSI1',
        'GSI1PK',
        formatIndexKey('TALA_NAME', normalizeTalaName(name).toLowerCase()),
        { limit: 1 }
      );
      if (normalizedResults.items.length === 0) return null;
      return talaSchema.parse(normalizedResults.items[0]);
    }

    return talaSchema.parse(result.items[0]);
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

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async getByType(type: string, limit = 20, nextToken?: string): Promise<TalaSearchResult> {
    const normalizedType = normalizeType(type);
    const result = await getByGlobalIndex<TalaDynamoItem>(
      'GSI3',
      'GSI3PK',
      formatIndexKey('TALA_TYPE', normalizedType.toLowerCase()),
      {
        limit,
        exclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
      }
    );

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
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

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async search(name: string, limit = 20): Promise<TalaSearchResult> {
    const result = await query<TalaDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':pk': formatIndexKey('TALA_NAME', name.toLowerCase()),
        ':sk': SecondaryPrefix.METADATA,
      },
      Limit: limit,
    });

    const scoredItems = scoreSearchResults(result.items, name, [
      { name: 'name', weight: 1 },
      { name: 'alternativeNames', weight: 0.5 },
    ]);

    return createPaginatedResponse(scoredItems, result.lastEvaluatedKey);
  }

  static async incrementViewCount(id: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient, getTableName } = await import('../../db/client');

    await docClient.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: formatKey(EntityPrefix.TALA, id),
          SK: SecondaryPrefix.METADATA,
        },
        UpdateExpression: 'ADD viewCount :increment',
        ExpressionAttributeValues: {
          ':increment': 1,
        },
      })
    );
  }

  static async searchTalas(params: TalaSearchParams): Promise<TalaSearchResult> {
    if (params.query) {
      return TalaRepository.search(params.query, params.limit);
    }

    if (params.aksharas) {
      return TalaRepository.getByAksharas(params.aksharas, params.limit, params.nextToken);
    }

    if (params.type) {
      return TalaRepository.getByType(params.type, params.limit, params.nextToken);
    }

    if (params.tradition) {
      return TalaRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    return { items: [], hasMore: false };
  }
}

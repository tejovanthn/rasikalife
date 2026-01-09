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
import { type CreateRagaInput, type Raga, type UpdateRagaInput, ragaSchema } from './schema';
import type { RagaDynamoItem, RagaSearchParams, RagaSearchResult } from './types';

const normalizeRagaName = (name: string): string => {
  const words = name.split(' ');
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const populateIndexes = (
  raga: { name?: string; melakarta?: number; tradition?: string },
  id: string
) => ({
  ...(raga.name && {
    GSI1PK: formatIndexKey('RAGA_NAME', raga.name.toLowerCase()),
    GSI1SK: formatKey(EntityPrefix.RAGA, id),
  }),
  ...(raga.melakarta && {
    GSI2PK: formatIndexKey('MELAKARTA', raga.melakarta.toString()),
    GSI2SK: formatKey(EntityPrefix.RAGA, id),
  }),
  ...(raga.tradition && {
    GSI3PK: formatIndexKey('TRADITION', raga.tradition),
    GSI3SK: formatKey(EntityPrefix.RAGA, id),
  }),
});

export class RagaRepository {
  static async create(input: CreateRagaInput): Promise<Raga> {
    const baseItem = await createBaseItem(EntityPrefix.RAGA);
    const timestamp = getCurrentISOString();

    const normalizedInput = {
      ...input,
      name: normalizeRagaName(input.name),
    };

    const ragaItem: RagaDynamoItem = {
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

    await putItem(ragaItem);
    return ragaSchema.parse(ragaItem);
  }

  static async getById(id: string): Promise<Raga | null> {
    return getByPrimaryKey<RagaDynamoItem>(EntityPrefix.RAGA, id, SecondaryPrefix.METADATA);
  }

  static async update(id: string, input: UpdateRagaInput): Promise<Raga> {
    const current = await RagaRepository.getById(id);
    if (!current) {
      throw new ApplicationError(ErrorCode.RAGA_NOT_FOUND, `Raga ${id} not found`);
    }

    const normalizedInput = {
      ...input,
      ...(input.name ? { name: normalizeRagaName(input.name) } : {}),
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
        PK: formatKey(EntityPrefix.RAGA, id),
        SK: SecondaryPrefix.METADATA,
      },
      updates
    );

    return RagaRepository.getById(id) as Promise<Raga>;
  }

  static async getByName(name: string): Promise<Raga | null> {
    const result = await getByGlobalIndex<RagaDynamoItem>(
      'GSI1',
      'GSI1PK',
      formatIndexKey('RAGA_NAME', name.toLowerCase()),
      { limit: 1 }
    );

    if (result.items.length === 0) {
      // Try with normalized name
      const normalizedResults = await getByGlobalIndex<RagaDynamoItem>(
        'GSI1',
        'GSI1PK',
        formatIndexKey('RAGA_NAME', normalizeRagaName(name).toLowerCase()),
        { limit: 1 }
      );
      if (normalizedResults.items.length === 0) return null;
      return ragaSchema.parse(normalizedResults.items[0]);
    }

    return ragaSchema.parse(result.items[0]);
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

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
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

    return createPaginatedResponse(result.items, result.lastEvaluatedKey);
  }

  static async search(name: string, limit = 20): Promise<RagaSearchResult> {
    const result = await query<RagaDynamoItem>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':pk': formatIndexKey('RAGA_NAME', name.toLowerCase()),
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
          PK: formatKey(EntityPrefix.RAGA, id),
          SK: SecondaryPrefix.METADATA,
        },
        UpdateExpression: 'ADD viewCount :increment',
        ExpressionAttributeValues: {
          ':increment': 1,
        },
      })
    );
  }

  static async searchRagas(params: RagaSearchParams): Promise<RagaSearchResult> {
    if (params.query) {
      return RagaRepository.search(params.query, params.limit);
    }

    if (params.melakarta) {
      return RagaRepository.getByMelakarta(params.melakarta, params.limit, params.nextToken);
    }

    if (params.tradition) {
      return RagaRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    return { items: [], hasMore: false };
  }
}

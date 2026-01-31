import { ApplicationError, ErrorCode } from '../../constants';
import { generateId } from '../../utils';
import { ChangeHistoryEntity } from './entity';
import type { ChangeHistory } from './entity';
import type { ChangeEntityType, ChangeHistoryInput } from './types';

export type { ChangeHistory };

export async function createChangeHistory(input: ChangeHistoryInput): Promise<ChangeHistory> {
  const result = await ChangeHistoryEntity.create({
    id: generateId(),
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    action: input.action,
    diff: input.diff as unknown as ChangeHistory['diff'],
    comment: input.comment,
    timestamp: Date.now(),
  }).go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Failed to create change history entry');
  }

  return result.data;
}

export async function getChangeHistory(
  entityType: ChangeEntityType,
  entityId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: ChangeHistory[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await ChangeHistoryEntity.query.primary({ entityType, entityId }).go({
    limit,
    cursor: params?.nextToken,
    order: 'desc',
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getChangeHistoryById(
  _entityType: ChangeEntityType,
  _entityId: string,
  _id: string
): Promise<ChangeHistory | null> {
  return null;
}

export async function getUserChanges(
  userId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: ChangeHistory[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await ChangeHistoryEntity.query.byUser({ userId }).go({
    limit,
    cursor: params?.nextToken,
    order: 'desc',
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getEntityStateAtTimestamp(
  entityType: ChangeEntityType,
  entityId: string,
  targetTimestamp: number
): Promise<{ change: ChangeHistory; stateBefore: Record<string, unknown> } | null> {
  const result = await ChangeHistoryEntity.query
    .primary({ entityType, entityId })
    .go({ limit: 1000, order: 'desc' });

  const changes = result.data || [];
  const relevantChanges = changes.filter(c => c.timestamp <= targetTimestamp);

  if (relevantChanges.length === 0) {
    return null;
  }

  const targetChange = relevantChanges[relevantChanges.length - 1];

  const state: Record<string, unknown> = {};

  for (const change of relevantChanges) {
    if (change.action === 'update') {
      for (const fieldChange of change.diff) {
        state[fieldChange.field] = fieldChange.oldValue;
      }
    } else if (change.action === 'create') {
      for (const fieldChange of change.diff) {
        state[fieldChange.field] = fieldChange.newValue;
      }
    }
  }

  return { change: targetChange, stateBefore: state };
}

export async function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): Promise<Array<{ field: string; oldValue?: unknown; newValue?: unknown }>> {
  const diff: Array<{ field: string; oldValue?: unknown; newValue?: unknown }> = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before?.[key];
    const afterValue = after[key];

    if (beforeValue !== afterValue) {
      diff.push({
        field: key,
        oldValue: beforeValue,
        newValue: afterValue,
      });
    }
  }

  return diff;
}

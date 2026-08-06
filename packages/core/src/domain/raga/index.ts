import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { z } from 'zod';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { generateId } from '../../utils';
import { cascadeRagaMerge, cascadeRagaNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { RagaEntity } from './entity';
import type { Raga } from './entity';
import type { CreateRagaSchema, UpdateRagaSchema } from './schema';

export type CreateRagaInput = z.infer<typeof CreateRagaSchema>;
export type UpdateRagaInput = z.infer<typeof UpdateRagaSchema>;

export async function createRaga(input: CreateRagaInput): Promise<Raga> {
  const id = generateId();
  const result = await RagaEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('raga', input.name);
  }

  return result.data as Raga;
}

export async function getRaga(id: string): Promise<Raga | null> {
  const result = await RagaEntity.get({ id }).go();
  if (!result.data) {
    return null;
  }
  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }
  return result.data as Raga;
}

export async function getRagaByName(name: string): Promise<Raga | null> {
  const result = await RagaEntity.query.byName({ name }).go();
  return (result.data?.[0] as Raga) || null;
}

export async function updateRaga(id: string, input: UpdateRagaInput): Promise<Raga> {
  const result = await RagaEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('raga', id);
  }

  if (input.name) {
    await cascadeRagaNameUpdate(id, input.name);
  }

  return result.data as Raga;
}

export async function deleteRaga(id: string): Promise<void> {
  await RagaEntity.delete({ id }).go();
}

export async function softDeleteRaga(id: string): Promise<void> {
  await RagaEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listRagas(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Raga[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval
  const result = await RagaEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getRagasByMelaNumber(
  melaNumber: number,
  excludeId?: string
): Promise<Raga[]> {
  const result = await RagaEntity.query
    .list({})
    .where((attr, op) => op.eq(attr.melaNumber, melaNumber))
    .go({ limit: 50 });

  return (result.data || []).filter(r => !r.deletedAt && r.id !== excludeId) as Raga[];
}

export async function mergeRaga(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getRaga(canonicalId);
  if (!canonical) throw notFoundError('raga', canonicalId);
  const loser = await RagaEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('raga', loserId);

  await cascadeRagaMerge(loserId, canonicalId, canonical.name);
  await RagaEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();
}

export async function getRagaMergeScore(id: string): Promise<number> {
  const { CompositionRagaEntity } = await import('../composition_raga/entity');

  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId: id })
    .go({ attributes: ['compositionId'] as never[] });

  return (result.data || []).length;
}

export async function adjustPerformanceCount(ragaId: string, delta: number): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      // ElectroDB lowercases composite key values, so the key must be derived from
      // the entity rather than hand-built in uppercase, or this writes a phantom row.
      Key: keyOfEntity(RagaEntity, { id: ragaId }),
      UpdateExpression: 'ADD performanceCount :delta',
      ExpressionAttributeValues: { ':delta': delta },
    })
  );
}

export type { Raga } from './entity';
// Matching keys for the dedup CLI in packages/scripts, which cannot host its own
// tests — keeping them here is what makes the matching testable.
export { ragaExactKey, ragaVariantKey } from './dedup';
// The 72-melakarta generating rules, shared by the chakra widget and the script
// that resolves the canonical melakarta records in the database.
export {
  CHAKRA_NAMES,
  chakraNameOfMela,
  chakraOfMela,
  melakartaScale,
  positionOfMela,
} from './melakarta';
export type { ChakraName } from './melakarta';
export { CreateRagaSchema, UpdateRagaSchema } from './schema';

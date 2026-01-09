import { generateId } from '../../utils';
import { CompositionRagaEntity } from './entity';
import type { CompositionRaga } from './entity';
import type { z } from 'zod';
import type { CreateCompositionRagaSchema } from './schema';

export type CreateCompositionRagaInput = z.infer<typeof CreateCompositionRagaSchema>;

export async function createCompositionRaga(
  input: CreateCompositionRagaInput
): Promise<CompositionRaga> {
  const result = await CompositionRagaEntity.create(input).go();

  if (!result.data) {
    throw new Error(`Failed to create composition-raga relationship: ${JSON.stringify(input)}`);
  }

  return result.data as CompositionRaga;
}

export async function getCompositionRagas(compositionId: string): Promise<CompositionRaga[]> {
  const result = await CompositionRagaEntity.query.primary({ compositionId }).go();
  return result.data || [];
}

export async function getCompositionsByRaga(ragaId: string): Promise<CompositionRaga[]> {
  const result = await CompositionRagaEntity.query.byRaga({ ragaId }).go();
  return result.data || [];
}

export async function deleteCompositionRaga(compositionId: string, ragaId: string): Promise<void> {
  await CompositionRagaEntity.delete({ compositionId, ragaId }).go();
}

export type { CompositionRaga } from './entity';
export { CreateCompositionRagaSchema } from './schema';

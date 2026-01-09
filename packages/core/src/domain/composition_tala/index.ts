import { generateId } from '../../utils';
import { CompositionTalaEntity } from './entity';
import type { CompositionTala } from './entity';
import type { z } from 'zod';
import type { CreateCompositionTalaSchema } from './schema';

export type CreateCompositionTalaInput = z.infer<typeof CreateCompositionTalaSchema>;

export async function createCompositionTala(
  input: CreateCompositionTalaInput
): Promise<CompositionTala> {
  const result = await CompositionTalaEntity.create(input).go();

  if (!result.data) {
    throw new Error(`Failed to create composition-tala relationship: ${JSON.stringify(input)}`);
  }

  return result.data as CompositionTala;
}

export async function getCompositionTalas(compositionId: string): Promise<CompositionTala[]> {
  const result = await CompositionTalaEntity.query.primary({ compositionId }).go();
  return result.data || [];
}

export async function getCompositionsByTala(talaId: string): Promise<CompositionTala[]> {
  const result = await CompositionTalaEntity.query.byTala({ talaId }).go();
  return result.data || [];
}

export async function deleteCompositionTala(compositionId: string, talaId: string): Promise<void> {
  await CompositionTalaEntity.delete({ compositionId, talaId }).go();
}

export type { CompositionTala } from './entity';
export { CreateCompositionTalaSchema } from './schema';

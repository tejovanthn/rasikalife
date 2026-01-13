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

export async function getCompositionTalas(
  compositionId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionTala[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await CompositionTalaEntity.query.primary({ compositionId }).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getCompositionsByTala(
  talaId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionTala[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await CompositionTalaEntity.query.byTala({ talaId }).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function deleteCompositionTala(compositionId: string, talaId: string): Promise<void> {
  await CompositionTalaEntity.delete({ compositionId, talaId }).go();
}

export type { CompositionTala } from './entity';
export { CreateCompositionTalaSchema } from './schema';

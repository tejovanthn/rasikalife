import { generateId } from '../../utils';
import { RagaEntity } from './entity';
import type { Raga } from './entity';
import type { z } from 'zod';
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
    throw new Error(`Failed to create raga: ${JSON.stringify(input)}`);
  }

  return result.data as Raga;
}

export async function getRaga(id: string): Promise<Raga | null> {
  const result = await RagaEntity.get({ id }).go();
  return result.data || null;
}

export async function getRagaByName(name: string): Promise<Raga | null> {
  const result = await RagaEntity.query.byName({ name }).go();
  return (result.data?.[0] as Raga) || null;
}

export async function updateRaga(id: string, input: UpdateRagaInput): Promise<Raga> {
  const result = await RagaEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw new Error(`Raga ${id} not found or update failed`);
  }

  return result.data as Raga;
}

export async function deleteRaga(id: string): Promise<void> {
  await RagaEntity.delete({ id }).go();
}

export async function listRagas(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Raga[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval
  const result = await RagaEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { Raga } from './entity';
export { CreateRagaSchema, UpdateRagaSchema } from './schema';

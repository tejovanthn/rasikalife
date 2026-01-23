import { ApplicationError, ErrorCode } from '@rasika/core';
import type { z } from 'zod';
import { generateId } from '../../utils';
import { TalaEntity } from './entity';
import type { Tala } from './entity';
import type { CreateTalaSchema, UpdateTalaSchema } from './schema';

export type CreateTalaInput = z.infer<typeof CreateTalaSchema>;
export type UpdateTalaInput = z.infer<typeof UpdateTalaSchema>;

export async function createTala(input: CreateTalaInput): Promise<Tala> {
  const id = generateId();
  const result = await TalaEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw new Error(`Failed to create tala: ${JSON.stringify(input)}`);
  }

  return result.data as Tala;
}

export async function getTala(id: string): Promise<Tala | null> {
  const result = await TalaEntity.get({ id }).go();
  if (!result.data) {
    return null;
  }
  return result.data as Tala;
}

export async function getTalaByName(name: string): Promise<Tala | null> {
  const result = await TalaEntity.query.byName({ name }).go();
  return (result.data?.[0] as Tala) || null;
}

export async function updateTala(id: string, input: UpdateTalaInput): Promise<Tala> {
  const result = await TalaEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw new Error(`Tala ${id} not found or update failed`);
  }

  return result.data as Tala;
}

export async function deleteTala(id: string): Promise<void> {
  await TalaEntity.delete({ id }).go();
}

export async function listTalas(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Tala[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval
  const result = await TalaEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { Tala } from './entity';
export { CreateTalaSchema, UpdateTalaSchema } from './schema';

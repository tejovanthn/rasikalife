import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeTalaNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
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
    throw createFailedError('tala', input.name);
  }

  return result.data as Tala;
}

export async function getTala(id: string): Promise<Tala | null> {
  const result = await TalaEntity.get({ id }).go();
  if (!result.data) {
    return null;
  }
  if (result.data.deletedAt) {
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
    throw notFoundError('tala', id);
  }

  if (input.name) {
    await cascadeTalaNameUpdate(id, input.name);
  }

  return result.data as Tala;
}

export async function deleteTala(id: string): Promise<void> {
  await TalaEntity.delete({ id }).go();
}

export async function softDeleteTala(id: string): Promise<void> {
  await TalaEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listTalas(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Tala[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await TalaEntity.query
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

export type { Tala } from './entity';
export { CreateTalaSchema, UpdateTalaSchema } from './schema';

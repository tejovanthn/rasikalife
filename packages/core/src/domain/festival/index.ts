import type { z } from 'zod';
import { generateId } from '../../utils';
import { createFailedError, notFoundError } from '../helpers';
import { FestivalEntity } from './entity';
import type { Festival } from './entity';
import type { CreateFestivalSchema, UpdateFestivalSchema } from './schema';

export type CreateFestivalInput = z.infer<typeof CreateFestivalSchema>;
export type UpdateFestivalInput = z.infer<typeof UpdateFestivalSchema>;

export async function createFestival(
  input: CreateFestivalInput,
  userId: string
): Promise<Festival> {
  const id = generateId();
  const result = await FestivalEntity.create({
    id,
    ...input,
    status: 'draft',
    createdBy: userId,
  }).go();

  if (!result.data) {
    throw createFailedError('festival', input.name);
  }

  return result.data as Festival;
}

export async function getFestival(id: string): Promise<Festival | null> {
  const result = await FestivalEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  return result.data as Festival;
}

export async function updateFestival(id: string, input: UpdateFestivalInput): Promise<Festival> {
  const result = await FestivalEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('festival', id);
  }

  return result.data as Festival;
}

export async function submitFestival(id: string): Promise<Festival> {
  const existing = await getFestival(id);
  if (!existing) {
    throw notFoundError('festival', id);
  }
  if (existing.status !== 'draft') {
    throw createFailedError('festival', `Festival ${id} is not a draft`);
  }

  const result = await FestivalEntity.update({ id })
    .set({
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    })
    .go({ response: 'all_new' });

  return result.data as Festival;
}

export async function approveFestival(id: string, moderatorId?: string): Promise<Festival> {
  const update: Record<string, string> = {
    status: 'approved',
    processedAt: new Date().toISOString(),
  };
  if (moderatorId) {
    update.moderatorId = moderatorId;
  }
  const result = await FestivalEntity.update({ id }).set(update).go({ response: 'all_new' });
  return result.data as Festival;
}

export async function deleteFestival(id: string): Promise<void> {
  await FestivalEntity.delete({ id }).go();
}

export async function listApprovedFestivalsByMonth(yearMonth: string): Promise<Festival[]> {
  const all: Festival[] = [];
  let cursor: string | undefined;
  do {
    const result = await FestivalEntity.query
      .byStatus({ status: 'approved' })
      .begins({ startDate: yearMonth })
      .go({ limit: 100, cursor });
    all.push(...((result.data || []) as Festival[]));
    cursor = result.cursor || undefined;
  } while (cursor);
  return all;
}

export async function listFestivals(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Festival[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await FestivalEntity.query
    .byStatus({ status: 'approved' })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data || []) as Festival[],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { Festival } from './entity';
export { CreateFestivalSchema, UpdateFestivalSchema } from './schema';

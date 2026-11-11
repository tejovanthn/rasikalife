import type { z } from 'zod';
import { generateId } from '../../utils';
import { EventEntity } from '../event/entity';
import { createFailedError, notFoundError } from '../helpers';
import { findSimilarFestivals } from './duplicates';
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
    all.push(...((result.data || []) as Festival[]).filter(f => !f.deletedAt));
    cursor = result.cursor || undefined;
  } while (cursor);
  return all;
}

export async function listUpcomingFestivals(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: Festival[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const result = await FestivalEntity.query
    .byStatus({ status: 'approved' })
    .gte({ startDate: cutoffDate })
    .go({ limit: 200, cursor: params?.nextToken });

  const upcoming = ((result.data || []) as Festival[]).filter(
    f => f.endDate >= today && !f.deletedAt
  );
  const page = upcoming.slice(0, limit);

  return {
    items: page,
    nextToken: upcoming.length > limit ? result.cursor || undefined : undefined,
    hasMore: upcoming.length > limit,
  };
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
    // A merged festival is gone from the list; its URL redirects.
    items: ((result.data || []) as Festival[]).filter(f => !f.deletedAt),
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

/**
 * Approved and submitted festivals that look like the one being created (see
 * `findSimilarFestivals`). Reads both status partitions over the dates that can overlap: a
 * festival starting up to 60 days before this one's start and no later than its end.
 */
export async function findSimilarFestivalsFor(target: {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}): Promise<Festival[]> {
  const from = new Date(Date.parse(`${target.startDate.slice(0, 10)}T00:00:00Z`) - 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const to = `${target.endDate.slice(0, 10)}~`;
  const found = await Promise.all(
    (['approved', 'submitted'] as const).map(status =>
      FestivalEntity.query
        .byStatus({ status })
        .between({ startDate: from }, { startDate: to })
        .go({ limit: 200 })
    )
  );
  return findSimilarFestivals(
    found.flatMap(r => (r.data || []) as Festival[]),
    target
  );
}

const isBlank = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

/**
 * Retire `loserId` into `keeperId`: every event of the loser moves to the keeper (festivalId and
 * festivalName, through `patch` so the `byFestival` key is recomputed, rule 7), the keeper's
 * blank fields are filled from the loser and its date range widens to cover the moved events,
 * and the loser is soft-deleted with `mergedIntoId`, which the festival route turns into a 301.
 * Nothing is deleted. Returns how many events moved.
 */
export async function mergeFestival(loserId: string, keeperId: string): Promise<number> {
  if (loserId === keeperId) throw createFailedError('festival', 'cannot merge into itself');
  const keeper = await getFestival(keeperId);
  if (!keeper || keeper.deletedAt) throw notFoundError('festival', keeperId);
  const loser = await getFestival(loserId);
  if (!loser) throw notFoundError('festival', loserId);
  if (loser.deletedAt || loser.mergedIntoId) {
    throw createFailedError('festival', `Festival ${loserId} is already deleted or merged`);
  }
  if (loser.status === 'approved' && keeper.status !== 'approved') {
    throw createFailedError(
      'festival',
      `Festival ${keeperId} is not approved; merging a live festival into it would break the live URL`
    );
  }

  let moved = 0;
  let cursor: string | undefined;
  do {
    const page = await EventEntity.query
      .byFestival({ festivalId: loserId })
      .go({ limit: 100, cursor });
    for (const event of page.data || []) {
      await EventEntity.patch({ id: event.id })
        .set({ festivalId: keeperId, festivalName: keeper.name })
        .go();
      moved++;
    }
    cursor = page.cursor || undefined;
  } while (cursor);

  const patch: Record<string, unknown> = {};
  for (const field of ['description', 'posterUrl', 'posterUploadId', 'tags', 'sponsors'] as const) {
    if (isBlank(keeper[field]) && !isBlank(loser[field])) patch[field] = loser[field];
  }
  if (isBlank(keeper.organiserId) && !isBlank(loser.organiserId)) {
    patch.organiserId = loser.organiserId;
    if (!isBlank(loser.organiserName)) patch.organiserName = loser.organiserName;
  }
  if (loser.startDate < keeper.startDate) patch.startDate = loser.startDate;
  if (loser.endDate > keeper.endDate) patch.endDate = loser.endDate;
  if (Object.keys(patch).length > 0) {
    await FestivalEntity.patch({ id: keeperId })
      .set(patch as never)
      .go();
  }

  await FestivalEntity.patch({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: keeperId })
    .go();
  return moved;
}

/** Approved and submitted festivals not yet over on `fromDate` (YYYY-MM-DD), for the sweep. */
export async function listFestivalsForDuplicateSweep(fromDate: string): Promise<Festival[]> {
  const all: Festival[] = [];
  for (const status of ['approved', 'submitted'] as const) {
    let cursor: string | undefined;
    do {
      const result = await FestivalEntity.query.byStatus({ status }).go({ limit: 200, cursor });
      all.push(...((result.data || []) as Festival[]));
      cursor = result.cursor || undefined;
    } while (cursor);
  }
  return all.filter(f => f.endDate.slice(0, 10) >= fromDate && !f.deletedAt);
}

/** A draft festival the submitter replaced with an existing one. Drafts only. */
export async function retireDraftFestival(id: string, intoId: string): Promise<void> {
  const festival = await getFestival(id);
  if (!festival || festival.status !== 'draft' || festival.deletedAt) return;
  await FestivalEntity.patch({ id })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: intoId })
    .go();
}

export { findSimilarFestivals, suggestFestivalKeeper } from './duplicates';
export type { Festival } from './entity';
export { CreateFestivalSchema, UpdateFestivalSchema } from './schema';

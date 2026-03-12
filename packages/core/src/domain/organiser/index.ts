import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeOrganiserMerge, cascadeOrganiserNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { OrganiserEntity } from './entity';
import type { Organiser } from './entity';
import type { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

export type CreateOrganiserInput = z.infer<typeof CreateOrganiserSchema>;
export type UpdateOrganiserInput = z.infer<typeof UpdateOrganiserSchema>;

export async function createOrganiser(input: CreateOrganiserInput): Promise<Organiser> {
  const id = generateId();
  const result = await OrganiserEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('organiser', input.name);
  }

  return result.data as Organiser;
}

export async function getOrganiser(id: string): Promise<Organiser | null> {
  const result = await OrganiserEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Organiser;
}

export async function getOrganiserByName(name: string): Promise<Organiser | null> {
  const result = await OrganiserEntity.query.byName({ name }).go();
  const organiser = result.data?.[0];
  if (!organiser) return null;
  if (organiser.deletedAt && !organiser.mergedIntoId) return null;
  if (organiser.mergedIntoId) return getOrganiser(organiser.mergedIntoId);
  return organiser as Organiser;
}

export async function updateOrganiser(id: string, input: UpdateOrganiserInput): Promise<Organiser> {
  const current = await getOrganiser(id);

  const result = await OrganiserEntity.update({ id }).set(input).go({ response: 'all_new' });

  if (!result.data) {
    throw notFoundError('organiser', id);
  }

  if (input.name && current && input.name !== current.name) {
    await cascadeOrganiserNameUpdate(id, input.name);
  }

  return result.data as Organiser;
}

export async function deleteOrganiser(id: string): Promise<void> {
  await OrganiserEntity.delete({ id }).go();
}

export async function softDeleteOrganiser(id: string): Promise<void> {
  await OrganiserEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listOrganisers(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{
  items: Organiser[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await OrganiserEntity.query
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

export async function listOrganisersByCity(city: string): Promise<Organiser[]> {
  const result = await OrganiserEntity.query
    .byCity({ city })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ pages: 'all' });

  return result.data || [];
}

export async function mergeOrganiser(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getOrganiser(canonicalId);
  if (!canonical) throw notFoundError('organiser', canonicalId);
  const loser = await OrganiserEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('organiser', loserId);

  await cascadeOrganiserMerge(loserId, canonicalId, canonical.name);
  await OrganiserEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();

  const loserName = loser.data.name;
  const existing = (canonical.alternateNames || []) as string[];
  if (!existing.includes(loserName)) {
    await OrganiserEntity.update({ id: canonicalId })
      .set({ alternateNames: [...existing, loserName] })
      .go();
  }
}

export async function getOrganiserMergeScore(id: string): Promise<number> {
  const { EventEntity } = await import('../event/entity');

  const [eventResult, organiserResult] = await Promise.all([
    EventEntity.query.byOrganiser({ organiserId: id }).go({ attributes: ['id'] as never[] }),
    OrganiserEntity.get({ id }).go(),
  ]);

  let score = (eventResult.data || []).length;
  if (organiserResult.data) {
    if (organiserResult.data.description) score += 2;
    if (organiserResult.data.city) score += 1;
    if (organiserResult.data.address) score += 1;
    if (organiserResult.data.logoUrl) score += 1;
    if (organiserResult.data.tags && (organiserResult.data.tags as string[]).length > 0) score += 1;
    if (organiserResult.data.venueId) score += 1;
  }
  return score;
}

export type { Organiser } from './entity';
export { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

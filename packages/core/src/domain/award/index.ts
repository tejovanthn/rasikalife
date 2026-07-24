import type { z } from 'zod';
import { generateId } from '../../utils';
import { createFailedError, notFoundError } from '../helpers';
import { AwardEntity } from './entity';
import type { Award } from './entity';
import type { CreateAwardSchema, UpdateAwardSchema } from './schema';

export type CreateAwardInput = z.infer<typeof CreateAwardSchema>;
export type UpdateAwardInput = z.infer<typeof UpdateAwardSchema>;

export async function createAward(input: CreateAwardInput): Promise<Award> {
  const id = generateId();
  const result = await AwardEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('award', input.name);
  }

  return result.data as Award;
}

export async function getAward(id: string): Promise<Award | null> {
  const result = await AwardEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Award;
}

export async function getAwardByName(name: string): Promise<Award | null> {
  const result = await AwardEntity.query.byName({ name }).go();
  // Skip soft-deleted rows, like getArtistByName. Returning data[0] blindly let
  // resolveOrCreate see a tombstone, decide the name was taken by a deleted
  // award, and mint a duplicate active one beside the real match.
  return result.data?.find(award => !award.deletedAt) || null;
}

export async function updateAward(id: string, input: UpdateAwardInput): Promise<Award> {
  const result = await AwardEntity.update({ id }).set(input).go({ response: 'all_new' });

  if (!result.data) {
    throw notFoundError('award', id);
  }

  return result.data as Award;
}

export async function softDeleteAward(id: string): Promise<void> {
  await AwardEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listAwards(): Promise<Award[]> {
  const result = await AwardEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ pages: 'all' });

  const items = result.data || [];
  return items.sort((a, b) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });
}

export async function listAwardsByOrganiser(organiserId: string): Promise<Award[]> {
  const result = await AwardEntity.query
    .list({})
    .where((attr, op) => op.eq(attr.issuingOrganisationId, organiserId))
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ pages: 'all' });

  return result.data || [];
}

export async function mergeAward(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getAward(canonicalId);
  if (!canonical) throw notFoundError('award', canonicalId);
  const loser = await AwardEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('award', loserId);

  await AwardEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();
}

export type { Award } from './entity';
export { CreateAwardSchema, UpdateAwardSchema } from './schema';

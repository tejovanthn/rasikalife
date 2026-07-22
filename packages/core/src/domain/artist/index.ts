import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeArtistMerge, cascadeArtistNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('artist', input.name);
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist | null> {
  const result = await ArtistEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Artist;
}

export async function getArtistByName(name: string): Promise<Artist | null> {
  const result = await ArtistEntity.query.byName({ name }).go();
  const artist = result.data?.[0];
  if (!artist) return null;
  if (artist.deletedAt && !artist.mergedIntoId) return null;
  if (artist.mergedIntoId) return getArtist(artist.mergedIntoId);
  return artist as Artist;
}

export async function updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  if (input.name) {
    await cascadeArtistNameUpdate(id, input.name);
  }

  return result.data as Artist;
}

export async function softDeleteArtist(id: string): Promise<void> {
  await ArtistEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listArtists(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await ArtistEntity.query
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

export async function mergeArtist(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getArtist(canonicalId);
  if (!canonical) throw notFoundError('artist', canonicalId);
  const loser = await ArtistEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('artist', loserId);

  await cascadeArtistMerge(loserId, canonicalId, canonical.name);
  await ArtistEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();

  const loserName = loser.data.name;
  const existing = (canonical.alternateNames || []) as string[];
  if (!existing.includes(loserName)) {
    await ArtistEntity.update({ id: canonicalId })
      .set({ alternateNames: [...existing, loserName] })
      .go();
  }
}

export async function getArtistMergeScore(id: string): Promise<number> {
  const { EventArtistEntity } = await import('../event-artist/entity');
  const { CompositionEntity } = await import('../composition/entity');

  const [eventResult, compResult, artist] = await Promise.all([
    EventArtistEntity.query.byArtist({ artistId: id }).go({ attributes: ['artistId'] as never[] }),
    CompositionEntity.query.byComposer({ composerId: id }).go({ attributes: ['id'] as never[] }),
    ArtistEntity.get({ id }).go(),
  ]);

  let score = (eventResult.data || []).length + (compResult.data || []).length;
  if (artist.data) {
    if (artist.data.title) score += 1;
    if (artist.data.gurus && artist.data.gurus.length > 0) score += 1;
    if (artist.data.biography) score += 2;
    if (artist.data.specialisations && artist.data.specialisations.length > 0) score += 1;
    if (artist.data.birthYear) score += 1;
  }
  return score;
}

export type { Artist } from './entity';
export { CreateArtistSchema, UpdateArtistSchema } from './schema';
export {
  artistNameSimilarity,
  findArtistMatch,
  findOrCreateArtist,
  initialsMatch,
  listAllArtistsForMatching,
  normalizeArtistName,
} from './dedup';

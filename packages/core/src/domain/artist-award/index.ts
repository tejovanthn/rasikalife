import type { z } from 'zod';
import { ArtistAwardEntity } from './entity';
import type { ArtistAward } from './entity';
import type { AddArtistAwardSchema } from './schema';

export type AddArtistAwardInput = z.infer<typeof AddArtistAwardSchema>;

export async function addArtistAward(input: AddArtistAwardInput): Promise<ArtistAward> {
  const result = await ArtistAwardEntity.create(input).go();
  return result.data as ArtistAward;
}

export async function removeArtistAward(artistId: string, awardId: string): Promise<void> {
  await ArtistAwardEntity.delete({ artistId, awardId }).go();
}

export async function getArtistAwards(artistId: string): Promise<ArtistAward[]> {
  const result = await ArtistAwardEntity.query.primary({ artistId }).go({ pages: 'all' });
  const items = result.data || [];
  return items.sort((a, b) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });
}

export async function getAwardRecipients(awardId: string): Promise<ArtistAward[]> {
  const result = await ArtistAwardEntity.query.byAward({ awardId }).go({ pages: 'all' });
  const items = result.data || [];
  return items.sort((a, b) => {
    const yearA = a.year ?? 0;
    const yearB = b.year ?? 0;
    return yearA - yearB;
  });
}

export type { ArtistAward } from './entity';
export { AddArtistAwardSchema } from './schema';

import type { z } from 'zod';
import { generateId } from '../../utils';
import { ArtistPhotoEntity } from './entity';
import type { ArtistPhoto } from './entity';
import type { AddArtistPhotoSchema, UpdateArtistPhotoSchema } from './schema';

export type AddArtistPhotoInput = z.infer<typeof AddArtistPhotoSchema>;
export type UpdateArtistPhotoInput = z.infer<typeof UpdateArtistPhotoSchema>;

export async function addArtistPhoto(input: AddArtistPhotoInput): Promise<ArtistPhoto> {
  const id = generateId();
  const result = await ArtistPhotoEntity.create({
    id,
    artistId: input.artistId,
    imageUrl: input.imageUrl,
    uploadId: input.uploadId,
    caption: input.caption,
    credit: input.credit,
    order: input.order ?? 0,
    featured: input.featured ?? false,
    createdBy: input.createdBy,
  }).go();
  return result.data as ArtistPhoto;
}

export async function updateArtistPhoto(
  artistId: string,
  id: string,
  patch: UpdateArtistPhotoInput
): Promise<ArtistPhoto> {
  // `order` is watched by `orderStr` on the entity, so including it here (whenever the
  // caller changes it) recomputes the byArtist GSI sort key automatically.
  const result = await ArtistPhotoEntity.patch({ artistId, id })
    .set(patch)
    .go({ response: 'all_new' });
  return result.data as ArtistPhoto;
}

export async function deleteArtistPhoto(artistId: string, id: string): Promise<void> {
  await ArtistPhotoEntity.delete({ artistId, id }).go();
}

export async function listArtistPhotos(
  artistId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: ArtistPhoto[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;

  const result = await ArtistPhotoEntity.query
    .byArtist({ artistId })
    .go({ order: 'asc', limit, cursor: params?.nextToken });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { ArtistPhoto } from './entity';
export { AddArtistPhotoSchema, UpdateArtistPhotoSchema } from './schema';

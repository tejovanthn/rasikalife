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

// Optional text fields a caller may want to empty rather than change.
const CLEARABLE_FIELDS = ['caption', 'credit'] as const;

export async function updateArtistPhoto(
  artistId: string,
  id: string,
  patch: UpdateArtistPhotoInput
): Promise<ArtistPhoto> {
  // An empty string means "clear this field". Writing it as `''` would work — DynamoDB accepts
  // empty strings — but the row would then say the caption exists and is blank, so anything
  // testing `caption !== undefined` disagrees with what the page renders. Remove the attribute
  // instead, which is what "no caption" actually is.
  const cleared = CLEARABLE_FIELDS.filter(field => patch[field] === '');
  const changed = { ...patch };
  for (const field of cleared) delete changed[field];

  // `order` is watched by `orderStr` on the entity, so including it here (whenever the
  // caller changes it) recomputes the byArtist GSI sort key automatically.
  const operation = ArtistPhotoEntity.patch({ artistId, id }).set(changed);
  const result = await (cleared.length > 0 ? operation.remove([...cleared]) : operation).go({
    response: 'all_new',
  });
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
export { AddArtistPhotoSchema, MAX_PHOTO_ORDER, UpdateArtistPhotoSchema } from './schema';

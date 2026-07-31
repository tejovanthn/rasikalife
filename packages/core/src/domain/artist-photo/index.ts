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
    width: input.width,
    height: input.height,
    caption: input.caption,
    // Absent means yes: a photo with nobody named is the artist's own courtesy.
    courtesyArtist: input.courtesyArtist ?? true,
    photographerId: input.photographerId,
    photographerName: input.photographerName,
    order: input.order ?? 0,
    featured: input.featured ?? false,
    createdBy: input.createdBy,
  }).go();
  return result.data as ArtistPhoto;
}

// Optional text fields a caller may want to empty rather than change.
const CLEARABLE_FIELDS = ['caption', 'photographerId', 'photographerName'] as const;

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

/**
 * Records a photograph's pixel dimensions.
 *
 * Its own function rather than fields on `UpdateArtistPhotoSchema`, and deliberately so: the
 * dimensions are a property of the file, not metadata anyone should be able to type. Putting
 * them in the update schema would let a moderator form or a CSV import claim a portrait is
 * landscape, and the masonry grid and the profile hero both lay out from these numbers.
 *
 * Written by the upload path, which knows them, and by `backfill-photo-dimensions`, which
 * measures them for the rows uploaded before that path existed.
 */
export async function setArtistPhotoDimensions(
  artistId: string,
  id: string,
  size: { width: number; height: number }
): Promise<void> {
  await ArtistPhotoEntity.patch({ artistId, id }).set(size).go();
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

// The entity itself, for the rare caller that needs a scan the domain functions do not expose —
// today the dimensions backfill, which walks every row rather than one artist's. Same shape as
// artist-affiliation's export.
export { ArtistPhotoEntity } from './entity';
export type { ArtistPhoto } from './entity';
export { AddArtistPhotoSchema, MAX_PHOTO_ORDER, UpdateArtistPhotoSchema } from './schema';

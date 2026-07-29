import type { z } from 'zod';
import { generateId } from '../../utils';
import { ArtistMediaEntity } from './entity';
import type { ArtistMedia } from './entity';
import type { AddArtistMediaSchema, UpdateArtistMediaSchema } from './schema';
import { sortArtistMedia } from './sort';

export type AddArtistMediaInput = z.infer<typeof AddArtistMediaSchema>;
export type UpdateArtistMediaInput = z.infer<typeof UpdateArtistMediaSchema>;

/** Optional text fields a caller may want to empty rather than change. */
const CLEARABLE_FIELDS = ['outlet', 'publishedOn', 'imageUrl', 'uploadId'] as const;

export async function addArtistMedia(input: AddArtistMediaInput): Promise<ArtistMedia> {
  const id = generateId();
  const result = await ArtistMediaEntity.create({
    id,
    artistId: input.artistId,
    title: input.title,
    url: input.url,
    mediaType: input.mediaType,
    outlet: input.outlet,
    publishedOn: input.publishedOn,
    imageUrl: input.imageUrl,
    uploadId: input.uploadId,
    createdBy: input.createdBy,
  }).go();
  return result.data as ArtistMedia;
}

export async function updateArtistMedia(
  artistId: string,
  id: string,
  patch: UpdateArtistMediaInput
): Promise<ArtistMedia> {
  // An empty string means "clear this field", the same contract updateArtistPhoto uses.
  // Writing `''` would leave the row saying the outlet exists and is blank, so anything
  // testing `outlet !== undefined` would disagree with what the page renders.
  const cleared = CLEARABLE_FIELDS.filter(field => patch[field] === '');
  const changed = { ...patch };
  for (const field of cleared) delete changed[field];

  const operation = ArtistMediaEntity.patch({ artistId, id }).set(changed);
  const result = await (cleared.length > 0 ? operation.remove([...cleared]) : operation).go({
    response: 'all_new',
  });
  return result.data as ArtistMedia;
}

export async function deleteArtistMedia(artistId: string, id: string): Promise<void> {
  await ArtistMediaEntity.delete({ artistId, id }).go();
}

/**
 * Newest coverage first, with undated items last rather than jumbled among the dated ones.
 *
 * Sorted here rather than by the sort key: see the entity for why there is no date in the
 * key. `pages: 'all'` is safe for the same reason the membership queries use it — the
 * partition holds an artist's own coverage, tens of rows at most.
 */
export async function listArtistMedia(artistId: string): Promise<ArtistMedia[]> {
  const result = await ArtistMediaEntity.query.primary({ artistId }).go({ pages: 'all' });
  return sortArtistMedia((result.data ?? []) as ArtistMedia[]);
}

export type { ArtistMedia } from './entity';
export {
  AddArtistMediaSchema,
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  UpdateArtistMediaSchema,
} from './schema';
export type { MediaType } from './schema';
export { sortArtistMedia } from './sort';

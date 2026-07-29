/**
 * Client-safe exports for the ArtistMedia domain.
 * No Node.js or AWS dependencies — safe for browser import.
 *
 * `index.ts` pulls in `entity.ts`, and through it ElectroDB and the AWS SDK, which crash
 * the browser bundle. Web routes import from here instead.
 */

export type { ArtistMedia } from './entity';
export {
  AddArtistMediaSchema,
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  UpdateArtistMediaSchema,
} from './schema';
export type { MediaType } from './schema';
export { sortArtistMedia } from './sort';

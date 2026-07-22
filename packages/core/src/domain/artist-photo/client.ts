/**
 * Client-safe exports for the ArtistPhoto domain.
 * No Node.js or AWS dependencies — safe for browser import.
 *
 * `index.ts` pulls in `entity.ts`, and through it ElectroDB and the AWS SDK, which
 * crash the browser bundle. Web routes import from here instead.
 */

export type { ArtistPhoto } from './entity';
export { AddArtistPhotoSchema, MAX_PHOTO_ORDER, UpdateArtistPhotoSchema } from './schema';

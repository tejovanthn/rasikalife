/**
 * Client-safe exports for Artist domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateArtistSchema, UpdateArtistSchema } from './schema';

// Export input types derived from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

// Export the Artist type interface (browser-safe, no ElectroDB dependency)
export interface Artist {
  id: string;
  name: string;
  title?: string;
  gurus?: Array<{ id?: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

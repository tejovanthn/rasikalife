import { z } from 'zod';
import { CreateArtistSchema, UpdateArtistSchema } from './schema';

// Type inference from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

// Re-export the Artist type from entities
export type { Artist } from '../../db/entities';

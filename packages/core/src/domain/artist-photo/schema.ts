import { z } from 'zod';

// The entity's sort key zero-pads `order` to four digits, and that key is compared as a
// string — so an order of 10000 sorts *before* 0 and silently jumps to the front of the
// gallery. Bound it here, where exceeding it is a validation error the caller can see,
// rather than leaving it to fail as a reordering nobody can explain.
export const MAX_PHOTO_ORDER = 9999;

export const AddArtistPhotoSchema = z.object({
  artistId: z.string().min(1),
  imageUrl: z.string().url(),
  uploadId: z.string().min(1),
  // Positive ints: a zero would be a decode that succeeded and said nothing, and an
  // aspect-ratio built from it divides by zero.
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  order: z.number().int().min(0).max(MAX_PHOTO_ORDER).optional(),
  featured: z.boolean().optional(),
  createdBy: z.string().min(1),
});

export const UpdateArtistPhotoSchema = z.object({
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  order: z.number().int().min(0).max(MAX_PHOTO_ORDER).optional(),
  featured: z.boolean().optional(),
});

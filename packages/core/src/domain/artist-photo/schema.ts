import { z } from 'zod';

export const AddArtistPhotoSchema = z.object({
  artistId: z.string().min(1),
  imageUrl: z.string().url(),
  uploadId: z.string().min(1),
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  order: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  createdBy: z.string().min(1),
});

export const UpdateArtistPhotoSchema = z.object({
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
  order: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
});

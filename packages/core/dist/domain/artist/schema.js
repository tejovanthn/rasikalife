import { z } from 'zod';
export const CreateArtistSchema = z.object({
    name: z.string().min(1).max(100),
    artistType: z.string().optional(),
    bio: z.string().optional(),
    instruments: z.array(z.string()).optional(),
    traditions: z.array(z.string()).optional(),
    profileImage: z.string().url().optional(),
    isVerified: z.boolean().optional(),
    viewCount: z.number().optional(),
});
export const UpdateArtistSchema = CreateArtistSchema.partial();

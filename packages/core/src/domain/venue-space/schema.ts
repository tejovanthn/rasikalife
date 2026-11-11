import { z } from 'zod';

const Label = z.string().trim().min(1).max(60);
const Note = z.string().trim().max(200).optional();

export const ListSpacesSchema = z.object({ venueId: z.string() });

export const CreateSpaceSchema = z.object({
  venueId: z.string(),
  name: Label,
  capacity: z.number().int().positive().optional(),
  notes: Note,
});

export const UpdateSpaceSchema = z.object({
  venueId: z.string(),
  spaceId: z.string(),
  name: Label.optional(),
  capacity: z.number().int().positive().optional(),
  notes: Note,
});

export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof UpdateSpaceSchema>;

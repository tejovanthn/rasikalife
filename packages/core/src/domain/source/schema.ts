import { z } from 'zod';

export const SOURCE_KINDS = ['book', 'article', 'web', 'paper'] as const;

/** Lowercase words joined by hyphens: `ssp-1963-tamil`, `raga-nidhi`, `karnatik-ragas`. */
export const SOURCE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SourceSlugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(SOURCE_SLUG, 'lowercase letters, digits and hyphens');

export const CreateSourceSchema = z.object({
  slug: SourceSlugSchema,
  title: z.string().min(1).max(200),
  citation: z.string().min(1).max(500),
  kind: z.enum(SOURCE_KINDS),
  url: z.string().url().optional(),
  year: z.number().int().min(1000).max(2100).optional(),
  language: z.string().max(40).optional(),
  licence: z.string().max(300).optional(),
});

export const UpdateSourceSchema = CreateSourceSchema.omit({ slug: true }).partial();

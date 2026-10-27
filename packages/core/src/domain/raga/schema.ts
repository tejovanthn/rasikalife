import { z } from 'zod';

import { EntityRefSchema, TraditionSchema } from '../shared/schemas';
import { parseSwaraSet, validatePhrase } from './notation';
import { CitationSchema } from './sourced';

export const SCALE_TYPES = [
  'sampurna',
  'shadava',
  'audava',
  'svarantara',
  'vakra',
  'shadava-sampurna',
  'audava-sampurna',
  'audava-shadava',
  'sampurna-shadava',
  'sampurna-audava',
  'shadava-audava',
] as const;

/** A swara set, stored as distinct tokens: `['R2', 'G2', 'M1', 'N2']`, or bare letters. */
const SwaraSetSchema = z
  .array(z.string())
  .max(12)
  .superRefine((tokens, ctx) => {
    const checked = parseSwaraSet(tokens);
    if (!checked.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: checked.reason });
  });

export const PrayogaSchema = z.object({
  notation: z.string().superRefine((text, ctx) => {
    const checked = validatePhrase(text);
    if (!checked.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: checked.reason });
  }),
  /** A short name for the phrase, in our words. */
  label: z.string().max(120).optional(),
  /** The source's gamaka marks, raw. Kept, not shown, until gamakas are modelled. */
  gamaka: z.string().max(200).optional(),
});

export type Prayoga = z.infer<typeof PrayogaSchema>;

export const CreateRagaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tradition: TraditionSchema.optional(),
  arohanam: z.string().max(200).optional(),
  avarohanam: z.string().max(200).optional(),
  alternateScales: z.array(z.string()).optional(),
  rasa: z.string().max(100).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night', 'universal']).optional(),
  season: z.string().max(100).optional(),
  melaNumber: z.number().int().min(1).max(72).optional(),
  parentRaga: EntityRefSchema.optional(),
  scaleType: z.enum(SCALE_TYPES).optional(),
  isBhashanga: z.boolean().optional(),
  prayogas: z.array(PrayogaSchema).max(20).optional(),
  jivaSwaras: SwaraSetSchema.optional(),
  nyasaSwaras: SwaraSetSchema.optional(),
  grahaSwaras: SwaraSetSchema.optional(),
  anyaSwaras: SwaraSetSchema.optional(),
  /** How the raga moves, in our own plain words. Never a source's sentences. */
  movement: z.string().max(1000).optional(),
  keyCompositionIds: z.array(z.string().min(1)).max(5).optional(),
  citations: z.array(CitationSchema).max(100).optional(),
});

export const UpdateRagaSchema = CreateRagaSchema.partial();

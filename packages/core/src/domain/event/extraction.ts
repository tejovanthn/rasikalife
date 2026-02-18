import { z } from 'zod';
import { CreateFestivalSchema } from '../festival/schema';
import { CreateEventSchema } from './schema';

/**
 * Extraction schemas derived from the create schemas but relaxed for Gemini output.
 * - Dates use z.coerce.string() since Gemini may return Date-like objects
 * - URL/email validators removed since Gemini output won't always be valid
 * - Venue/organiser kept as nested objects (Gemini extracts structured, we flatten later)
 */

const coercedDateString = z.coerce.string();

// Pick the fields Gemini can extract from a festival poster, relaxing validators
const ExtractionFestivalSchema = CreateFestivalSchema.pick({
  name: true,
  description: true,
  tags: true,
  sponsors: true,
}).extend({
  startDate: coercedDateString,
  endDate: coercedDateString,
  organiser: z
    .object({
      name: z.string(),
      contactPhone: z.string().nullish(),
      contactEmail: z.string().nullish(),
    })
    .nullish(),
});

// Pick the fields Gemini can extract from an event poster, relaxing validators
const ExtractionEventSchema = CreateEventSchema.pick({
  title: true,
  description: true,
  tags: true,
  entryType: true,
  sponsors: true,
}).extend({
  startDateTime: coercedDateString,
  endDateTime: coercedDateString.nullish(),
  venue: z
    .object({
      name: z.string(),
      address: z
        .object({
          street: z.string().nullish(),
          city: z.string().nullish(),
          state: z.string().nullish(),
          postalCode: z.string().nullish(),
          country: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  organiser: z
    .object({
      name: z.string(),
      contactPhone: z.string().nullish(),
      contactEmail: z.string().nullish(),
    })
    .nullish(),
  artists: z
    .array(
      z.object({
        title: z.string().nullish(),
        name: z.string(),
        role: z.string().nullish(),
      })
    )
    .default([]),
  ticketing: z
    .object({
      url: z.string().nullish(),
      prices: z.record(z.string(), z.number()).nullish(),
      contactPhone: z.string().nullish(),
      contactEmail: z.string().nullish(),
      partnerName: z.string().nullish(),
    })
    .nullish(),
  contactInfo: z
    .object({
      phone: z.string().nullish(),
      email: z.string().nullish(),
      website: z.string().nullish(),
      socialHandles: z.array(z.string()).nullish(),
    })
    .nullish(),
});

export const ExtractionResultSchema = z.object({
  isFestival: z.boolean().default(false),
  festival: ExtractionFestivalSchema.optional().nullable(),
  events: z.array(ExtractionEventSchema).default([]),
  confidence: z.number().default(0.5),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// --- Classification schema (Step 1 of two-step extraction) ---

export const PosterTypeEnum = z.enum(['single-event', 'festival', 'multi-event']);
export type PosterType = z.infer<typeof PosterTypeEnum>;

export const ClassificationResultSchema = z.object({
  posterType: PosterTypeEnum,
  summary: z.string(),
  confidence: z.number().default(0.5),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

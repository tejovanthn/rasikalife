import { z } from 'zod';

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const YearSchema = z.number().int().min(1800).max(2100);

/**
 * A year for a person who lived before 1800 (Muttuswami Dikshitar, 1775; Syama Sastri, 1763).
 *
 * Used ONLY for an artist's `birthYear` and `deathYear`. Every other year keeps `YearSchema`,
 * and so do the research and bio-extraction paths: that floor stops a model from guessing a
 * 1700s date for a living person. The ceiling is 1920 because the importer sets these for
 * people dead for over a century.
 */
export const HistoricalYearSchema = z.number().int().min(1000).max(1920);

/**
 * An artist's birth year: a modern year, or a historical one. The two ranges do not overlap
 * (1920 and 1800 do, but the union accepts both), so living-artist validation does not change.
 */
export const BirthYearSchema = z.union([YearSchema, HistoricalYearSchema]);

export const TraditionSchema = z.enum(['carnatic', 'hindustani', 'both']);

export const EntityRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const SponsorSchema = z.object({ name: z.string(), type: z.string().optional() });

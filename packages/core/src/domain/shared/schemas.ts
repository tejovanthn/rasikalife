import { z } from 'zod';

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const YearSchema = z.number().int().min(1800).max(2100);

export const TraditionSchema = z.enum(['carnatic', 'hindustani', 'both']);

export const EntityRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const SponsorSchema = z.object({ name: z.string(), type: z.string().optional() });

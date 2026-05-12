import { z } from 'zod';

import { SponsorSchema } from '../shared/schemas';

export const CreateEventSchema = z.object({
  festivalId: z.string().nullish(),
  posterUrl: z.string().url().nullish(),
  posterUploadId: z.string().nullish(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullish(),
  startDateTime: z.string().datetime({ offset: true }),
  endDateTime: z.string().datetime({ offset: true }).nullish(),
  timezone: z.string().default('Asia/Kolkata'),
  venueId: z.string().nullish(),
  venueName: z.string().nullish(),
  organiserId: z.string().nullish(),
  organiserName: z.string().nullish(),
  artists: z
    .array(
      z.object({
        id: z.string().nullish(),
        title: z.string().nullish(),
        name: z.string().min(1).max(200),
        role: z.string().nullish(),
      })
    )
    .default([]),
  artForm: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  entryType: z.enum(['free', 'ticketed', 'by-invitation']).default('free'),
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
  sponsors: z.array(SponsorSchema).nullish(),
  sourcePlatform: z.enum(['instagram']).optional(),
  sourcePostId: z.string().optional(),
  sourcePostUrl: z.string().optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

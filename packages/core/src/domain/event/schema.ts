import { z } from 'zod';

import { AddressSchema, SponsorSchema } from '../shared/schemas';

/**
 * Where the events are. Every form that has to attach an offset to a wall-clock time reads it
 * from here rather than writing `+05:30` out again — that literal was in three places, and a
 * hard-coded offset is also wrong the moment an event is held anywhere that observes DST.
 */
export const DEFAULT_EVENT_TIMEZONE = 'Asia/Kolkata';

export const CreateEventSchema = z.object({
  festivalId: z.string().nullish(),
  posterUrl: z.string().url().nullish(),
  posterOgUrl: z.string().url().nullish(),
  posterUploadId: z.string().nullish(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullish(),
  startDateTime: z.string().datetime({ offset: true }),
  endDateTime: z.string().datetime({ offset: true }).nullish(),
  timezone: z.string().default(DEFAULT_EVENT_TIMEZONE),
  venueId: z.string().nullish(),
  venueName: z.string().nullish(),
  venueCity: z.string().optional(),
  venueAddress: AddressSchema.optional(),
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

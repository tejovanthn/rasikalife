import { z } from 'zod';

import { AddressSchema, YearSchema } from '../shared/schemas';
import { SocialLinkSchema } from '../social-link';

/**
 * The canonical organiser tag slugs. Single source of truth for the Zod enum, the
 * organiser form checkboxes, and the admin CSV's one-column-per-tag layout. Note this
 * is a closed set, unlike the free-text `tags` on festival and event.
 */
export const ORGANISER_TAGS = [
  'carnatic',
  'hindustani',
  'bharatanatyam',
  'dance',
  'instrumental',
  'jugalbandi',
  'lecture-demo',
  'music-school',
  'music-competition',
  'award-conferring',
  'publication',
  'free-entry',
  'ticketed',
  'festival-organiser',
  'year-round',
  'charitable',
  'other',
] as const;

export type OrganiserTag = (typeof ORGANISER_TAGS)[number];

export const ORGANISATION_TYPES = [
  'sabha',
  'trust',
  'ngo',
  'temple',
  'university',
  'other',
] as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export const CreateOrganiserSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  organisationType: z.enum(ORGANISATION_TYPES).optional(),
  city: z.string().max(100).optional(),
  address: AddressSchema.optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  foundedYear: YearSchema.optional(),
  logoUrl: z.string().url().optional(),
  logoUploadId: z.string().optional(),
  tags: z.array(z.enum(ORGANISER_TAGS)).optional(),
  venueId: z.string().optional(),
  venueName: z.string().max(200).optional(),
});

export const UpdateOrganiserSchema = CreateOrganiserSchema.partial();

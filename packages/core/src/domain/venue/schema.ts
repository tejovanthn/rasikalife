import { z } from 'zod';

import { AddressSchema, YearSchema } from '../shared/schemas';
import { SocialLinkSchema } from '../social-link';

/**
 * The canonical amenity slugs. Single source of truth for the Zod enum, the venue form
 * checkboxes, and the admin CSV's one-column-per-amenity layout.
 */
export const VENUE_AMENITIES = [
  'ac',
  'parking',
  'floor-seating',
  'chair-seating',
  'green-room',
  'canteen',
  'wheelchair-accessible',
  'hearing-loop',
  'elevator',
  'restrooms',
  'metro-nearby',
  'bus-stop-nearby',
  'sound-system',
  'live-streaming',
  'library',
  'other',
] as const;

export type VenueAmenity = (typeof VENUE_AMENITIES)[number];

export const VENUE_TYPES = [
  'auditorium',
  'sabha-hall',
  'temple-hall',
  'open-air',
  'pandal',
  'terrace',
  'community-hall',
  'heritage-building',
  'university',
  'other',
] as const;

export type VenueType = (typeof VENUE_TYPES)[number];

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: AddressSchema.optional(),
  mapLink: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  venueType: z.enum(VENUE_TYPES).optional(),
  capacity: z.number().int().min(1).optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  photoUploadId: z.string().optional(),
  amenities: z.array(z.enum(VENUE_AMENITIES)).optional(),
  nearestTransit: z.string().max(200).optional(),
  foundedYear: YearSchema.optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
});

export const UpdateVenueSchema = CreateVenueSchema.partial();

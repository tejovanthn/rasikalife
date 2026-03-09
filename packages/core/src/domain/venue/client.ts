/**
 * Client-safe exports for Venue domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateVenueSchema, UpdateVenueSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateVenueSchema, UpdateVenueSchema } from './schema';

// Export input types derived from schemas
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;

// Export the Venue type interface (browser-safe, no ElectroDB dependency)
export interface Venue {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  city?: string;
  mapLink?: string;
  description?: string;
  venueType?: string;
  capacity?: number;
  website?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  photoUploadId?: string;
  amenities?: string[];
  nearestTransit?: string;
  foundedYear?: number;
  socialLinks?: Array<{ platform: string; url: string }>;
  createdAt: string;
  updatedAt: string;
}

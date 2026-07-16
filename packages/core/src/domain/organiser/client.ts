/**
 * Client-safe exports for Organiser domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

// Re-export the enum constants so forms can render options without redeclaring them
export { ORGANISATION_TYPES, ORGANISER_TAGS } from './schema';
export type { OrganisationType, OrganiserTag } from './schema';

// Export input types derived from schemas
export type CreateOrganiserInput = z.infer<typeof CreateOrganiserSchema>;
export type UpdateOrganiserInput = z.infer<typeof UpdateOrganiserSchema>;

// Export the Organiser type interface (browser-safe, no ElectroDB dependency)
export interface Organiser {
  id: string;
  name: string;
  description?: string;
  organisationType?: string;
  city?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  website?: string;
  phone?: string;
  email?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
  foundedYear?: number;
  logoUrl?: string;
  logoUploadId?: string;
  tags?: string[];
  venueId?: string;
  venueName?: string;
  createdAt: string;
  updatedAt: string;
}

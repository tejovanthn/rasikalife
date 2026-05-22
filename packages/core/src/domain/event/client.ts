/**
 * Client-safe exports for Event domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateEventSchema, UpdateEventSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateEventSchema, UpdateEventSchema } from './schema';

// Re-export extraction types (pure TypeScript interfaces, browser-safe)
export type { ExtractionResult } from './extraction';

// Export input types derived from schemas
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export interface EventArtist {
  id?: string;
  title?: string;
  name: string;
  role?: string;
}

// Art form constants (browser-safe)
export const ART_FORM_LABELS: Record<string, string> = {
  carnatic: 'Carnatic Music',
  hindustani: 'Hindustani Music',
  bharatanatyam: 'Bharatanatyam',
  kuchipudi: 'Kuchipudi',
  mohiniyattam: 'Mohiniyattam',
  odissi: 'Odissi',
  kathak: 'Kathak',
  'light-music': 'Light Music',
  bhajan: 'Bhajan',
  devotional: 'Devotional',
  'film-music': 'Film Music',
  harikatha: 'Harikatha',
};

export const ART_FORMS = new Set(Object.keys(ART_FORM_LABELS));

// Export the Event type interface (browser-safe, no ElectroDB dependency)
export interface Event {
  id: string;
  festivalId?: string;
  festivalName?: string;
  posterUrl?: string;
  posterOgUrl?: string;
  posterUploadId?: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  venueId?: string;
  venueName?: string;
  organiserId?: string;
  organiserName?: string;
  artists?: EventArtist[];
  tags?: string[];
  entryType?: string;
  ticketing?: {
    url?: string;
    prices?: Record<string, number>;
    contactPhone?: string;
    contactEmail?: string;
    partnerName?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
    socialHandles?: string[];
  };
  sponsors?: Array<{ name: string; type?: string }>;
  status: string;
  extractionConfidence?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

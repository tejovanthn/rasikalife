/**
 * Client-safe exports for Festival domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateFestivalSchema, UpdateFestivalSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateFestivalSchema, UpdateFestivalSchema } from './schema';

// Export input types derived from schemas
export type CreateFestivalInput = z.infer<typeof CreateFestivalSchema>;
export type UpdateFestivalInput = z.infer<typeof UpdateFestivalSchema>;

// Export the Festival type interface (browser-safe, no ElectroDB dependency)
export interface Festival {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  posterUrl?: string;
  posterUploadId?: string;
  organiserId?: string;
  organiserName?: string;
  tags?: string[];
  sponsors?: Array<{ name: string; type?: string }>;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

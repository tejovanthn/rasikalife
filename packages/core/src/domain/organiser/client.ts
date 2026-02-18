/**
 * Client-safe exports for Organiser domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateOrganiserSchema, UpdateOrganiserSchema } from './schema';

// Export input types derived from schemas
export type CreateOrganiserInput = z.infer<typeof CreateOrganiserSchema>;
export type UpdateOrganiserInput = z.infer<typeof UpdateOrganiserSchema>;

// Export the Organiser type interface (browser-safe, no ElectroDB dependency)
export interface Organiser {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

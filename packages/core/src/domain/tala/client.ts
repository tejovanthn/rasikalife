/**
 * Client-safe exports for Tala domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateTalaSchema, UpdateTalaSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateTalaSchema, UpdateTalaSchema } from './schema';

// Export input types derived from schemas
export type CreateTalaInput = z.infer<typeof CreateTalaSchema>;
export type UpdateTalaInput = z.infer<typeof UpdateTalaSchema>;

// Export the Tala type interface (browser-safe, no ElectroDB dependency)
export interface Tala {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

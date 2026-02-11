/**
 * Client-safe exports for Raga domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateRagaSchema, UpdateRagaSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateRagaSchema, UpdateRagaSchema } from './schema';

// Export input types derived from schemas
export type CreateRagaInput = z.infer<typeof CreateRagaSchema>;
export type UpdateRagaInput = z.infer<typeof UpdateRagaSchema>;

// Export the Raga type interface (browser-safe, no ElectroDB dependency)
export interface Raga {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

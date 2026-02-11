/**
 * Client-safe exports for User domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateUserSchema, UpdateUserSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateUserSchema, UpdateUserSchema } from './schema';

// Export input types derived from schemas
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// Export the User type interface (browser-safe, no ElectroDB dependency)
export interface User {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  createdAt: string;
  updatedAt: string;
}

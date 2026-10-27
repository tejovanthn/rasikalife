/**
 * Client-safe exports for the Source domain. No Node.js or AWS dependencies.
 */

import type { z } from 'zod';
import type { CreateSourceSchema } from './schema';

export {
  CreateSourceSchema,
  SOURCE_KINDS,
  SOURCE_SLUG,
  SourceSlugSchema,
  UpdateSourceSchema,
} from './schema';

export type CreateSourceInput = z.infer<typeof CreateSourceSchema>;

export interface SourceRecord extends CreateSourceInput {
  createdAt: string;
  updatedAt: string;
}

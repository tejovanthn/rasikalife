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

// Pure rule shared by the raga page and the sitemap.
export { isThinRaga } from './thin';

export { SCALE_TYPES, PrayogaSchema, type Prayoga } from './schema';
export {
  SWARA_SEMITONES,
  parseSwaraSet,
  resolveVariant,
  scalePositions,
  scaleTokens,
  swarasOutsideRaga,
  validatePhrase,
  type ScalePositions,
} from './notation';
export {
  CITABLE_RAGA_FIELDS,
  CitationSchema,
  LEGACY_FIELDS,
  citationsFor,
  isCited,
  isEmptyValue,
  isShown,
  numberReferences,
  pruneCitations,
  shownRaga,
  type CitableRagaField,
  type Citation,
  type Reference,
  type StoredCitation,
} from './sourced';
export {
  describeChange,
  findRelatives,
  noteChanges,
  type NoteChange,
  type Relative,
  type ScaleOf,
} from './relatives';

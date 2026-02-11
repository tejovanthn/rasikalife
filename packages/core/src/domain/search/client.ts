/**
 * Client-safe exports for Search domain
 * No Node.js or AWS dependencies - safe for browser import
 */

// Re-export types
export type {
  SearchResponse,
  SearchResultItem,
  HealthStatus,
  SearchDocument,
  EntityType,
} from './types';

// Re-export schemas (Zod is browser-safe)
export { SearchInputSchema, SearchableFieldSchema } from './schema';

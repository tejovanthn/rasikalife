// packages/core/src/domain/search/index.ts

export { search, getHealth } from './service';
export { buildAndStoreSearchIndex } from './indexer';
export type { SearchResponse, SearchResultItem, HealthStatus } from './types';
export { SearchInputSchema, SearchableFieldSchema } from './schema';

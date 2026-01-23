// packages/core/src/domain/search/index.ts

export { search, searchWithFullData, getHealth } from './service';
export type { SearchWithFullDataResponse } from './service';
export { buildAndStoreSearchIndex } from './indexer';
export type { SearchResponse, SearchResultItem, HealthStatus } from './types';
export { SearchInputSchema, SearchableFieldSchema } from './schema';

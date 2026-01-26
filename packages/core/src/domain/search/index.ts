// packages/core/src/domain/search/index.ts

export { search, searchWithFullData, getHealth, getDocuments } from './service';
export type { SearchWithFullDataResponse, DocumentsResponse } from './service';
export { buildAndStoreSearchIndex } from './indexer';
export type {
  SearchResponse,
  SearchResultItem,
  HealthStatus,
  SearchDocument,
  EntityType,
} from './types';
export { SearchInputSchema, SearchableFieldSchema } from './schema';

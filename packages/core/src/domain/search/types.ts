// packages/core/src/domain/search/types.ts

import type { SearchableField } from './schema';

export type EntityType = 'artist' | 'raga' | 'tala' | 'composition';

export interface SearchDocument {
  id: string;
  entityType: EntityType;
  artistName: string;
  ragaName: string;
  talaName: string;
  compositionTitle: string;
  lyrics: string;
  displayName: string;
  indexedAt: string;
}

export interface SearchIndex {
  version: number;
  builtAt: string;
  documentCount: number;
  fuseIndex: unknown;
  documents: SearchDocument[];
}

export interface SearchResultItem {
  id: string;
  type: EntityType;
  name: string;
  highlights: Array<{
    field: SearchableField;
    text: string;
  }>;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}

export interface HealthStatus {
  status: 'healthy' | 'stale' | 'unhealthy';
  lastBuilt: string | null;
  documentCount: number;
  message?: string;
}

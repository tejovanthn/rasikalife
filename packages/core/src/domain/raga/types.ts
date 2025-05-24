import type { DynamoItem } from '../../db';
import type { Tradition } from '../artist';
import type { Raga } from './schema';

export interface RagaDynamoItem extends DynamoItem, Raga {}
export type UpdateRagaDynamoItem = Partial<RagaDynamoItem>;

export interface RagaVersion {
  id: string;
  version: string;
  timestamp: string;
  editorId: string;
}

export interface RagaSearchParams {
  query?: string;
  melakarta?: number;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

export interface RagaSearchResult {
  items: Raga[];
  nextToken?: string;
  hasMore: boolean;
}

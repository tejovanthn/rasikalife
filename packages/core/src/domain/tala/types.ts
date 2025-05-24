import type { DynamoItem } from '../../db';
import type { Tradition } from '../artist';
import type { Tala } from './schema';

export interface TalaDynamoItem extends DynamoItem, Tala {}
export type UpdateTalaDynamoItem = Partial<TalaDynamoItem>;

export interface TalaVersion {
  id: string;
  version: string;
  timestamp: string;
  editorId: string;
}

export interface TalaSearchParams {
  query?: string;
  aksharas?: number;
  type?: string;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

export interface TalaSearchResult {
  items: Tala[];
  nextToken?: string;
  hasMore: boolean;
}

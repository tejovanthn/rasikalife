/**
 * Content domain types - following artist domain pattern
 */
import type { DynamoItem } from '../../db';
import type { Content } from './schema';

// Minimal types that can't be inferred from schemas
export interface ContentDynamoItem extends DynamoItem, Content {
  // Add any additional fields needed for DynamoDB operations
}

export type UpdateContentDynamoItem = Partial<ContentDynamoItem>;

// Repository-specific types
export interface ContentSearchParams {
  query?: string;
  category?: string;
  status?: string;
  visibility?: string;
  tags?: string[];
  pathPrefix?: string;
  limit?: number;
  nextToken?: string;
}

export interface ContentSearchResult {
  items: Content[];
  nextToken?: string;
  hasMore: boolean;
}
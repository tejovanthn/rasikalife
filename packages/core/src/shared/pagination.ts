/**
 * Pagination utilities for APIs
 */
import { PaginationParams, PaginationResult } from '../db/queryBuilder';

/**
 * Maximum number of items to return in a single page
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Default number of items to return in a single page
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Validate and normalize pagination parameters
 * 
 * @param params - User-provided pagination parameters
 * @returns Normalized pagination parameters
 */
export const normalizePaginationParams = (
  params?: Partial<PaginationParams>
): PaginationParams => {
  const limit = params?.limit || DEFAULT_PAGE_SIZE;
  const validLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  
  return {
    limit: validLimit,
    nextToken: params?.nextToken,
  };
};

/**
 * Convert a DynamoDB LastEvaluatedKey to a base64 next token
 * 
 * @param lastEvaluatedKey - DynamoDB's LastEvaluatedKey object
 * @returns Base64 encoded next token or undefined
 */
export const createNextToken = (
  lastEvaluatedKey?: Record<string, any>
): string | undefined => {
  if (!lastEvaluatedKey) {
    return undefined;
  }
  
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
};

/**
 * Parse a next token back to a DynamoDB LastEvaluatedKey
 * 
 * @param nextToken - Base64 encoded next token
 * @returns DynamoDB LastEvaluatedKey object or undefined
 */
export const parseNextToken = (
  nextToken?: string
): Record<string, any> | undefined => {
  if (!nextToken) {
    return undefined;
  }
  
  try {
    return JSON.parse(Buffer.from(nextToken, 'base64').toString());
  } catch (error) {
    throw new Error('Invalid pagination token');
  }
};

/**
 * Create a standardized pagination result object
 * 
 * @param items - Array of items
 * @param lastEvaluatedKey - DynamoDB's LastEvaluatedKey object
 * @returns Standardized pagination result
 */
export const createPaginatedResponse = <T>(
  items: T[],
  lastEvaluatedKey?: Record<string, any>
): {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
} => {
  const nextToken = createNextToken(lastEvaluatedKey);
  
  return {
    items,
    nextToken,
    hasMore: !!nextToken,
  };
};
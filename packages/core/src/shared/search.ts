/**
 * Search utilities for the application
 */
import { ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { scan } from '../db/operations';
import { DynamoItem } from '../db/queryBuilder';
import { createPaginatedResponse, normalizePaginationParams } from './pagination';

/**
 * Search options
 */
export interface SearchOptions {
  /**
   * Fields to search in
   */
  fields: string[];
  
  /**
   * Filter conditions (AND)
   */
  filters?: Record<string, any>;
  
  /**
   * Pagination parameters
   */
  pagination?: {
    limit?: number;
    nextToken?: string;
  };
  
  /**
   * Case-sensitive search
   */
  caseSensitive?: boolean;
  
  /**
   * Table name suffix
   */
  tableName?: string;
}

/**
 * Simple search implementation using DynamoDB Scan
 * 
 * Note: For production use with large datasets, consider using 
 * Elasticsearch or other dedicated search solutions
 * 
 * @param searchTerm - Search term to find
 * @param options - Search options
 * @returns Paginated search results
 */
export const basicSearch = async <T extends DynamoItem>(
  searchTerm: string,
  options: SearchOptions
): Promise<{
  items: T[];
  nextToken?: string;
  hasMore: boolean;
}> => {
  if (!searchTerm || !options.fields || options.fields.length === 0) {
    return { items: [], hasMore: false };
  }
  
  const pagination = normalizePaginationParams(options.pagination);
  
  // Build filter expressions for each field
  const fieldExpressions: string[] = options.fields.map((field, index) => {
    return options.caseSensitive
      ? `contains(${field}, :searchTerm)`
      : `contains(lower(${field}), :searchTerm)`;
  });
  
  // Add any additional filters
  const filterConditions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {
    ':searchTerm': options.caseSensitive ? searchTerm : searchTerm.toLowerCase(),
  };
  
  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value], index) => {
      const attrName = `:filter${index}`;
      filterConditions.push(`${key} = ${attrName}`);
      expressionAttributeValues[attrName] = value;
    });
  }
  
  // Combine field expressions with OR, and additional filters with AND
  let filterExpression = `(${fieldExpressions.join(' OR ')})`;
  if (filterConditions.length > 0) {
    filterExpression += ` AND ${filterConditions.join(' AND ')}`;
  }
  
  const params: ScanCommandInput = {
    TableName: options.tableName,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    Limit: pagination.limit,
    ExclusiveStartKey: pagination.nextToken 
      ? JSON.parse(Buffer.from(pagination.nextToken, 'base64').toString())
      : undefined,
  };
  
  const result = await scan<T>(params);
  
  return createPaginatedResponse(
    result.items,
    result.lastEvaluatedKey
  );
};

/**
 * Create a prefixed search term for partial matching at the beginning of words
 * 
 * @param term - Original search term
 * @returns Processed search term
 */
export const createPrefixSearchTerm = (term: string): string => {
  return term.trim().toLowerCase();
};

/**
 * Score search results based on relevance
 * 
 * @param items - Items to score
 * @param searchTerm - Search term
 * @param fields - Fields to consider for scoring with weights
 * @returns Scored and sorted items
 */
export const scoreSearchResults = <T>(
  items: T[],
  searchTerm: string,
  fields: Array<{ name: string; weight: number }>
): T[] => {
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  const scoredItems = items.map(item => {
    let score = 0;
    
    for (const field of fields) {
      const value = getNestedProperty(item, field.name);
      
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        
        // Exact match gets the highest score
        if (lowerValue === lowerSearchTerm) {
          score += field.weight * 10;
        }
        // Begins with gets a good score
        else if (lowerValue.startsWith(lowerSearchTerm)) {
          score += field.weight * 5;
        }
        // Contains gets a lower score
        else if (lowerValue.includes(lowerSearchTerm)) {
          score += field.weight * 2;
        }
        // Word boundary match
        else if (lowerValue.includes(` ${lowerSearchTerm}`)) {
          score += field.weight * 3;
        }
      }
    }
    
    return { item, score };
  });
  
  // Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score);
  
  return scoredItems.map(({ item }) => item);
};

/**
 * Get a nested property from an object using dot notation
 * 
 * @param obj - Object to get property from
 * @param path - Property path (e.g., "address.city")
 * @returns Property value or undefined
 */
const getNestedProperty = (obj: any, path: string): any => {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
};
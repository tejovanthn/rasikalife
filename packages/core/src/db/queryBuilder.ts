/**
 * DynamoDB query builder utilities
 */
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { query } from './operations';

// DynamoDB key structure
export interface DynamoKey {
  PK: string;
  SK: string;
}

// DynamoDB item structure with optional GSI and LSI keys
export interface DynamoItem extends DynamoKey {
  [key: string]: any;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;
  GSI4PK?: string;
  GSI4SK?: string;
  LSI1SK?: string;
}

// Pagination parameters for queries
export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

// Pagination result
export interface PaginationResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, string>;
  count: number;
  scannedCount: number;
}

// Query builder options
export interface QueryBuilderOptions {
  tableName?: string;
  indexName?: string;
  limit?: number;
  scanIndexForward?: boolean;
  exclusiveStartKey?: Record<string, string>;
  consistentRead?: boolean;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
}

/**
 * Build a key condition expression for querying DynamoDB
 */
export class QueryBuilder<T extends DynamoItem = DynamoItem> {
  private keyConditionExpression: string[] = [];
  private filterExpression: string[] = [];
  private expressionAttributeValues: Record<string, any> = {};
  private options: QueryBuilderOptions;

  constructor(options: QueryBuilderOptions = {}) {
    this.options = options;
  }

  /**
   * Add a partition key condition
   * 
   * @param key - Name of the key (PK, GSI1PK, etc.)
   * @param value - Value to compare against
   * @returns The query builder instance for chaining
   */
  withPartitionKey(key: string, value: string): QueryBuilder<T> {
    this.keyConditionExpression.push(`${key} = :${key}`);
    this.expressionAttributeValues[`:${key}`] = value;
    return this;
  }

  /**
   * Add a sort key equality condition
   * 
   * @param key - Name of the key (SK, GSI1SK, etc.)
   * @param value - Value to compare against
   * @returns The query builder instance for chaining
   */
  withSortKey(key: string, value: string): QueryBuilder<T> {
    this.keyConditionExpression.push(`${key} = :${key}`);
    this.expressionAttributeValues[`:${key}`] = value;
    return this;
  }

  /**
   * Add a begins_with condition for a sort key
   * 
   * @param key - Name of the key (SK, GSI1SK, etc.)
   * @param prefix - Prefix to match
   * @returns The query builder instance for chaining
   */
  withSortKeyBeginsWith(key: string, prefix: string): QueryBuilder<T> {
    this.keyConditionExpression.push(`begins_with(${key}, :${key}_prefix)`);
    this.expressionAttributeValues[`:${key}_prefix`] = prefix;
    return this;
  }

  /**
   * Add a between condition for a sort key
   * 
   * @param key - Name of the key (SK, GSI1SK, etc.)
   * @param start - Start value (inclusive)
   * @param end - End value (inclusive)
   * @returns The query builder instance for chaining
   */
  withSortKeyBetween(key: string, start: string, end: string): QueryBuilder<T> {
    this.keyConditionExpression.push(`${key} BETWEEN :${key}_start AND :${key}_end`);
    this.expressionAttributeValues[`:${key}_start`] = start;
    this.expressionAttributeValues[`:${key}_end`] = end;
    return this;
  }

  /**
   * Add a filter expression
   * 
   * @param attribute - Attribute name
   * @param operator - Comparison operator
   * @param value - Value to compare against
   * @returns The query builder instance for chaining
   */
  withFilter(attribute: string, operator: string, value: any): QueryBuilder<T> {
    const placeholder = `:${attribute.replace(/\./g, '_')}`;
    this.filterExpression.push(`${attribute} ${operator} ${placeholder}`);
    this.expressionAttributeValues[placeholder] = value;
    return this;
  }

  /**
   * Set the index to query
   * 
   * @param indexName - Name of the index (GSI1, GSI2, etc.)
   * @returns The query builder instance for chaining
   */
  withIndex(indexName: string): QueryBuilder<T> {
    this.options.indexName = indexName;
    return this;
  }

  /**
   * Set the maximum number of items to return
   * 
   * @param limit - Maximum number of items
   * @returns The query builder instance for chaining
   */
  withLimit(limit: number): QueryBuilder<T> {
    this.options.limit = limit;
    return this;
  }

  /**
   * Set the sort order (ascending or descending)
   * 
   * @param ascending - True for ascending, false for descending
   * @returns The query builder instance for chaining
   */
  withSortOrder(ascending: boolean): QueryBuilder<T> {
    this.options.scanIndexForward = ascending;
    return this;
  }

  /**
   * Set the starting point for pagination
   * 
   * @param exclusiveStartKey - Last evaluated key from previous query
   * @returns The query builder instance for chaining
   */
  withStartKey(exclusiveStartKey: Record<string, string>): QueryBuilder<T> {
    this.options.exclusiveStartKey = exclusiveStartKey;
    return this;
  }

  /**
   * Set projection expression to limit attributes returned
   * 
   * @param attributes - Array of attribute paths to include
   * @returns The query builder instance for chaining
   */
  withProjection(attributes: string[]): QueryBuilder<T> {
    const expressionAttributeNames: Record<string, string> = {};
    
    const projectionItems = attributes.map((attr, index) => {
      const parts = attr.split('.');
      const path = parts.map((part, i) => `#${index}_${i}`).join('.');
      
      parts.forEach((part, i) => {
        expressionAttributeNames[`#${index}_${i}`] = part;
      });
      
      return path;
    });
    
    this.options.projectionExpression = projectionItems.join(', ');
    this.options.expressionAttributeNames = {
      ...this.options.expressionAttributeNames,
      ...expressionAttributeNames,
    };
    
    return this;
  }

  /**
   * Execute the query and return the results
   * 
   * @returns Promise with the query results
   */
  async execute(): Promise<PaginationResult<T>> {
    if (this.keyConditionExpression.length === 0) {
      throw new Error('No key condition specified for query');
    }

    const params: QueryCommandInput = {
      TableName: this.options.tableName,
      IndexName: this.options.indexName,
      KeyConditionExpression: this.keyConditionExpression.join(' AND '),
      ExpressionAttributeValues: this.expressionAttributeValues,
      Limit: this.options.limit,
      ScanIndexForward: this.options.scanIndexForward,
      ExclusiveStartKey: this.options.exclusiveStartKey,
      ConsistentRead: this.options.consistentRead,
      ProjectionExpression: this.options.projectionExpression,
      ExpressionAttributeNames: this.options.expressionAttributeNames,
    };

    if (this.filterExpression.length > 0) {
      params.FilterExpression = this.filterExpression.join(' AND ');
    }

    return query<T>(params);
  }

  /**
   * Execute a paginated query
   * 
   * @param params - Pagination parameters
   * @returns Promise with the query results
   */
  async executePaginated(params: PaginationParams): Promise<PaginationResult<T>> {
    if (params.limit) {
      this.withLimit(params.limit);
    }
    
    if (params.nextToken) {
      this.withStartKey(JSON.parse(Buffer.from(params.nextToken, 'base64').toString()));
    }
    
    const result = await this.execute();
    
    return {
      ...result,
      lastEvaluatedKey: result.lastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
        : undefined,
    };
  }
}

/**
 * Create a new query builder
 * 
 * @param options - Query builder options
 * @returns A new query builder instance
 */
export const createQuery = <T extends DynamoItem>(
  options?: QueryBuilderOptions
): QueryBuilder<T> => {
  return new QueryBuilder<T>(options);
};
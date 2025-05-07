/**
 * Common access patterns implementation for the single-table design
 */
import { DynamoItem } from '../db/queryBuilder';
import { createQuery } from '../db/queryBuilder';
import { putItem, getItem, updateItem, deleteItem, transactWriteItems } from '../db/operations';
import { EntityPrefix, SecondaryPrefix, formatKey, formatDateSortKey, formatIndexKey } from './singleTable';
import { ApplicationError } from '../types';
import { ErrorCode } from '../constants';

/**
 * Get an item by its primary key
 * 
 * @param entityType - Type of entity
 * @param id - Entity ID
 * @param sortKey - Optional sort key (defaults to #METADATA)
 * @returns Promise with the item or null if not found
 */
export const getByPrimaryKey = async <T extends DynamoItem>(
  entityType: EntityPrefix,
  id: string,
  sortKey: string = SecondaryPrefix.METADATA
): Promise<T | null> => {
  return getItem<T>({
    PK: formatKey(entityType, id),
    SK: sortKey,
  });
};

/**
 * Get all items for an entity by partition key
 * 
 * @param entityType - Type of entity
 * @param id - Entity ID
 * @param options - Query options
 * @returns Promise with query results
 */
export const getAllByPartitionKey = async <T extends DynamoItem>(
  entityType: EntityPrefix,
  id: string,
  options: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    sortKeyPrefix?: string;
    sortKeyBetween?: { start: string; end: string };
    scanIndexForward?: boolean;
  } = {}
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> => {
  let query = createQuery<T>()
    .withPartitionKey('PK', formatKey(entityType, id));
    
  if (options.sortKeyPrefix) {
    query = query.withSortKeyBeginsWith('SK', options.sortKeyPrefix);
  } else if (options.sortKeyBetween) {
    query = query.withSortKeyBetween('SK', options.sortKeyBetween.start, options.sortKeyBetween.end);
  }
    
  if (options.limit) {
    query = query.withLimit(options.limit);
  }
    
  if (options.exclusiveStartKey) {
    query = query.withStartKey(options.exclusiveStartKey);
  }
    
  if (options.scanIndexForward !== undefined) {
    query = query.withSortOrder(options.scanIndexForward);
  }
    
  const result = await query.execute();
    
  return {
    items: result.items,
    lastEvaluatedKey: result.lastEvaluatedKey,
  };
};

/**
 * Get items by a global secondary index
 * 
 * @param indexName - Name of the GSI (GSI1, GSI2, etc.)
 * @param partitionKeyName - Name of the partition key (GSI1PK, GSI2PK, etc.)
 * @param partitionKeyValue - Value of the partition key
 * @param options - Additional query options
 * @returns Promise with query results
 */
export const getByGlobalIndex = async <T extends DynamoItem>(
  indexName: string,
  partitionKeyName: string,
  partitionKeyValue: string,
  options: {
    sortKeyName?: string;
    sortKeyValue?: string;
    sortKeyPrefix?: string;
    sortKeyBetween?: { start: string; end: string };
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    scanIndexForward?: boolean;
  } = {}
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> => {
  let query = createQuery<T>()
    .withIndex(indexName)
    .withPartitionKey(partitionKeyName, partitionKeyValue);
    
  if (options.sortKeyName) {
    if (options.sortKeyValue) {
      query = query.withSortKey(options.sortKeyName, options.sortKeyValue);
    } else if (options.sortKeyPrefix) {
      query = query.withSortKeyBeginsWith(options.sortKeyName, options.sortKeyPrefix);
    } else if (options.sortKeyBetween) {
      query = query.withSortKeyBetween(
        options.sortKeyName,
        options.sortKeyBetween.start,
        options.sortKeyBetween.end
      );
    }
  }
    
  if (options.limit) {
    query = query.withLimit(options.limit);
  }
    
  if (options.exclusiveStartKey) {
    query = query.withStartKey(options.exclusiveStartKey);
  }
    
  if (options.scanIndexForward !== undefined) {
    query = query.withSortOrder(options.scanIndexForward);
  }
    
  const result = await query.execute();
    
  return {
    items: result.items,
    lastEvaluatedKey: result.lastEvaluatedKey,
  };
};

/**
 * Get items by a GSI for a date range
 * 
 * @param indexName - Name of the GSI
 * @param statusPrefix - Status prefix for partition key
 * @param statusValue - Status value 
 * @param datePrefix - Date prefix for sort key
 * @param dateRange - Start and end dates in YYYY-MM-DD format
 * @param options - Additional options
 * @returns Promise with query results
 */
export const getByStatusAndDateRange = async <T extends DynamoItem>(
  indexName: string,
  statusPrefix: string,
  statusValue: string,
  datePrefix: string,
  dateRange: { start: string; end: string },
  options: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    scanIndexForward?: boolean;
  } = {}
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> => {
  const partitionKeyValue = formatIndexKey(statusPrefix, statusValue);
  const sortKeyStart = formatDateSortKey(datePrefix, dateRange.start);
  const sortKeyEnd = formatDateSortKey(datePrefix, dateRange.end + '\uffff');  // End of the day
  
  return getByGlobalIndex<T>(
    indexName,
    `${indexName}PK`,
    partitionKeyValue,
    {
      sortKeyName: `${indexName}SK`,
      sortKeyBetween: { start: sortKeyStart, end: sortKeyEnd },
      limit: options.limit,
      exclusiveStartKey: options.exclusiveStartKey,
      scanIndexForward: options.scanIndexForward,
    }
  );
};

/**
 * Create or update related items in a transaction
 * 
 * @param primaryItem - Main item to create/update
 * @param relatedItems - Array of related items
 * @returns Promise with the primary item
 */
export const createRelatedItems = async <T extends DynamoItem>(
  primaryItem: T,
  relatedItems: DynamoItem[]
): Promise<T> => {
  if (relatedItems.length === 0) {
    return putItem(primaryItem);
  }
  
  // Transactions have a maximum of 25 items
  if (relatedItems.length > 24) {
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      'Too many related items for a single transaction'
    );
  }
  
  await transactWriteItems([primaryItem, ...relatedItems]);
  return primaryItem;
};

/**
 * Check if an item exists by any key
 * 
 * @param key - The key to check
 * @returns Promise with boolean result
 */
export const itemExists = async (key: Record<string, any>): Promise<boolean> => {
  const item = await getItem(key);
  return item !== null;
};

/**
 * Query items by a date range on the base table
 * 
 * @param entityType - Entity type prefix
 * @param id - Entity ID
 * @param sortKeyPrefix - Prefix for the sort key
 * @param dateRange - Start and end dates in any format
 * @param options - Additional options
 * @returns Promise with query results
 */
export const getByDateRange = async <T extends DynamoItem>(
  entityType: EntityPrefix,
  id: string,
  sortKeyPrefix: string,
  dateRange: { start: string; end: string },
  options: {
    limit?: number;
    exclusiveStartKey?: Record<string, any>;
    scanIndexForward?: boolean;
  } = {}
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> => {
  const startKey = `${sortKeyPrefix}#${dateRange.start}`;
  const endKey = `${sortKeyPrefix}#${dateRange.end}\uffff`;  // End of the day
  
  return getAllByPartitionKey<T>(
    entityType,
    id,
    {
      sortKeyBetween: { start: startKey, end: endKey },
      limit: options.limit,
      exclusiveStartKey: options.exclusiveStartKey,
      scanIndexForward: options.scanIndexForward !== false,  // Default to ascending order
    }
  );
};
/**
 * Common DynamoDB operations
 */
import {
  PutCommand,
  PutCommandInput,
  GetCommandInput,
  GetCommand,
  QueryCommandInput,
  QueryCommand,
  UpdateCommand,
  UpdateCommandInput,
  DeleteCommandInput,
  DeleteCommand,
  TransactWriteCommandInput,
  TransactWriteCommand,
  BatchGetCommandInput,
  BatchGetCommand,
  BatchWriteCommandInput,
  BatchWriteCommand,
  ScanCommandInput,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './client';
import { DynamoKey, DynamoItem, PaginationResult } from './queryBuilder';
import { ApplicationError } from '../types';
import { ErrorCode } from '../constants';

/**
 * Put an item in DynamoDB
 * 
 * @param item - The item to put
 * @param tableName - Optional table name suffix
 * @returns The result of the operation
 */
export const putItem = async (
  item: DynamoItem,
  tableName?: string
): Promise<DynamoItem> => {
  const params: PutCommandInput = {
    TableName: getTableName(tableName),
    Item: item,
  };

  try {
    await docClient.send(new PutCommand(params));
    return item;
  } catch (error) {
    console.error('Error putting item:', error);
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      `Failed to write item to database: ${(error as Error).message}`
    );
  }
};

/**
 * Put multiple items in DynamoDB in a single transaction
 * 
 * @param items - Array of items to put
 * @param tableName - Optional table name suffix
 * @returns Result of the operation
 */
export const batchPutItems = async (
  items: DynamoItem[],
  tableName?: string
): Promise<void> => {
  if (items.length === 0) return;

  const tableFinalName = getTableName(tableName);
  
  // DynamoDB batch writes are limited to 25 items
  const chunkSize = 25;
  const chunks = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  try {
    for (const chunk of chunks) {
      const params: BatchWriteCommandInput = {
        RequestItems: {
          [tableFinalName]: chunk.map(item => ({
            PutRequest: {
              Item: item,
            },
          })),
        },
      };

      await docClient.send(new BatchWriteCommand(params));
    }
  } catch (error) {
    console.error('Error batch writing items:', error);
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      `Failed to batch write items to database: ${(error as Error).message}`
    );
  }
};

/**
 * Transaction to write multiple items atomically
 * 
 * @param items - Array of items to write
 * @param tableName - Optional table name suffix
 * @returns Result of the operation
 */
export const transactWriteItems = async (
  items: DynamoItem[],
  tableName?: string
): Promise<void> => {
  if (items.length === 0) return;
  if (items.length > 25) {
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      'Transaction can contain at most 25 items'
    );
  }

  const tableFinalName = getTableName(tableName);

  try {
    const params: TransactWriteCommandInput = {
      TransactItems: items.map(item => ({
        Put: {
          TableName: tableFinalName,
          Item: item,
        },
      })),
    };

    await docClient.send(new TransactWriteCommand(params));
  } catch (error) {
    console.error('Error in transaction write:', error);
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      `Failed to execute transaction: ${(error as Error).message}`
    );
  }
};

/**
 * Get a single item by key
 * 
 * @param key - The key of the item to get
 * @param tableName - Optional table name suffix
 * @returns The item or null if not found
 */
export const getItem = async <T extends DynamoItem>(
  key: DynamoKey,
  tableName?: string
): Promise<T | null> => {
  const params: GetCommandInput = {
    TableName: getTableName(tableName),
    Key: key,
  };

  try {
    const { Item } = await docClient.send(new GetCommand(params));
    return (Item as T) || null;
  } catch (error) {
    console.error('Error getting item:', error);
    throw new ApplicationError(
      ErrorCode.DB_QUERY_ERROR,
      `Failed to get item from database: ${(error as Error).message}`
    );
  }
};

/**
 * Get multiple items by keys
 * 
 * @param keys - Array of keys to get
 * @param tableName - Optional table name suffix
 * @returns Array of items found
 */
export const batchGetItems = async <T extends DynamoItem>(
  keys: DynamoKey[],
  tableName?: string
): Promise<T[]> => {
  if (keys.length === 0) return [];

  const tableFinalName = getTableName(tableName);
  const chunkSize = 100; // DynamoDB batch get limit
  const chunks = [];
  
  for (let i = 0; i < keys.length; i += chunkSize) {
    chunks.push(keys.slice(i, i + chunkSize));
  }

  try {
    const results: T[] = [];
    
    for (const chunk of chunks) {
      const params: BatchGetCommandInput = {
        RequestItems: {
          [tableFinalName]: {
            Keys: chunk,
          },
        },
      };

      const response = await docClient.send(new BatchGetCommand(params));
      
      if (response.Responses && response.Responses[tableFinalName]) {
        results.push(...(response.Responses[tableFinalName] as T[]));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error batch getting items:', error);
    throw new ApplicationError(
      ErrorCode.DB_QUERY_ERROR,
      `Failed to batch get items from database: ${(error as Error).message}`
    );
  }
};

/**
 * Update an item in DynamoDB
 * 
 * @param key - The key of the item to update
 * @param updates - Map of attribute paths to values
 * @param tableName - Optional table name suffix
 * @returns The updated item
 */
export const updateItem = async <T extends DynamoItem>(
  key: DynamoKey,
  updates: Record<string, any>,
  tableName?: string
): Promise<T> => {
  if (Object.keys(updates).length === 0) {
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      'No update expressions provided'
    );
  }

  // Build the update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  let count = 0

  Object.entries(updates).forEach(([path, value]) => {
    // Skip undefined values
    if (value === undefined) return;

    // Handle nested paths (e.g., "address.city")
    const parts = path.split('.');
    const attributePath = parts.map((part, i) => `#key${count+i}`).join('.');
    
    parts.forEach((part, i) => {
      expressionAttributeNames[`#key${count+i}`] = part;
    });

    const valuePlaceholder = `:${path.replace(/\./g, '_')}`;
    updateExpressions.push(`${attributePath} = ${valuePlaceholder}`);
    expressionAttributeValues[valuePlaceholder] = value;
    count = count + path.split('.').length
  });

  if (updateExpressions.length === 0) {
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      'No valid update expressions after filtering undefined values'
    );
  }

  const params: UpdateCommandInput = {
    TableName: getTableName(tableName),
    Key: key,
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  try {
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes as T;
  } catch (error) {
    console.error('Error updating item:', error);
    throw new ApplicationError(
      ErrorCode.DB_WRITE_ERROR,
      `Failed to update item: ${(error as Error).message}`
    );
  }
};

/**
 * Delete an item from DynamoDB
 * 
 * @param key - The key of the item to delete
 * @param tableName - Optional table name suffix
 * @returns True if the item was deleted, false if it didn't exist
 */
export const deleteItem = async (
  key: DynamoKey,
  tableName?: string
): Promise<boolean> => {
  const params: DeleteCommandInput = {
    TableName: getTableName(tableName),
    Key: key,
    ReturnValues: 'ALL_OLD',
  };

  try {
    const result = await docClient.send(new DeleteCommand(params));
    return !!result.Attributes;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw new ApplicationError(
      ErrorCode.DB_DELETE_ERROR,
      `Failed to delete item: ${(error as Error).message}`
    );
  }
};

/**
 * Execute a query against DynamoDB
 * 
 * @param params - Query parameters
 * @returns The query results with pagination token
 */
export const query = async <T extends DynamoItem>(
  params: Omit<QueryCommandInput, 'TableName'> & { TableName?: string }
): Promise<PaginationResult<T>> => {
  const queryParams: QueryCommandInput = {
    ...params,
    TableName: getTableName(params.TableName),
  };

  try {
    const result = await docClient.send(new QueryCommand(queryParams));
    
    return {
      items: (result.Items || []) as T[],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
      scannedCount: result.ScannedCount || 0,
    };
  } catch (error) {
    console.error('Error querying items:', error);
    throw new ApplicationError(
      ErrorCode.DB_QUERY_ERROR,
      `Failed to query items: ${(error as Error).message}`
    );
  }
};

/**
 * Execute a scan against DynamoDB
 * 
 * @param params - Scan parameters
 * @returns The scan results with pagination token
 */
export const scan = async <T extends DynamoItem>(
  params: Omit<ScanCommandInput, 'TableName'> & { TableName?: string }
): Promise<PaginationResult<T>> => {
  const scanParams: ScanCommandInput = {
    ...params,
    TableName: getTableName(params.TableName),
  };

  try {
    const result = await docClient.send(new ScanCommand(scanParams));
    
    return {
      items: (result.Items || []) as T[],
      lastEvaluatedKey: result.LastEvaluatedKey,
      count: result.Count || 0,
      scannedCount: result.ScannedCount || 0,
    };
  } catch (error) {
    console.error('Error scanning items:', error);
    throw new ApplicationError(
      ErrorCode.DB_QUERY_ERROR,
      `Failed to scan items: ${(error as Error).message}`
    );
  }
};
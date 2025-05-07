/**
 * Mock DynamoDB client for testing
 */
import { vi } from 'vitest';

// In-memory storage for DynamoDB mock
export const mockDb = {
  tables: new Map<string, any[]>(),
  reset() {
    this.tables.clear();
  },
  getTable(tableName: string) {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }
    return this.tables.get(tableName) as any[];
  }
};

// Mock DynamoDB client implementation
export const mockDynamoDBClient = {
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
};

// Mock DynamoDB Document client implementation
export const mockDynamoDBDocumentClient = {
  DynamoDBDocumentClient: {
    from: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockImplementation((command) => {
        if (command.constructor.name === 'PutCommand') {
          return mockImplementPutCommand(command);
        } else if (command.constructor.name === 'GetCommand') {
          return mockImplementGetCommand(command);
        } else if (command.constructor.name === 'UpdateCommand') {
          return mockImplementUpdateCommand(command);
        } else if (command.constructor.name === 'DeleteCommand') {
          return mockImplementDeleteCommand(command);
        } else if (command.constructor.name === 'QueryCommand') {
          return mockImplementQueryCommand(command);
        } else if (command.constructor.name === 'ScanCommand') {
          return mockImplementScanCommand(command);
        } else if (command.constructor.name === 'BatchWriteCommand') {
          return mockImplementBatchWriteCommand(command);
        } else if (command.constructor.name === 'BatchGetCommand') {
          return mockImplementBatchGetCommand(command);
        } else if (command.constructor.name === 'TransactWriteCommand') {
          return mockImplementTransactWriteCommand(command);
        }
        
        throw new Error(`Unimplemented command: ${command.constructor.name}`);
      })
    }))
  },
  PutCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'PutCommand' }
  })),
  GetCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'GetCommand' }
  })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'UpdateCommand' }
  })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'DeleteCommand' }
  })),
  QueryCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'QueryCommand' }
  })),
  ScanCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'ScanCommand' }
  })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'BatchWriteCommand' }
  })),
  BatchGetCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'BatchGetCommand' }
  })),
  TransactWriteCommand: vi.fn().mockImplementation((params) => ({
    ...params,
    constructor: { name: 'TransactWriteCommand' }
  }))
};

// Mock implementations for DynamoDB Document client commands
function mockImplementPutCommand(command: any) {
  const { TableName, Item } = command;
  const table = mockDb.getTable(TableName);
  
  // Check if item with the same key already exists
  const existingIndex = table.findIndex(item => 
    item.PK === Item.PK && item.SK === Item.SK
  );
  
  if (existingIndex >= 0) {
    table[existingIndex] = Item;
  } else {
    table.push(Item);
  }
  
  return { $metadata: { httpStatusCode: 200 } };
}

function mockImplementGetCommand(command: any) {
  const { TableName, Key } = command;
  const table = mockDb.getTable(TableName);
  
  const item = table.find(item => 
    item.PK === Key.PK && item.SK === Key.SK
  );
  
  return {
    $metadata: { httpStatusCode: 200 },
    Item: item
  };
}

function mockImplementUpdateCommand(command: any) {
  const { TableName, Key, UpdateExpression, ExpressionAttributeValues, ExpressionAttributeNames } = command;
  const table = mockDb.getTable(TableName);
  
  const existingIndex = table.findIndex(item => 
    item.PK === Key.PK && item.SK === Key.SK
  );
  
  if (existingIndex < 0) {
    return {
      $metadata: { httpStatusCode: 200 }
    };
  }
  
  // Very simplified UpdateExpression handling - just for testing
  if (UpdateExpression.includes('SET')) {
    const setExpressions = UpdateExpression
      .split('SET ')[1]
      .split(',')
      .map(expr => expr.trim());
    
    for (const expr of setExpressions) {
      const [attrPath, valueRef] = expr.split('=').map(e => e.trim());
      
      // Handle expression attribute names
      let resolvedPath = attrPath;
      if (ExpressionAttributeNames) {
        Object.entries(ExpressionAttributeNames).forEach(([key, value]) => {
          resolvedPath = resolvedPath.replace(key, value);
        });
      }
      
      if (valueRef.startsWith(':') && ExpressionAttributeValues[valueRef]) {
        const value = ExpressionAttributeValues[valueRef];
        
        // Handle nested attributes with dot notation (very simplified)
        if (resolvedPath.includes('.')) {
          const parts = resolvedPath.split('.');
          let current = table[existingIndex];
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }
          
          const lastPart = parts[parts.length - 1];
          current[lastPart] = value;
        } else {
          table[existingIndex][resolvedPath] = value;
        }
      }
    }
  }
  
  return {
    $metadata: { httpStatusCode: 200 },
    Attributes: table[existingIndex]
  };
}

function mockImplementDeleteCommand(command: any) {
  const { TableName, Key } = command;
  const table = mockDb.getTable(TableName);
  
  const existingIndex = table.findIndex(item => 
    item.PK === Key.PK && item.SK === Key.SK
  );
  
  if (existingIndex >= 0) {
    const removed = table.splice(existingIndex, 1)[0];
    return {
      $metadata: { httpStatusCode: 200 },
      Attributes: removed
    };
  }
  
  return {
    $metadata: { httpStatusCode: 200 }
  };
}

function mockImplementQueryCommand(command: any) {
  const { 
    TableName, 
    KeyConditionExpression, 
    ExpressionAttributeValues,
    ExpressionAttributeNames,
    IndexName,
    Limit,
    ExclusiveStartKey,
    ScanIndexForward = true,
    FilterExpression
  } = command;
  
  const table = mockDb.getTable(TableName);
  
  // Parse and apply key condition expression
  let filteredItems = [...table];
  
  if (KeyConditionExpression) {
    // Resolve expression attribute names
    let resolvedExpression = KeyConditionExpression;
    if (ExpressionAttributeNames) {
      Object.entries(ExpressionAttributeNames).forEach(([key, value]) => {
        resolvedExpression = resolvedExpression.replace(new RegExp(key, 'g'), value as string);
      });
    }
    
    // Handle PK conditions
    if (resolvedExpression.includes('PK = :PK') && ExpressionAttributeValues[':PK']) {
      const pkValue = ExpressionAttributeValues[':PK'];
      filteredItems = filteredItems.filter(item => item.PK === pkValue);
    }
    
    // Handle partition key conditions for GSIs
    if (IndexName && resolvedExpression.includes(`${IndexName}PK = :`)) {
      const match = resolvedExpression.match(new RegExp(`${IndexName}PK = :(\\w+)`));
      if (match && ExpressionAttributeValues[`:${match[1]}`]) {
        const pkValue = ExpressionAttributeValues[`:${match[1]}`];
        filteredItems = filteredItems.filter(item => item[`${IndexName}PK`] === pkValue);
      }
    }
    
    // Handle SK conditions
    if (resolvedExpression.includes('SK = :SK') && ExpressionAttributeValues[':SK']) {
      const skValue = ExpressionAttributeValues[':SK'];
      filteredItems = filteredItems.filter(item => item.SK === skValue);
    } 
    else if (resolvedExpression.includes('begins_with(SK, :') && resolvedExpression.match(/begins_with\(SK, :([^\)]+)\)/)) {
      const match = resolvedExpression.match(/begins_with\(SK, :([^\)]+)\)/);
      if (match && ExpressionAttributeValues[`:${match[1]}`]) {
        const prefix = ExpressionAttributeValues[`:${match[1]}`];
        filteredItems = filteredItems.filter(item => 
          typeof item.SK === 'string' && item.SK.startsWith(prefix)
        );
      }
    }
    else if (resolvedExpression.includes('SK BETWEEN :SK_start AND :SK_end')) {
      const startValue = ExpressionAttributeValues[':SK_start'];
      const endValue = ExpressionAttributeValues[':SK_end'];
      filteredItems = filteredItems.filter(item => 
        item.SK >= startValue && item.SK <= endValue
      );
    }
    
    // Handle sort key conditions for GSIs
    if (IndexName && resolvedExpression.includes(`${IndexName}SK`)) {
      // SK equality
      if (resolvedExpression.includes(`${IndexName}SK = :`)) {
        const match = resolvedExpression.match(new RegExp(`${IndexName}SK = :(\\w+)`));
        if (match && ExpressionAttributeValues[`:${match[1]}`]) {
          const skValue = ExpressionAttributeValues[`:${match[1]}`];
          filteredItems = filteredItems.filter(item => item[`${IndexName}SK`] === skValue);
        }
      }
      // begins_with on SK
      else if (resolvedExpression.includes(`begins_with(${IndexName}SK, :`)) {
        const match = resolvedExpression.match(new RegExp(`begins_with\\(${IndexName}SK, :(\\w+)\\)`));
        if (match && ExpressionAttributeValues[`:${match[1]}`]) {
          const prefix = ExpressionAttributeValues[`:${match[1]}`];
          filteredItems = filteredItems.filter(item => 
            typeof item[`${IndexName}SK`] === 'string' && item[`${IndexName}SK`].startsWith(prefix)
          );
        }
      }
      // between on SK
      else if (resolvedExpression.includes(`${IndexName}SK BETWEEN :`)) {
        const match = resolvedExpression.match(new RegExp(`${IndexName}SK BETWEEN :(\\w+) AND :(\\w+)`));
        if (match && 
            ExpressionAttributeValues[`:${match[1]}`] && 
            ExpressionAttributeValues[`:${match[2]}`]) {
          const startValue = ExpressionAttributeValues[`:${match[1]}`];
          const endValue = ExpressionAttributeValues[`:${match[2]}`];
          filteredItems = filteredItems.filter(item => 
            item[`${IndexName}SK`] >= startValue && item[`${IndexName}SK`] <= endValue
          );
        }
      }
    }
  }
  
  // Apply filter expression if present
  if (FilterExpression && ExpressionAttributeValues) {
    // This is a very simplified filter expression handler
    // In reality, you'd need a parser for complex expressions
    Object.entries(ExpressionAttributeValues).forEach(([key, value]) => {
      if (FilterExpression.includes(`${key}`)) {
        // Handle simple equality
        if (FilterExpression.includes(`= ${key}`)) {
          const attrMatch = FilterExpression.match(/(\w+) = /);
          if (attrMatch) {
            const attr = attrMatch[1];
            filteredItems = filteredItems.filter(item => item[attr] === value);
          }
        }
        // Handle greater than
        else if (FilterExpression.includes(`> ${key}`)) {
          const attrMatch = FilterExpression.match(/(\w+) > /);
          if (attrMatch) {
            const attr = attrMatch[1];
            filteredItems = filteredItems.filter(item => item[attr] > value);
          }
        }
        // Handle less than
        else if (FilterExpression.includes(`< ${key}`)) {
          const attrMatch = FilterExpression.match(/(\w+) < /);
          if (attrMatch) {
            const attr = attrMatch[1];
            filteredItems = filteredItems.filter(item => item[attr] < value);
          }
        }
      }
    });
  }
  
  // Determine sort key for sorting
  let sortKey = 'SK';
  if (IndexName) {
    sortKey = `${IndexName}SK`;
  }
  
  // Sort the results
  filteredItems.sort((a, b) => {
    if (!a[sortKey] || !b[sortKey]) return 0;
    return ScanIndexForward ? 
      (a[sortKey] > b[sortKey] ? 1 : -1) : 
      (a[sortKey] < b[sortKey] ? 1 : -1);
  });
  
  // Apply pagination
  let startIndex = 0;
  if (ExclusiveStartKey) {
    const keyStr = JSON.stringify(ExclusiveStartKey);
    startIndex = filteredItems.findIndex(item => {
      const itemKey = {};
      Object.keys(ExclusiveStartKey).forEach(key => {
        itemKey[key] = item[key];
      });
      return JSON.stringify(itemKey) === keyStr;
    });
    
    if (startIndex >= 0) {
      startIndex += 1; // Start after the last returned item
    } else {
      startIndex = 0;
    }
  }
  
  // Apply limit
  const limitedItems = Limit ? 
    filteredItems.slice(startIndex, startIndex + Limit) : 
    filteredItems.slice(startIndex);
  
  // Get last evaluated key for pagination
  let LastEvaluatedKey = undefined;
  if (Limit && startIndex + Limit < filteredItems.length) {
    const lastItem = limitedItems[limitedItems.length - 1];
    LastEvaluatedKey = {};
    if (ExclusiveStartKey) {
      // Use the same keys as in the ExclusiveStartKey
      Object.keys(ExclusiveStartKey).forEach(key => {
        LastEvaluatedKey[key] = lastItem[key];
      });
    } else {
      // Default keys
      LastEvaluatedKey.PK = lastItem.PK;
      LastEvaluatedKey.SK = lastItem.SK;
      if (IndexName) {
        LastEvaluatedKey[`${IndexName}PK`] = lastItem[`${IndexName}PK`];
        LastEvaluatedKey[`${IndexName}SK`] = lastItem[`${IndexName}SK`];
      }
    }
  }
  
  // Apply projection if specified
  const projectionExpression = command.ProjectionExpression;
  let projectedItems = limitedItems;
  
  if (projectionExpression) {
    projectedItems = limitedItems.map(item => {
      const projectedItem = { PK: item.PK, SK: item.SK };
      
      let expressions = projectionExpression.split(',').map(e => e.trim());
      
      // Resolve attribute names
      if (ExpressionAttributeNames) {
        expressions = expressions.map(expr => {
          let resolved = expr;
          Object.entries(ExpressionAttributeNames).forEach(([key, value]) => {
            resolved = resolved.replace(key, value as string);
          });
          return resolved;
        });
      }
      
      expressions.forEach(attr => {
        // This is a simplified approach - doesn't fully handle nested paths
        if (attr.includes('.')) {
          const [parent, child] = attr.split('.');
          if (item[parent]) {
            if (!projectedItem[parent]) projectedItem[parent] = {};
            projectedItem[parent][child] = item[parent][child];
          }
        } else {
          projectedItem[attr] = item[attr];
        }
      });
      
      return projectedItem;
    });
  }
  
  return {
    $metadata: { httpStatusCode: 200 },
    Items: projectedItems,
    Count: projectedItems.length,
    ScannedCount: filteredItems.length,
    LastEvaluatedKey
  };
}

function mockImplementScanCommand(command: any) {
  const { 
    TableName, 
    FilterExpression, 
    ExpressionAttributeValues,
    Limit,
    ExclusiveStartKey
  } = command;
  
  const table = mockDb.getTable(TableName);
  
  // Very simplified filter expression handling
  let filteredItems = [...table];
  if (FilterExpression && ExpressionAttributeValues) {
    Object.entries(ExpressionAttributeValues).forEach(([placeholder, value]) => {
      if (FilterExpression.includes(`= ${placeholder}`)) {
        const attrMatch = FilterExpression.match(/(\w+) = /);
        if (attrMatch) {
          const attr = attrMatch[1];
          filteredItems = filteredItems.filter(item => item[attr] === value);
        }
      }
    });
  }

  // Implement pagination
  let startIndex = 0;
  if (ExclusiveStartKey) {
    const startKeyStr = JSON.stringify(ExclusiveStartKey);
    startIndex = filteredItems.findIndex(item => {
      const itemKey = {};
      Object.keys(ExclusiveStartKey).forEach(key => {
        itemKey[key] = item[key];
      });
      return JSON.stringify(itemKey) === startKeyStr;
    });
    
    if (startIndex >= 0) {
      startIndex += 1; // Start after the last returned item
    } else {
      startIndex = 0;
    }
  }
  
  // Apply limit
  const limitedItems = Limit ? 
    filteredItems.slice(startIndex, startIndex + Limit) : 
    filteredItems.slice(startIndex);
  
  // Get last evaluated key for pagination
  let LastEvaluatedKey = undefined;
  if (Limit && startIndex + Limit < filteredItems.length) {
    const lastItem = limitedItems[limitedItems.length - 1];
    LastEvaluatedKey = {
      PK: lastItem.PK,
      SK: lastItem.SK
    };
  }
  
  return {
    $metadata: { httpStatusCode: 200 },
    Items: limitedItems,
    Count: limitedItems.length,
    ScannedCount: table.length,
    LastEvaluatedKey
  };
}

function mockImplementBatchWriteCommand(command: any) {
  const { RequestItems } = command;
  
  for (const [tableName, requests] of Object.entries(RequestItems)) {
    const table = mockDb.getTable(tableName);
    
    for (const request of requests as any[]) {
      if (request.PutRequest) {
        const { Item } = request.PutRequest;
        
        // Check if item with the same key already exists
        const existingIndex = table.findIndex(item => 
          item.PK === Item.PK && item.SK === Item.SK
        );
        
        if (existingIndex >= 0) {
          table[existingIndex] = Item;
        } else {
          table.push(Item);
        }
      } 
      else if (request.DeleteRequest) {
        const { Key } = request.DeleteRequest;
        
        const existingIndex = table.findIndex(item => 
          item.PK === Key.PK && item.SK === Key.SK
        );
        
        if (existingIndex >= 0) {
          table.splice(existingIndex, 1);
        }
      }
    }
  }
  
  return {
    $metadata: { httpStatusCode: 200 },
    UnprocessedItems: {}
  };
}

function mockImplementBatchGetCommand(command: any) {
  const { RequestItems } = command;
  const Responses = {};
  
  for (const [tableName, request] of Object.entries(RequestItems)) {
    const table = mockDb.getTable(tableName);
    Responses[tableName] = [];
    
    const keys = (request as any).Keys;
    for (const key of keys) {
      const item = table.find(item => 
        item.PK === key.PK && item.SK === key.SK
      );
      
      if (item) {
        Responses[tableName].push(item);
      }
    }
  }
  
  return {
    $metadata: { httpStatusCode: 200 },
    Responses,
    UnprocessedKeys: {}
  };
}

function mockImplementTransactWriteCommand(command: any) {
  const { TransactItems } = command;
  
  for (const item of TransactItems) {
    if (item.Put) {
      const { TableName, Item } = item.Put;
      const table = mockDb.getTable(TableName);
      
      // Check if item with the same key already exists
      const existingIndex = table.findIndex(i => 
        i.PK === Item.PK && i.SK === Item.SK
      );
      
      if (existingIndex >= 0) {
        table[existingIndex] = Item;
      } else {
        table.push(Item);
      }
    } 
    else if (item.Update) {
      const { TableName, Key, UpdateExpression, ExpressionAttributeValues } = item.Update;
      const table = mockDb.getTable(TableName);
      
      const existingIndex = table.findIndex(i => 
        i.PK === Key.PK && i.SK === Key.SK
      );
      
      if (existingIndex >= 0) {
        // Very simplified UpdateExpression handling
        if (UpdateExpression.includes('SET')) {
          const setExpressions = UpdateExpression
            .split('SET ')[1]
            .split(',')
            .map(expr => expr.trim());
          
          for (const expr of setExpressions) {
            const [attrPath, valueRef] = expr.split('=').map(e => e.trim());
            if (valueRef.startsWith(':')) {
              table[existingIndex][attrPath] = ExpressionAttributeValues[valueRef];
            }
          }
        }
      }
    } 
    else if (item.Delete) {
      const { TableName, Key } = item.Delete;
      const table = mockDb.getTable(TableName);
      
      const existingIndex = table.findIndex(i => 
        i.PK === Key.PK && i.SK === Key.SK
      );
      
      if (existingIndex >= 0) {
        table.splice(existingIndex, 1);
      }
    }
  }
  
  return {
    $metadata: { httpStatusCode: 200 }
  };
}
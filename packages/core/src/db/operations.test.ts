import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDb } from '../../test/mocks/dynamodb';
import { putItem, getItem, updateItem, deleteItem, query } from './operations';
import { ErrorCode } from '../constants';
import { ApplicationError } from '../types';

describe('DynamoDB operations', () => {
  beforeEach(() => {
    mockDb.reset()
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('putItem', () => {
    it('should add an item to the database', async () => {
      const item = {
        PK: 'USER#123',
        SK: '#METADATA',
        name: 'Test User',
        email: 'test@example.com'
      };

      await putItem(item);
      
      const table = mockDb.getTable(undefined);

      expect(table).toHaveLength(1);
      expect(table[0]).toEqual(item);
    });

    it('should update an existing item', async () => {
      const item = {
        PK: 'USER#123',
        SK: '#METADATA',
        name: 'Test User',
        email: 'test@example.com'
      };

      await putItem(item);
      
      const updatedItem = {
        ...item,
        name: 'Updated Name'
      };
      
      await putItem(updatedItem);
      
      const table = mockDb.getTable(undefined);
      expect(table).toHaveLength(1);
      expect(table[0]).toEqual(updatedItem);
    });
  });

  describe('getItem', () => {
    it('should retrieve an item by key', async () => {
      const item = {
        PK: 'USER#123',
        SK: '#METADATA',
        name: 'Test User',
        email: 'test@example.com'
      };

      await putItem(item);
      
      const result = await getItem({ PK: 'USER#123', SK: '#METADATA' });
      
      expect(result).toEqual(item);
    });

    it('should return null if item does not exist', async () => {
      const result = await getItem({ PK: 'NONEXISTENT', SK: 'NONEXISTENT' });
      expect(result).toBeNull();
    });
  });

  describe('updateItem', () => {
    it('should update an existing item', async () => {
      const item = {
        PK: 'USER#123',
        SK: '#METADATA',
        name: 'Test User',
        email: 'test@example.com',
        address: {
          city: 'Test City',
          country: 'Test Country'
        }
      };

      await putItem(item);
      
      const updates = {
        name: 'Updated Name',
        'address.city': 'New City'
      };
      
      const result = await updateItem({ PK: 'USER#123', SK: '#METADATA' }, updates);
      
      expect(result.name).toBe('Updated Name');
      expect(result.address.city).toBe('New City');
      expect(result.address.country).toBe('Test Country');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw an error for empty updates', async () => {
      await expect(updateItem({ PK: 'USER#123', SK: '#METADATA' }, {}))
        .rejects
        .toThrow(new ApplicationError(
          ErrorCode.DB_WRITE_ERROR,
          'No update expressions provided'
        ));
    });
  });

  describe('deleteItem', () => {
    it('should delete an item and return true', async () => {
      const item = {
        PK: 'USER#123',
        SK: '#METADATA',
        name: 'Test User'
      };

      await putItem(item);
      
      const result = await deleteItem({ PK: 'USER#123', SK: '#METADATA' });
      
      expect(result).toBe(true);
      
      const table = mockDb.getTable('RasikaTable');
      expect(table).toHaveLength(0);
    });

    it('should return false when deleting non-existent item', async () => {
      const result = await deleteItem({ PK: 'NONEXISTENT', SK: 'NONEXISTENT' });
      expect(result).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Set up test data
      await putItem({
        PK: 'USER#1',
        SK: '#METADATA',
        name: 'User 1',
        email: 'user1@example.com',
        GSI1PK: 'EMAIL#user1@example.com',
        GSI1SK: 'USER#1'
      });
      
      await putItem({
        PK: 'USER#1',
        SK: 'KARMA#2023-01-01',
        value: 10
      });
      
      await putItem({
        PK: 'USER#2',
        SK: '#METADATA',
        name: 'User 2',
        email: 'user2@example.com',
        GSI1PK: 'EMAIL#user2@example.com',
        GSI1SK: 'USER#2'
      });
    });

    it('should query items by partition key', async () => {
      const result = await query({
        KeyConditionExpression: 'PK = :PK',
        ExpressionAttributeValues: {
          ':PK': 'USER#1'
        }
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].PK).toBe('USER#1');
      expect(result.items[1].PK).toBe('USER#1');
    });

    it('should query items with begins_with condition', async () => {
      const result = await query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'USER#1',
          ':prefix': 'KARMA#'
        }
      });
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].SK).toBe('KARMA#2023-01-01');
    });

    it('should query using GSI', async () => {
      const result = await query({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'EMAIL#user1@example.com'
        }
      });
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe('user1@example.com');
    });
  });
});
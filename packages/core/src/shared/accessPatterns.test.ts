import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDb } from '../../test/mocks/dynamodb';
import { putItem } from '../db/operations';
import {
  getByPrimaryKey,
  getAllByPartitionKey,
  getByGlobalIndex,
  getByStatusAndDateRange,
  createRelatedItems,
  itemExists,
  getByDateRange
} from './accessPatterns';
import { EntityPrefix, SecondaryPrefix } from './singleTable';

describe('Access Patterns', () => {
  beforeEach(async () => {
    mockDb.reset();
    
    // Set up test data
    await Promise.all([
      // User primary data
      putItem({
        PK: 'USER#1',
        SK: '#METADATA',
        id: '1',
        name: 'Test User',
        email: 'user@example.com',
        GSI1PK: 'EMAIL#user@example.com',
        GSI1SK: 'USER#1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }),
      
      // User karma data
      putItem({
        PK: 'USER#1',
        SK: 'KARMA#2023-01-01',
        id: '1',
        value: 10,
        reason: 'Post upvoted',
        createdAt: '2023-01-01T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'USER#1',
        SK: 'KARMA#2023-01-02',
        id: '1',
        value: 15,
        reason: 'Comment accepted',
        createdAt: '2023-01-02T00:00:00.000Z'
      }),
      
      // Event data
      putItem({
        PK: 'EVENT#1',
        SK: '#METADATA',
        id: '1',
        title: 'Test Event',
        GSI1PK: 'STATUS#scheduled',
        GSI1SK: 'DATE#2023-01-15#EVENT#1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'EVENT#2',
        SK: '#METADATA',
        id: '2',
        title: 'Another Event',
        GSI1PK: 'STATUS#scheduled',
        GSI1SK: 'DATE#2023-01-20#EVENT#2',
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      })
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPrimaryKey', () => {
    it('should get an item by primary key', async () => {
      const user = await getByPrimaryKey(EntityPrefix.USER, '1');
      
      expect(user).toBeDefined();
      expect(user?.name).toBe('Test User');
      expect(user?.email).toBe('user@example.com');
    });

    it('should return null for non-existent items', async () => {
      const nonExistent = await getByPrimaryKey(EntityPrefix.USER, 'nonexistent');
      expect(nonExistent).toBeNull();
    });

    it('should get an item with custom sort key', async () => {
      const karma = await getByPrimaryKey(EntityPrefix.USER, '1', 'KARMA#2023-01-01');
      
      expect(karma).toBeDefined();
      expect(karma?.value).toBe(10);
      expect(karma?.reason).toBe('Post upvoted');
    });
  });

  describe('getAllByPartitionKey', () => {
    it('should get all items for a partition key', async () => {
      const result = await getAllByPartitionKey(EntityPrefix.USER, '1');
      
      expect(result.items).toHaveLength(3); // Metadata + 2 karma records
      expect(result.items[0].SK).toBe('#METADATA');
      expect(result.items[1].SK).toBe('KARMA#2023-01-01');
      expect(result.items[2].SK).toBe('KARMA#2023-01-02');
    });

    it('should filter by sort key prefix', async () => {
      const result = await getAllByPartitionKey(EntityPrefix.USER, '1', {
        sortKeyPrefix: 'KARMA#'
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].SK).toBe('KARMA#2023-01-01');
      expect(result.items[1].SK).toBe('KARMA#2023-01-02');
    });

    it('should filter by sort key range', async () => {
      const result = await getAllByPartitionKey(EntityPrefix.USER, '1', {
        sortKeyBetween: {
          start: 'KARMA#2023-01-01',
          end: 'KARMA#2023-01-01'
        }
      });
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].value).toBe(10);
    });

    it('should respect limit parameter', async () => {
      const result = await getAllByPartitionKey(EntityPrefix.USER, '1', {
        limit: 2
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.lastEvaluatedKey).toBeDefined();
    });

    it('should handle pagination with exclusive start key', async () => {
      const page1 = await getAllByPartitionKey(EntityPrefix.USER, '1', {
        limit: 2
      });
      
      expect(page1.items).toHaveLength(2);
      expect(page1.lastEvaluatedKey).toBeDefined();
      
      const page2 = await getAllByPartitionKey(EntityPrefix.USER, '1', {
        limit: 2,
        exclusiveStartKey: page1.lastEvaluatedKey
      });
      
      expect(page2.items).toHaveLength(1);
      expect(page2.lastEvaluatedKey).toBeUndefined();
    });
  });

  describe('getByGlobalIndex', () => {
    it('should get items by GSI1 partition key', async () => {
      const result = await getByGlobalIndex('GSI1', 'GSI1PK', 'EMAIL#user@example.com');
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Test User');
    });

    it('should get items by GSI1 with sort key', async () => {
      const result = await getByGlobalIndex(
        'GSI1',
        'GSI1PK',
        'STATUS#scheduled',
        {
          sortKeyName: 'GSI1SK',
          sortKeyValue: 'DATE#2023-01-15#EVENT#1'
        }
      );
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Test Event');
    });

    it('should get items by GSI1 with sort key prefix', async () => {
      const result = await getByGlobalIndex(
        'GSI1',
        'GSI1PK',
        'STATUS#scheduled',
        {
          sortKeyName: 'GSI1SK',
          sortKeyPrefix: 'DATE#2023-01'
        }
      );
      
      expect(result.items).toHaveLength(2);
    });

    it('should get items by GSI1 with sort key range', async () => {
      const result = await getByGlobalIndex(
        'GSI1',
        'GSI1PK',
        'STATUS#scheduled',
        {
          sortKeyName: 'GSI1SK',
          sortKeyBetween: {
            start: 'DATE#2023-01-15',
            end: 'DATE#2023-01-21'
          }
        }
      );      
      
      expect(result.items).toHaveLength(2);
    });
  });

  describe('getByStatusAndDateRange', () => {
    it('should get items by status and date range', async () => {
      const result = await getByStatusAndDateRange(
        'GSI1',
        'STATUS',
        'scheduled',
        'DATE',
        { start: '2023-01-01', end: '2023-01-31' }
      );
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Test Event');
      expect(result.items[1].title).toBe('Another Event');
    });

    it('should get items by status and specific date', async () => {
      const result = await getByStatusAndDateRange(
        'GSI1',
        'STATUS',
        'scheduled',
        'DATE',
        { start: '2023-01-15', end: '2023-01-15' }
      );
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Test Event');
    });
  });

  describe('createRelatedItems', () => {
    it('should create primary item without related items', async () => {
      const primaryItem = {
        PK: 'USER#new',
        SK: '#METADATA',
        id: 'new',
        name: 'New User',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };
      
      const result = await createRelatedItems(primaryItem, []);
      
      expect(result).toEqual(primaryItem);
      
      // Verify it was actually stored
      const stored = await getByPrimaryKey(EntityPrefix.USER, 'new');
      expect(stored).toEqual(primaryItem);
    });

    it('should create primary item with related items', async () => {
      const primaryItem = {
        PK: 'USER#new',
        SK: '#METADATA',
        id: 'new',
        name: 'New User',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };
      
      const relatedItem = {
        PK: 'USER#new',
        SK: 'KARMA#2023-01-01',
        id: 'new',
        value: 5,
        createdAt: '2023-01-01T00:00:00.000Z'
      };
      
      await createRelatedItems(primaryItem, [relatedItem]);
      
      // Verify both were stored
      const primary = await getByPrimaryKey(EntityPrefix.USER, 'new');
      expect(primary).toEqual(primaryItem);
      
      const related = await getByPrimaryKey(EntityPrefix.USER, 'new', 'KARMA#2023-01-01');
      expect(related).toEqual(relatedItem);
    });
  });

  describe('itemExists', () => {
    it('should return true for existing items', async () => {
      const exists = await itemExists({ PK: 'USER#1', SK: '#METADATA' });
      expect(exists).toBe(true);
    });

    it('should return false for non-existent items', async () => {
      const exists = await itemExists({ PK: 'USER#nonexistent', SK: '#METADATA' });
      expect(exists).toBe(false);
    });
  });

  describe('getByDateRange', () => {
    it('should get items by date range in sort key', async () => {
      const result = await getByDateRange(
        EntityPrefix.USER,
        '1',
        'KARMA',
        { start: '2023-01-01', end: '2023-01-31' }
      );
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].SK).toBe('KARMA#2023-01-01');
      expect(result.items[1].SK).toBe('KARMA#2023-01-02');
    });

    it('should get items by specific date in sort key', async () => {
      const result = await getByDateRange(
        EntityPrefix.USER,
        '1',
        'KARMA',
        { start: '2023-01-01', end: '2023-01-01' }
      );
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].SK).toBe('KARMA#2023-01-01');
    });
  });
});
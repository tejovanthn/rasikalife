import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDb } from '../../test/mocks/dynamodb';
import { createQuery } from './queryBuilder';
import { putItem } from './operations';

describe('QueryBuilder', () => {
  beforeEach(async () => {
    mockDb.reset();
    
    // Set up test data
    await Promise.all([
      putItem({
        PK: 'USER#1',
        SK: '#METADATA',
        name: 'User 1',
        email: 'user1@example.com',
        GSI1PK: 'EMAIL#user1@example.com',
        GSI1SK: 'USER#1',
        createdAt: '2023-01-01T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'USER#2',
        SK: '#METADATA',
        name: 'User 2',
        email: 'user2@example.com',
        GSI1PK: 'EMAIL#user2@example.com',
        GSI1SK: 'USER#2',
        createdAt: '2023-01-02T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'USER#1',
        SK: 'KARMA#2023-01-01',
        value: 10,
        reason: 'Post upvoted',
        createdAt: '2023-01-01T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'USER#1',
        SK: 'KARMA#2023-01-02',
        value: 15,
        reason: 'Comment accepted',
        createdAt: '2023-01-02T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'ARTIST#1',
        SK: '#METADATA',
        name: 'Artist 1',
        GSI1PK: 'ARTIST_NAME#Artist 1',
        GSI1SK: 'ARTIST#1',
        createdAt: '2023-01-01T00:00:00.000Z'
      }),
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should query by partition key', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .execute();
    
    expect(result.items).toHaveLength(3);
    expect(result.items[0].PK).toBe('USER#1');
    expect(result.items[1].PK).toBe('USER#1');
    expect(result.items[2].PK).toBe('USER#1');
  });

  it('should query by partition key and sort key', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKey('SK', '#METADATA')
      .execute();
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].SK).toBe('#METADATA');
    expect(result.items[0].name).toBe('User 1');
  });

  it('should query with begins_with condition', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKeyBeginsWith('SK', 'KARMA#')
      .execute();
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].SK).toContain('KARMA#');
    expect(result.items[1].SK).toContain('KARMA#');
  });

  it('should query with between condition', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKeyBetween('SK', 'KARMA#2023-01-01', 'KARMA#2023-01-02')
      .execute();
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].SK).toBe('KARMA#2023-01-01');
    expect(result.items[1].SK).toBe('KARMA#2023-01-02');
  });

  it('should query using an index', async () => {
    const result = await createQuery()
      .withIndex('GSI1')
      .withPartitionKey('GSI1PK', 'EMAIL#user1@example.com')
      .execute();
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe('user1@example.com');
  });

  it('should apply a filter', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKeyBeginsWith('SK', 'KARMA#')
      .withFilter('value', '>', 10)
      .execute();
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].value).toBe(15);
  });

  it('should limit the number of results', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withLimit(2)
      .execute();
    
    expect(result.items).toHaveLength(2);
  });

  it('should sort in descending order', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKeyBeginsWith('SK', 'KARMA#')
      .withSortOrder(false) // descending
      .execute();
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].SK).toBe('KARMA#2023-01-02');
    expect(result.items[1].SK).toBe('KARMA#2023-01-01');
  });

  it('should implement pagination', async () => {
    // First page
    const resultPage1 = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withLimit(2)
      .execute();
    
    expect(resultPage1.items).toHaveLength(2);
    expect(resultPage1.lastEvaluatedKey).toBeDefined();
    
    // Second page
    const resultPage2 = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withLimit(2)
      .withStartKey(resultPage1.lastEvaluatedKey!)
      .execute();
    
    expect(resultPage2.items).toHaveLength(1);
    expect(resultPage2.lastEvaluatedKey).toBeUndefined();
  });

  it('should handle executePaginated', async () => {
    // First page
    const resultPage1 = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .executePaginated({ limit: 2 });
    
    expect(resultPage1.items).toHaveLength(2);
    expect(resultPage1.lastEvaluatedKey).toBeDefined();
    
    // Second page
    const resultPage2 = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .executePaginated({ 
        limit: 2, 
        nextToken: resultPage1.lastEvaluatedKey as string
      });
    
    expect(resultPage2.items).toHaveLength(1);
    expect(resultPage2.lastEvaluatedKey).toBeUndefined();
  });

  it('should throw an error when no key condition is specified', async () => {
    await expect(createQuery().execute())
      .rejects
      .toThrow('No key condition specified for query');
  });

  it('should project specific attributes', async () => {
    const result = await createQuery()
      .withPartitionKey('PK', 'USER#1')
      .withSortKey('SK', '#METADATA')
      .withProjection(['name', 'email'])
      .execute();
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('User 1');
    expect(result.items[0].email).toBe('user1@example.com');
    // Other attributes should still be there in our mock,
    // but in a real projection they would be excluded
  });
});
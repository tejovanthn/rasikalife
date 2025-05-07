import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDb } from '../../test/mocks/dynamodb';
import { putItem } from '../db/operations';
import {
  basicSearch,
  createPrefixSearchTerm,
  scoreSearchResults
} from './search';

describe('Search Utilities', () => {
  beforeEach(async () => {
    mockDb.reset();
    
    // Set up test data
    await Promise.all([
      putItem({
        PK: 'USER#1',
        SK: '#METADATA',
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        bio: 'Software developer with experience in AWS',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'USER#2',
        SK: '#METADATA',
        id: '2',
        name: 'Jane Doe',
        email: 'jane@example.com',
        bio: 'Product manager with AWS certification',
        createdAt: '2023-01-02T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      }),
      
      putItem({
        PK: 'ARTIST#1',
        SK: '#METADATA',
        id: '1',
        name: 'John Legend',
        bio: 'Famous musician and singer',
        createdAt: '2023-01-03T00:00:00.000Z',
        updatedAt: '2023-01-03T00:00:00.000Z'
      })
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basicSearch', () => {
    it.todo('should find items matching the search term', async () => {
      const result = await basicSearch('John', {
        fields: ['name', 'bio']
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('John Smith');
      expect(result.items[1].name).toBe('John Legend');
    });

    it.todo('should find items case-insensitively', async () => {
      const result = await basicSearch('john', {
        fields: ['name']
      });
      
      expect(result.items).toHaveLength(2);
    });

    it('should apply additional filters', async () => {
      const result = await basicSearch('John', {
        fields: ['name', 'bio'],
        filters: { PK: 'USER#1' }
      });
      
      expect(result.items).toHaveLength(1);
      expect(result.items[0].PK).toBe('USER#1');
    });

    it('should respect pagination parameters', async () => {
      const result = await basicSearch('John', {
        fields: ['name', 'bio'],
        pagination: { limit: 1 }
      });
      
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBeDefined();
    });

    it('should return empty results for empty search term', async () => {
      const result = await basicSearch('', {
        fields: ['name', 'bio']
      });
      
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return empty results when fields array is empty', async () => {
      const result = await basicSearch('John', {
        fields: []
      });
      
      expect(result.items).toHaveLength(0);
    });
  });

  describe('createPrefixSearchTerm', () => {
    it('should trim and lowercase the search term', () => {
      expect(createPrefixSearchTerm('  Test Term  ')).toBe('test term');
    });
  });

  describe('scoreSearchResults', () => {
    it('should score and sort results based on relevance', () => {
      const items = [
        { id: '1', name: 'John Doe', title: 'Senior Developer' },
        { id: '2', name: 'Johnny Smith', title: 'Developer' },
        { id: '3', name: 'Jane Smith', title: 'John is the manager' },
        { id: '4', name: 'Bob Johnson', title: 'Works with John' }
      ];
      
      const fields = [
        { name: 'name', weight: 2 },
        { name: 'title', weight: 1 }
      ];
      
      const scored = scoreSearchResults(items, 'john', fields);
      
      // First result should be exact match "John Doe"
      expect(scored[0].id).toBe('1');
      
      // Second should be name starting with "John"
      expect(scored[1].id).toBe('2');
      
      // Third should be title containing "John"
      expect(scored[2].id).toBe('4');
      
      // Fourth should be title containing "John" but not at word boundary
      expect(scored[3].id).toBe('3');
    });

    it('should handle nested properties using dot notation', () => {
      const items = [
        { id: '1', profile: { name: 'John Doe' } },
        { id: '2', profile: { name: 'Jane Smith' } }
      ];
      
      const fields = [
        { name: 'profile.name', weight: 1 }
      ];
      
      const scored = scoreSearchResults(items, 'john', fields);
      
      expect(scored[0].id).toBe('1');
      expect(scored[1].id).toBe('2');
    });
  });
});
import { describe, it, expect } from 'vitest';
import {
  normalizePaginationParams,
  createNextToken,
  parseNextToken,
  createPaginatedResponse,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE
} from './pagination';

describe('Pagination Utilities', () => {
  describe('normalizePaginationParams', () => {
    it('should use default values when no params provided', () => {
      const normalized = normalizePaginationParams();
      
      expect(normalized.limit).toBe(DEFAULT_PAGE_SIZE);
      expect(normalized.nextToken).toBeUndefined();
    });

    it('should cap the limit to MAX_PAGE_SIZE', () => {
      const normalized = normalizePaginationParams({ limit: MAX_PAGE_SIZE + 100 });
      
      expect(normalized.limit).toBe(MAX_PAGE_SIZE);
    });

    it('should ensure minimum limit of 1', () => {
      const normalized = normalizePaginationParams({ limit: -5 });
      
      expect(normalized.limit).toBe(1);
    });

    it('should pass through valid values', () => {
      const normalized = normalizePaginationParams({
        limit: 25,
        nextToken: 'test-token'
      });
      
      expect(normalized.limit).toBe(25);
      expect(normalized.nextToken).toBe('test-token');
    });
  });

  describe('createNextToken', () => {
    it('should create a base64 token from an object', () => {
      const key = { PK: 'USER#123', SK: '#METADATA' };
      const token = createNextToken(key);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify it can be decoded back
      const decoded = JSON.parse(Buffer.from(token!, 'base64').toString());
      expect(decoded).toEqual(key);
    });

    it('should return undefined for undefined input', () => {
      const token = createNextToken(undefined);
      expect(token).toBeUndefined();
    });
  });

  describe('parseNextToken', () => {
    it('should parse a valid token back to an object', () => {
      const original = { PK: 'USER#123', SK: '#METADATA' };
      const token = Buffer.from(JSON.stringify(original)).toString('base64');
      
      const parsed = parseNextToken(token);
      expect(parsed).toEqual(original);
    });

    it('should return undefined for undefined input', () => {
      const parsed = parseNextToken(undefined);
      expect(parsed).toBeUndefined();
    });

    it('should throw for invalid tokens', () => {
      expect(() => parseNextToken('not-base64')).toThrow();
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create a paginated response with next token', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const lastKey = { PK: 'ITEM#2', SK: '#METADATA' };
      
      const response = createPaginatedResponse(items, lastKey);
      
      expect(response.items).toEqual(items);
      expect(response.nextToken).toBeDefined();
      expect(response.hasMore).toBe(true);
    });

    it('should create a paginated response without next token', () => {
      const items = [{ id: '1' }, { id: '2' }];
      
      const response = createPaginatedResponse(items);
      
      expect(response.items).toEqual(items);
      expect(response.nextToken).toBeUndefined();
      expect(response.hasMore).toBe(false);
    });
  });
});
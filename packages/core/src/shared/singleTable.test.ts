import { describe, it, expect, vi } from 'vitest';
import {
  formatKey,
  formatDateSortKey,
  formatVersionKey,
  createBaseItem,
  createCompositeId,
  formatIndexKey,
  extractIdFromKey,
  addUpdateTimestamp,
  EntityPrefix,
  SecondaryPrefix,
} from './singleTable';

describe('Single Table Utilities', () => {
  it('should format keys correctly', () => {
    expect(formatKey(EntityPrefix.USER, '123')).toBe('USER#123');
    expect(formatKey('CUSTOM', 'abc')).toBe('CUSTOM#abc');
  });

  it('should format date sort keys correctly', () => {
    expect(formatDateSortKey(SecondaryPrefix.DATE, '2023-01-01')).toBe('DATE#2023-01-01');

    expect(formatDateSortKey(SecondaryPrefix.DATE, '2023-01-01', 'ITEM#123')).toBe(
      'DATE#2023-01-01#ITEM#123'
    );
  });

  it('should format version keys correctly', () => {
    expect(formatVersionKey('v1')).toBe('VERSION#v1');
    expect(formatVersionKey('v1', '2023-01-01T00:00:00.000Z')).toBe(
      'VERSION#v1#2023-01-01T00:00:00.000Z'
    );
  });

  it('should create a base item with generated ID', async () => {
    const item = await createBaseItem(EntityPrefix.USER);

    expect(item.PK).toMatch(/^USER#.+/);
    expect(item.SK).toBe('#METADATA');
    expect(item.id).toBeDefined();
    expect(item.createdAt).toBe('2025-01-15T12:00:00.000Z'); // From mock
    expect(item.updatedAt).toBe('2025-01-15T12:00:00.000Z'); // From mock
  });

  it('should create a base item with provided ID', async () => {
    const item = await createBaseItem(EntityPrefix.USER, '123');

    expect(item.PK).toBe('USER#123');
    expect(item.SK).toBe('#METADATA');
    expect(item.id).toBe('123');
  });

  it('should create a base item with custom sort key', async () => {
    const item = await createBaseItem(EntityPrefix.USER, '123', 'PROFILE');

    expect(item.PK).toBe('USER#123');
    expect(item.SK).toBe('PROFILE');
    expect(item.id).toBe('123');
  });

  it('should create composite IDs', () => {
    expect(createCompositeId(['USER', '123', 'POST', '456'])).toBe('USER_123_POST_456');
  });

  it('should format index keys', () => {
    expect(formatIndexKey('EMAIL', 'test@example.com')).toBe('EMAIL#test@example.com');
  });

  it('should extract IDs from keys', () => {
    expect(extractIdFromKey('USER#123')).toBe('123');
    expect(extractIdFromKey('ARTIST#abc-def')).toBe('abc-def');
  });

  it('should add update timestamp', () => {
    const item = { id: '123', name: 'Test' };
    const updated = addUpdateTimestamp(item);

    expect(updated.id).toBe('123');
    expect(updated.name).toBe('Test');
    expect(updated.updatedAt).toBe('2025-01-15T12:00:00.000Z'); // From mock
  });
});

import { describe, expect, it } from 'vitest';
import { computeEditDiff, formatValue } from './diff';

describe('computeEditDiff', () => {
  it('returns empty diff when nothing changed', () => {
    const before = { name: 'Alice', age: 30 };
    const after = { name: 'Alice', age: 30 };

    expect(computeEditDiff(before, after)).toEqual([]);
  });

  it('captures a single changed field', () => {
    const before = { name: 'Alice', age: 30 };
    const after = { name: 'Alice', age: 31 };

    expect(computeEditDiff(before, after)).toEqual([{ field: 'age', oldValue: 30, newValue: 31 }]);
  });

  it('captures multiple changed fields', () => {
    const before = { name: 'Alice', age: 30, city: 'Chennai' };
    const after = { name: 'Bob', age: 31, city: 'Chennai' };

    const diff = computeEditDiff(before, after);
    expect(diff).toHaveLength(2);
    expect(diff).toContainEqual({ field: 'name', oldValue: 'Alice', newValue: 'Bob' });
    expect(diff).toContainEqual({ field: 'age', oldValue: 30, newValue: 31 });
  });

  it('treats a field newly present in after (absent in before) as a change', () => {
    const before = { name: 'Alice' };
    const after = { name: 'Alice', nickname: 'Al' };

    expect(computeEditDiff(before, after)).toEqual([
      { field: 'nickname', oldValue: undefined, newValue: 'Al' },
    ]);
  });

  it('does not report fields present in before but absent from after', () => {
    // computeEditDiff only iterates Object.keys(after), so a field dropped entirely
    // from the "after" object is invisible to the diff even though it changed.
    const before = { name: 'Alice', nickname: 'Al' };
    const after = { name: 'Alice' };

    expect(computeEditDiff(before, after)).toEqual([]);
  });

  it('treats deep-equal objects with different key order as changed (JSON.stringify is key-order sensitive)', () => {
    const before = { address: { city: 'Chennai', state: 'TN' } };
    const after = { address: { state: 'TN', city: 'Chennai' } };

    // Same data, different insertion order -> flagged as a diff because comparison
    // is via JSON.stringify rather than a deep-equality check.
    expect(computeEditDiff(before, after)).toEqual([
      {
        field: 'address',
        oldValue: { city: 'Chennai', state: 'TN' },
        newValue: { state: 'TN', city: 'Chennai' },
      },
    ]);
  });

  it('detects array element changes', () => {
    const before = { tags: ['a', 'b'] };
    const after = { tags: ['a', 'c'] };

    expect(computeEditDiff(before, after)).toEqual([
      { field: 'tags', oldValue: ['a', 'b'], newValue: ['a', 'c'] },
    ]);
  });

  it('handles empty before object (create-like diff)', () => {
    const after = { name: 'Alice', age: 30 };

    const diff = computeEditDiff({}, after);
    expect(diff).toContainEqual({ field: 'name', oldValue: undefined, newValue: 'Alice' });
    expect(diff).toContainEqual({ field: 'age', oldValue: undefined, newValue: 30 });
  });
});

describe('formatValue', () => {
  it('formats null and undefined as (empty)', () => {
    expect(formatValue(null)).toBe('(empty)');
    expect(formatValue(undefined)).toBe('(empty)');
  });

  it('formats an empty array as (empty)', () => {
    expect(formatValue([])).toBe('(empty)');
  });

  it('formats an array of named objects by joining their names', () => {
    expect(formatValue([{ name: 'Alice' }, { name: 'Bob' }])).toBe('Alice, Bob');
  });

  it('formats an array of strings as a count', () => {
    expect(formatValue(['a', 'b', 'c'])).toBe('3 items');
  });

  it('uses singular "item" for a single-string array', () => {
    expect(formatValue(['a'])).toBe('1 item');
  });

  it('falls back to JSON for a mixed-type array', () => {
    const value = [1, 'two', { name: 'three' }];
    expect(formatValue(value)).toBe(JSON.stringify(value, null, 2));
  });

  it('formats an object with a name property as the name', () => {
    expect(formatValue({ name: 'Hamsadhwani', id: 'raga1' })).toBe('Hamsadhwani');
  });

  it('formats a short plain object as JSON', () => {
    const value = { a: 1, b: 2 };
    expect(formatValue(value)).toBe(JSON.stringify(value, null, 2));
  });

  it('truncates a long plain object to 100 characters plus ellipsis', () => {
    const value = { description: 'x'.repeat(200) };
    const result = formatValue(value);

    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBe(103);
    expect(result.startsWith(JSON.stringify(value, null, 2).substring(0, 100))).toBe(true);
  });

  it('formats primitives via String()', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(true)).toBe('true');
    expect(formatValue('plain string')).toBe('plain string');
  });
});

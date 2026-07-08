import { describe, expect, it } from 'vitest';
import { createNameOnlySchema, updateNameOnlySchema } from './schema-utils';

describe('createNameOnlySchema', () => {
  it('accepts a non-empty name within the length limit', () => {
    expect(createNameOnlySchema.parse({ name: 'Adi' })).toEqual({ name: 'Adi' });
  });

  it('rejects an empty name', () => {
    expect(() => createNameOnlySchema.parse({ name: '' })).toThrow();
  });

  it('rejects a name over 100 characters', () => {
    expect(() => createNameOnlySchema.parse({ name: 'a'.repeat(101) })).toThrow();
  });

  it('rejects a missing name', () => {
    expect(() => createNameOnlySchema.parse({})).toThrow();
  });
});

describe('updateNameOnlySchema', () => {
  it('allows an empty object since all fields are optional', () => {
    expect(updateNameOnlySchema.parse({})).toEqual({});
  });

  it('still validates name length when provided', () => {
    expect(() => updateNameOnlySchema.parse({ name: 'a'.repeat(101) })).toThrow();
  });
});

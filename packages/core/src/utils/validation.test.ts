import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createStringSchema,
  emailSchema,
  usernameSchema,
  passwordSchema,
  dateStringSchema,
  isoDateStringSchema,
  createArraySchema,
  socialLinksSchema,
  locationSchema,
} from './validation';

describe('Validation utilities', () => {
  describe('createStringSchema', () => {
    it('creates a required string schema by default', () => {
      const schema = createStringSchema();
      expect(() => schema.parse('')).toThrow();
      expect(() => schema.parse(undefined)).toThrow();
      expect(schema.parse('hello')).toBe('hello');
    });

    it('trims input by default', () => {
      const schema = createStringSchema();
      expect(schema.parse('  hello  ')).toBe('hello');
    });

    it('respects min length constraints', () => {
      const schema = createStringSchema({ minLength: 3 });
      expect(() => schema.parse('hi')).toThrow();
      expect(schema.parse('hello')).toBe('hello');
    });

    it('respects max length constraints', () => {
      const schema = createStringSchema({ maxLength: 5 });
      expect(() => schema.parse('too long')).toThrow();
      expect(schema.parse('hello')).toBe('hello');
    });

    it('can be optional', () => {
      const schema = createStringSchema({ required: false });
      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse('hello')).toBe('hello');
    });
  });

  describe('emailSchema', () => {
    it('validates email format', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
      expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
    });

    it('trims and lowercases email', () => {
      expect(emailSchema.parse('  User@Example.COM  ')).toBe('user@example.com');
    });
  });

  describe('usernameSchema', () => {
    it('validates username format', () => {
      expect(() => usernameSchema.parse('user name')).toThrow(); // Contains space
      expect(() => usernameSchema.parse('user@name')).toThrow(); // Contains special character
      expect(usernameSchema.parse('username123')).toBe('username123');
      expect(usernameSchema.parse('user_name')).toBe('user_name');
    });

    it('enforces length constraints', () => {
      expect(() => usernameSchema.parse('ab')).toThrow(); // Too short
      expect(() => usernameSchema.parse('a'.repeat(31))).toThrow(); // Too long
      expect(usernameSchema.parse('valid_username')).toBe('valid_username');
    });
  });

  describe('passwordSchema', () => {
    it('validates password strength', () => {
      expect(() => passwordSchema.parse('weak')).toThrow(); // Too short
      expect(() => passwordSchema.parse('onlyletters')).toThrow(); // No numbers or symbols
      expect(() => passwordSchema.parse('12345678')).toThrow(); // No letters or symbols
      expect(passwordSchema.parse('Strong1!')).toBe('Strong1!');
    });
  });

  describe('dateStringSchema', () => {
    it('validates date format', () => {
      expect(() => dateStringSchema.parse('not-a-date')).toThrow();
      expect(dateStringSchema.parse('2025-01-15')).toBe('2025-01-15');
      expect(dateStringSchema.parse('2025-01-15T12:00:00.000Z')).toBe('2025-01-15T12:00:00.000Z');
    });
  });

  describe('isoDateStringSchema', () => {
    it('validates ISO date format strictly', () => {
      expect(() => isoDateStringSchema.parse('2025-01-15')).toThrow(); // Not ISO format
      expect(() => isoDateStringSchema.parse('2025-01-15T12:00:00')).toThrow(); // Missing milliseconds and Z
      expect(isoDateStringSchema.parse('2025-01-15T12:00:00.000Z')).toBe(
        '2025-01-15T12:00:00.000Z'
      );
    });
  });

  describe('createArraySchema', () => {
    const stringSchema = z.string();

    it('creates a required array schema by default', () => {
      const schema = createArraySchema(stringSchema);
      expect(() => schema.parse(undefined)).toThrow();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('can require non-empty arrays', () => {
      const schema = createArraySchema(stringSchema, { nonEmpty: true });
      expect(() => schema.parse([])).toThrow();
      expect(schema.parse(['a'])).toEqual(['a']);
    });

    it('respects min items constraint', () => {
      const schema = createArraySchema(stringSchema, { minItems: 2 });
      expect(() => schema.parse(['a'])).toThrow();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('respects max items constraint', () => {
      const schema = createArraySchema(stringSchema, { maxItems: 2 });
      expect(() => schema.parse(['a', 'b', 'c'])).toThrow();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('can enforce uniqueness', () => {
      const schema = createArraySchema(stringSchema, { unique: true });
      expect(() => schema.parse(['a', 'a'])).toThrow();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('can be optional', () => {
      const schema = createArraySchema(stringSchema, { required: false });
      expect(schema.parse(undefined)).toBeUndefined();
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
    });
  });

  describe('socialLinksSchema', () => {
    it('validates social links', () => {
      expect(() =>
        socialLinksSchema.parse({
          website: 'not-a-url',
        })
      ).toThrow();

      expect(
        socialLinksSchema.parse({
          website: 'https://example.com',
          youtube: 'https://youtube.com/channel/123',
        })
      ).toEqual({
        website: 'https://example.com',
        youtube: 'https://youtube.com/channel/123',
      });

      // Optional
      expect(socialLinksSchema.parse(undefined)).toBeUndefined();
    });
  });

  describe('locationSchema', () => {
    it('validates location data', () => {
      expect(() =>
        locationSchema.parse({
          // Missing required country
          city: 'Mumbai',
        })
      ).toThrow();

      expect(
        locationSchema.parse({
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
        })
      ).toEqual({
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
      });

      expect(() =>
        locationSchema.parse({
          country: 'India',
          coordinates: {
            latitude: 100, // Invalid latitude (>90)
            longitude: 75,
          },
        })
      ).toThrow();

      expect(
        locationSchema.parse({
          country: 'India',
          coordinates: {
            latitude: 19.076,
            longitude: 72.877,
          },
        })
      ).toEqual({
        country: 'India',
        coordinates: {
          latitude: 19.076,
          longitude: 72.877,
        },
      });
    });
  });
});

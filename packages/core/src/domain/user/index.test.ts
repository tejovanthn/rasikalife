import { describe, expect, it } from 'vitest';
import { CreateUserSchema, UpdateUserSchema } from './schema';

describe('User Domain', () => {
  describe('Schema Validation', () => {
    it('should validate create user input', () => {
      const validInput = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        googleId: 'google_123',
      };

      const result = CreateUserSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidInput = {
        id: 'user_123',
        email: 'invalid-email',
        name: 'Test User',
        googleId: 'google_123',
      };

      const result = CreateUserSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate update user input', () => {
      const updateInput = {
        name: 'Updated Name',
        picture: 'https://example.com/new-avatar.jpg',
      };

      const result = UpdateUserSchema.safeParse(updateInput);
      expect(result.success).toBe(true);
    });

    it('should accept empty update input', () => {
      const emptyInput = {};

      const result = UpdateUserSchema.safeParse(emptyInput);
      expect(result.success).toBe(true);
    });
  });
});

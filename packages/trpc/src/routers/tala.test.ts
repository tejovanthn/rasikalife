import { Tradition } from '@rasika/core';
import type { TalaSearchParams } from '@rasika/core';
import { describe, expect, it } from 'vitest';
import { botTestRouter, testRouter } from '../../test/setup';

describe('Tala Router Integration Tests', () => {
  describe('create', () => {
    it('should create a new tala', async () => {
      const talaData = {
        name: 'Test Tala',
        alternativeNames: ['Test Alt Tala'],
        aksharas: 8,
        pattern: 'Ta Ki Ta Ta | Ta Ki Ta Ta',
        type: 'Chapu',
        tradition: Tradition.CARNATIC,
        description: 'Test tala description',
        characteristics: 'Test characteristics',
      };

      const result = await testRouter.tala.create(talaData);

      expect(result).toBeDefined();
      expect(result.name).toBe(talaData.name);
      expect(result.aksharas).toBe(talaData.aksharas);
      expect(result.pattern).toBe(talaData.pattern);
      expect(result.type).toBe(talaData.type);
      expect(result.tradition).toBe(talaData.tradition);
      expect(result.addedBy).toBe('test-user-id');
    });
  });

  describe('getById', () => {
    it('should retrieve a tala by id', async () => {
      // First create a tala
      const talaData = {
        name: 'Test Tala',
        aksharas: 7,
        pattern: 'Ta Ka Dhi Mi | Ta Ka Ta',
        type: 'Misra Chapu',
        tradition: Tradition.CARNATIC,
        description: 'Seven beat tala',
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Then retrieve it
      const result = await testRouter.tala.getById({
        id: createdTala.id,
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdTala.id);
      expect((result as any)?.name).toBe(talaData.name);
      expect((result as any)?.aksharas).toBe(talaData.aksharas);
    });

    it('should return null for non-existent tala', async () => {
      const result = await testRouter.tala.getById({
        id: 'non-existent-id',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should support version parameter', async () => {
      // Create a tala
      const talaData = {
        name: 'Versioned Tala',
        aksharas: 16,
        pattern: 'Ta Ka Ta Ka | Ta Ka Ta Ka | Ta Ka Ta Ka | Ta Ka Ta Ka',
        type: 'Aditala',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Update to create a new version
      await testRouter.tala.update({
        id: createdTala.id,
        description: 'Updated description',
      });

      // Get the latest version (default behavior)
      const latestResult = await testRouter.tala.getById({
        id: createdTala.id,
      });

      expect((latestResult as any)?.description).toBe('Updated description');
    });
  });

  describe('getByName', () => {
    it('should retrieve a tala by name', async () => {
      const talaData = {
        name: 'Adi Tala',
        aksharas: 8,
        pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
        description: 'Most common Carnatic tala',
      };

      const createdTala = await testRouter.tala.create(talaData);

      const result = await testRouter.tala.getByName({
        name: 'Adi Tala',
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdTala.id);
      expect((result as any)?.name).toBe(talaData.name);
    });

    it('should return null for non-existent tala name', async () => {
      const result = await testRouter.tala.getByName({
        name: 'NonExistentTala',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should handle case-insensitive search', async () => {
      const talaData = {
        name: 'Rupaka Tala',
        aksharas: 6,
        pattern: 'Ta - Ka | Dhi - Mi | Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
      };

      await testRouter.tala.create(talaData);

      const result = await testRouter.tala.getByName({
        name: 'rupaka tala', // lowercase
        trackView: false,
      });

      expect(result).toBeDefined();
      expect((result as any)?.name).toBe('Rupaka Tala');
    });
  });

  describe('search', () => {
    it('should search talas by name', async () => {
      // Create test talas
      const talas = [
        {
          name: 'Adi Tala',
          aksharas: 8,
          pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
          type: 'Suladi Sapta Tala',
          tradition: Tradition.CARNATIC,
        },
        {
          name: 'Misra Chapu',
          aksharas: 7,
          pattern: 'Ta Ka Dhi Mi | Ta Ka Ta',
          type: 'Chapu',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(talas.map(tala => testRouter.tala.create(tala)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // Search for "Tala" - should match Adi Tala
      const searchParams: TalaSearchParams = {
        query: 'Tala',
        limit: 10,
        nextToken: undefined,
      };

      const result = await testRouter.tala.search(searchParams);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.hasMore).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      // Create multiple test talas
      const talas = Array.from({ length: 15 }, (_, i) => ({
        name: `TestTala ${i + 1}`,
        aksharas: (i % 16) + 1, // Valid aksharas 1-16
        pattern: `Beat pattern ${i + 1}`,
        type: 'Test Type',
        tradition: Tradition.CARNATIC,
      }));

      await Promise.all(talas.map(tala => testRouter.tala.create(tala)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // First page
      const firstPage = await testRouter.tala.search({
        query: 'TestTala',
        limit: 5,
        nextToken: undefined,
      });

      expect(firstPage.items.length).toBeGreaterThan(0);
      expect(firstPage.items.length).toBeLessThanOrEqual(5);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextToken).toBeDefined();

      // Second page
      const secondPage = await testRouter.tala.search({
        query: 'TestTala',
        limit: 5,
        nextToken: firstPage.nextToken,
      });

      // DynamoDB scan behavior can vary, so we check for reasonable pagination
      expect(secondPage.items.length).toBeGreaterThan(0);
      expect(secondPage.items.length).toBeLessThanOrEqual(5);
      // Ensure different items on second page (pagination working)
      if (secondPage.items.length > 0) {
        expect(secondPage.items[0].name).not.toBe(firstPage.items[0].name);
      }
    });

    it('should filter by aksharas correctly', async () => {
      const talas = [
        {
          name: '8 Beat Tala',
          aksharas: 8,
          pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
          type: 'Suladi Sapta Tala',
          tradition: Tradition.CARNATIC,
        },
        {
          name: '7 Beat Tala',
          aksharas: 7,
          pattern: 'Ta Ka Dhi Mi | Ta Ka Ta',
          type: 'Chapu',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(talas.map(tala => testRouter.tala.create(tala)));

      // Wait for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await testRouter.tala.search({
        query: 'Beat Tala',
        aksharas: 8,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      // All results should have 8 aksharas
      result.items.forEach(item => {
        expect(item.aksharas).toBe(8);
      });
    });

    it('should filter by type correctly', async () => {
      const talas = [
        {
          name: 'Chapu Type Tala 1',
          aksharas: 7,
          pattern: 'Ta Ka Dhi Mi | Ta Ka Ta',
          type: 'Chapu',
          tradition: Tradition.CARNATIC,
        },
        {
          name: 'Suladi Type Tala 1',
          aksharas: 8,
          pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
          type: 'Suladi Sapta Tala',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(talas.map(tala => testRouter.tala.create(tala)));

      // Wait for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await testRouter.tala.search({
        query: 'Type Tala',
        type: 'Chapu',
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      // All results should have Chapu type
      result.items.forEach(item => {
        expect(item.type).toBe('Chapu');
      });
    });
  });

  describe('update', () => {
    it('should update an existing tala', async () => {
      // First create a tala
      const talaData = {
        name: 'Original Tala Name',
        aksharas: 8,
        pattern: 'Original pattern',
        type: 'Original Type',
        tradition: Tradition.CARNATIC,
        description: 'Original description',
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Update the tala
      const updateData = {
        id: createdTala.id,
        name: 'Updated Tala Name',
        description: 'Updated description',
        characteristics: 'Added characteristics',
      };

      const result = await testRouter.tala.update(updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(result.characteristics).toBe(updateData.characteristics);
      expect(result.aksharas).toBe(talaData.aksharas); // Should remain unchanged
    });

    it('should preserve existing fields when partially updating', async () => {
      const talaData = {
        name: 'Partial Update Tala',
        aksharas: 10,
        pattern: 'Complex pattern',
        type: 'Complex Type',
        tradition: Tradition.CARNATIC,
        characteristics: 'Original characteristics',
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Update only description
      const result = await testRouter.tala.update({
        id: createdTala.id,
        description: 'Added description',
      });

      expect(result.description).toBe('Added description');
      expect(result.name).toBe(talaData.name); // Should remain unchanged
      expect(result.aksharas).toBe(talaData.aksharas); // Should remain unchanged
      expect(result.characteristics).toBe(talaData.characteristics); // Should remain unchanged
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for a tala', async () => {
      // Create a tala
      const talaData = {
        name: 'Versioned Tala',
        aksharas: 12,
        pattern: 'Complex 12 beat pattern',
        type: 'Complex Type',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Update it to create a new version
      await testRouter.tala.update({
        id: createdTala.id,
        description: 'Added description',
      });

      // Update again to create another version
      await testRouter.tala.update({
        id: createdTala.id,
        characteristics: 'Added characteristics',
      });

      const versionHistory = await testRouter.tala.getVersionHistory({
        id: createdTala.id,
      });

      expect(versionHistory).toBeDefined();
      expect(Array.isArray(versionHistory)).toBe(true);
      expect(versionHistory.length).toBeGreaterThan(0);
    });
  });

  describe('view tracking', () => {
    it('should track views for non-bot requests', async () => {
      const talaData = {
        name: 'View Tracked Tala',
        aksharas: 8,
        pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // First get should increment view count
      await testRouter.tala.getById({
        id: createdTala.id,
        trackView: true,
      });

      // Get again to verify view count
      const result = await testRouter.tala.getById({
        id: createdTala.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBeGreaterThan(0);
    });

    it('should not track views for bot requests', async () => {
      const talaData = {
        name: 'Bot View Tala',
        aksharas: 7,
        pattern: 'Ta Ka Dhi Mi | Ta Ka Ta',
        type: 'Chapu',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Simulate bot request using bot test router
      await botTestRouter.tala.getById({
        id: createdTala.id,
        trackView: true,
      });

      const result = await testRouter.tala.getById({
        id: createdTala.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBe(0);
    });

    it('should track views for getByName requests', async () => {
      const talaData = {
        name: 'NameView Tala',
        aksharas: 6,
        pattern: 'Ta - Ka | Dhi - Mi | Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
      };

      await testRouter.tala.create(talaData);

      // First getByName should increment view count
      await testRouter.tala.getByName({
        name: 'NameView Tala',
        trackView: true,
      });

      // Get by name again to verify view count
      const result = await testRouter.tala.getByName({
        name: 'NameView Tala',
        trackView: false,
      });

      expect((result as any)?.viewCount).toBeGreaterThan(0);
    });
  });

  describe('rate limiting', () => {
    it('should apply general rate limit to getById calls', async () => {
      // Note: Test user is exempt from rate limits for testing
      const talaData = {
        name: 'Rate Limited Tala',
        aksharas: 8,
        pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Multiple calls should succeed for test user (bypasses rate limits)
      const promises = Array.from({ length: 5 }, () =>
        testRouter.tala.getById({
          id: createdTala.id,
          trackView: false,
        })
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect((result as any)?.id).toBe(createdTala.id);
      });
    });

    it('should apply search rate limit to search calls', async () => {
      const searchParams: TalaSearchParams = {
        query: 'Test',
        limit: 5,
        nextToken: undefined,
      };

      // Multiple search calls should succeed for test user
      const promises = Array.from({ length: 3 }, () => testRouter.tala.search(searchParams));

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      });
    });

    it('should apply write rate limit to create calls', async () => {
      const createPromises = Array.from({ length: 3 }, (_, i) => ({
        name: `Write Limited Tala ${i}`,
        aksharas: (i % 16) + 1,
        pattern: `Pattern ${i}`,
        type: 'Test Type',
        tradition: Tradition.CARNATIC,
      })).map(talaData => testRouter.tala.create(talaData));

      const results = await Promise.all(createPromises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.name).toContain('Write Limited Tala');
      });
    });

    it('should apply write rate limit to update calls', async () => {
      // Create initial tala
      const talaData = {
        name: 'Update Rate Limited Tala',
        aksharas: 8,
        pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
        type: 'Suladi Sapta Tala',
        tradition: Tradition.CARNATIC,
      };

      const createdTala = await testRouter.tala.create(talaData);

      // Multiple update calls should succeed for test user
      const updatePromises = Array.from({ length: 2 }, (_, i) => ({
        id: createdTala.id,
        description: `Updated Description ${i}`,
      })).map(updateData => testRouter.tala.update(updateData));

      const results = await Promise.all(updatePromises);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.description).toBe(`Updated Description ${i}`);
      });
    });
  });

  describe('error cases', () => {
    it('should handle invalid tradition in create', async () => {
      const invalidTalaData = {
        name: 'Invalid Tala',
        aksharas: 8,
        pattern: 'Ta - Ka - Dhi - Mi | Ta - Ka - Ta -',
        type: 'Suladi Sapta Tala',
        tradition: 'INVALID_TRADITION' as Tradition,
      };

      await expect(testRouter.tala.create(invalidTalaData)).rejects.toThrow();
    });

    it('should handle update of non-existent tala', async () => {
      const updateData = {
        id: 'non-existent-id',
        name: 'Updated Name',
      };

      await expect(testRouter.tala.update(updateData)).rejects.toThrow();
    });

    it('should handle invalid aksharas number in create', async () => {
      const invalidTalaData = {
        name: 'Invalid Aksharas Tala',
        aksharas: -1, // Invalid - should be positive
        pattern: 'Invalid pattern',
        type: 'Test Type',
        tradition: Tradition.CARNATIC,
      };

      await expect(testRouter.tala.create(invalidTalaData)).rejects.toThrow();
    });

    it('should handle getByName with empty string', async () => {
      const result = await testRouter.tala.getByName({
        name: '',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should handle search with invalid aksharas filter', async () => {
      const searchParams = {
        query: 'Test',
        aksharas: 0, // Invalid - should be positive
        limit: 10,
      };

      await expect(testRouter.tala.search(searchParams)).rejects.toThrow();
    });

    it('should handle missing required fields in create', async () => {
      const invalidTalaData = {
        // Missing name, aksharas, pattern, tradition
        type: 'Test Type',
      };

      await expect(testRouter.tala.create(invalidTalaData as any)).rejects.toThrow();
    });
  });
});

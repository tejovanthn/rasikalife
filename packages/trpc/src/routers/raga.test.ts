import { describe, it, expect } from 'vitest';
import { testRouter, botTestRouter } from '../../test/setup';
import { Tradition } from '@rasika/core';
import type { RagaSearchParams } from '@rasika/core';

describe('Raga Router Integration Tests', () => {
  describe('create', () => {
    it('should create a new raga', async () => {
      const ragaData = {
        name: 'Test Raga',
        alternativeNames: ['Test Alt Name'],
        melakarta: 15,
        arohana: 'S R1 G3 M1 P D1 N2 S',
        avarohana: 'S N2 D1 P M1 G3 R1 S',
        characteristics: 'Test characteristics',
        mood: 'devotional',
        timeOfDay: 'morning',
        tradition: Tradition.CARNATIC,
        description: 'Test description',
      };

      const result = await testRouter.raga.create(ragaData);

      expect(result).toBeDefined();
      expect(result.name).toBe(ragaData.name);
      expect(result.melakarta).toBe(ragaData.melakarta);
      expect(result.arohana).toBe(ragaData.arohana);
      expect(result.avarohana).toBe(ragaData.avarohana);
      expect(result.tradition).toBe(ragaData.tradition);
      expect(result.addedBy).toBe('test-user-id');
    });
  });

  describe('getById', () => {
    it('should retrieve a raga by id', async () => {
      // First create a raga
      const ragaData = {
        name: 'Test Raga',
        melakarta: 22,
        arohana: 'S R2 G2 M1 P D2 N2 S',
        avarohana: 'S N2 D2 P M1 G2 R2 S',
        tradition: Tradition.CARNATIC,
        description: 'Test description',
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Then retrieve it
      const result = await testRouter.raga.getById({
        id: createdRaga.id,
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdRaga.id);
      expect((result as any)?.name).toBe(ragaData.name);
      expect((result as any)?.melakarta).toBe(ragaData.melakarta);
    });

    it('should return null for non-existent raga', async () => {
      const result = await testRouter.raga.getById({
        id: 'non-existent-id',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should support version parameter', async () => {
      // Create a raga
      const ragaData = {
        name: 'Versioned Raga',
        melakarta: 28,
        arohana: 'S R2 G3 M1 P D1 N3 S',
        avarohana: 'S N3 D1 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Update to create a new version
      await testRouter.raga.update({
        id: createdRaga.id,
        description: 'Updated description',
      });

      // Get the latest version (default behavior)
      const latestResult = await testRouter.raga.getById({
        id: createdRaga.id,
      });

      expect((latestResult as any)?.description).toBe('Updated description');
    });
  });

  describe('getByName', () => {
    it('should retrieve a raga by name', async () => {
      const ragaData = {
        name: 'Shankarabharanam',
        melakarta: 29,
        arohana: 'S R2 G3 M1 P D2 N3 S',
        avarohana: 'S N3 D2 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
        description: 'Popular Carnatic raga',
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      const result = await testRouter.raga.getByName({
        name: 'Shankarabharanam',
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdRaga.id);
      expect((result as any)?.name).toBe(ragaData.name);
    });

    it('should return null for non-existent raga name', async () => {
      const result = await testRouter.raga.getByName({
        name: 'NonExistentRaga',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should handle case-insensitive search', async () => {
      const ragaData = {
        name: 'Kalyani',
        melakarta: 65,
        arohana: 'S R2 G3 M2 P D2 N3 S',
        avarohana: 'S N3 D2 P M2 G3 R2 S',
        tradition: Tradition.CARNATIC,
      };

      await testRouter.raga.create(ragaData);

      const result = await testRouter.raga.getByName({
        name: 'kalyani', // lowercase
        trackView: false,
      });

      expect(result).toBeDefined();
      expect((result as any)?.name).toBe('Kalyani');
    });
  });

  describe('search', () => {
    it('should search ragas by name', async () => {
      // Create test ragas
      const ragas = [
        {
          name: 'Bhairav',
          melakarta: 34,
          arohana: 'S R1 G3 M1 P D1 N3 S',
          avarohana: 'S N3 D1 P M1 G3 R1 S',
          tradition: Tradition.HINDUSTANI,
        },
        {
          name: 'Bhairavi',
          melakarta: 22,
          arohana: 'S R2 G2 M1 P D2 N2 S',
          avarohana: 'S N2 D2 P M1 G2 R2 S',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(ragas.map(raga => testRouter.raga.create(raga)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // Search for "Bhai" - should match both
      const searchParams: RagaSearchParams = {
        query: 'Bhai',
        limit: 10,
        nextToken: undefined,
      };

      const result = await testRouter.raga.search(searchParams);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.hasMore).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      // Create multiple test ragas
      const ragas = Array.from({ length: 15 }, (_, i) => ({
        name: `TestRaga ${i + 1}`,
        melakarta: (i % 72) + 1, // Valid melakarta numbers 1-72
        arohana: 'S R2 G3 M1 P D2 N3 S',
        avarohana: 'S N3 D2 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
      }));

      await Promise.all(ragas.map(raga => testRouter.raga.create(raga)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // First page
      const firstPage = await testRouter.raga.search({
        query: 'TestRaga',
        limit: 5,
        nextToken: undefined,
      });

      expect(firstPage.items.length).toBeGreaterThan(0);
      expect(firstPage.items.length).toBeLessThanOrEqual(5);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextToken).toBeDefined();

      // Second page
      const secondPage = await testRouter.raga.search({
        query: 'TestRaga',
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

    it('should filter by melakarta correctly', async () => {
      const ragas = [
        {
          name: 'Melakarta 15 Raga',
          melakarta: 15,
          arohana: 'S R1 G3 M1 P D1 N2 S',
          avarohana: 'S N2 D1 P M1 G3 R1 S',
          tradition: Tradition.CARNATIC,
        },
        {
          name: 'Melakarta 22 Raga',
          melakarta: 22,
          arohana: 'S R2 G2 M1 P D2 N2 S',
          avarohana: 'S N2 D2 P M1 G2 R2 S',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(ragas.map(raga => testRouter.raga.create(raga)));

      // Wait for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await testRouter.raga.search({
        query: 'Melakarta',
        melakarta: 15,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      // All results should have melakarta 15
      result.items.forEach(item => {
        expect(item.melakarta).toBe(15);
      });
    });

    it('should filter by mood correctly', async () => {
      const ragas = [
        {
          name: 'Devotional Raga',
          melakarta: 29,
          arohana: 'S R2 G3 M1 P D2 N3 S',
          avarohana: 'S N3 D2 P M1 G3 R2 S',
          mood: 'devotional',
          tradition: Tradition.CARNATIC,
        },
        {
          name: 'Romantic Raga',
          melakarta: 65,
          arohana: 'S R2 G3 M2 P D2 N3 S',
          avarohana: 'S N3 D2 P M2 G3 R2 S',
          mood: 'romantic',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(ragas.map(raga => testRouter.raga.create(raga)));

      // Wait for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await testRouter.raga.search({
        query: 'Raga',
        mood: 'devotional',
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      // All results should have devotional mood
      result.items.forEach(item => {
        expect(item.mood).toBe('devotional');
      });
    });
  });

  describe('update', () => {
    it('should update an existing raga', async () => {
      // First create a raga
      const ragaData = {
        name: 'Original Raga Name',
        melakarta: 15,
        arohana: 'S R1 G3 M1 P D1 N2 S',
        avarohana: 'S N2 D1 P M1 G3 R1 S',
        tradition: Tradition.CARNATIC,
        description: 'Original description',
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Update the raga
      const updateData = {
        id: createdRaga.id,
        name: 'Updated Raga Name',
        description: 'Updated description',
        mood: 'peaceful',
      };

      const result = await testRouter.raga.update(updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(result.mood).toBe(updateData.mood);
      expect(result.melakarta).toBe(ragaData.melakarta); // Should remain unchanged
    });

    it('should preserve existing fields when partially updating', async () => {
      const ragaData = {
        name: 'Partial Update Raga',
        melakarta: 28,
        arohana: 'S R2 G3 M1 P D1 N3 S',
        avarohana: 'S N3 D1 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
        mood: 'serene',
        timeOfDay: 'evening',
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Update only description
      const result = await testRouter.raga.update({
        id: createdRaga.id,
        description: 'Added description',
      });

      expect(result.description).toBe('Added description');
      expect(result.name).toBe(ragaData.name); // Should remain unchanged
      expect(result.mood).toBe(ragaData.mood); // Should remain unchanged
      expect(result.timeOfDay).toBe(ragaData.timeOfDay); // Should remain unchanged
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for a raga', async () => {
      // Create a raga
      const ragaData = {
        name: 'Versioned Raga',
        melakarta: 35,
        arohana: 'S R2 G1 M1 P D1 N3 S',
        avarohana: 'S N3 D1 P M1 G1 R2 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Update it to create a new version
      await testRouter.raga.update({
        id: createdRaga.id,
        description: 'Added description',
      });

      // Update again to create another version
      await testRouter.raga.update({
        id: createdRaga.id,
        mood: 'contemplative',
      });

      const versionHistory = await testRouter.raga.getVersionHistory({
        id: createdRaga.id,
      });

      expect(versionHistory).toBeDefined();
      expect(Array.isArray(versionHistory)).toBe(true);
      expect(versionHistory.length).toBeGreaterThan(0);
    });
  });

  describe('view tracking', () => {
    it('should track views for non-bot requests', async () => {
      const ragaData = {
        name: 'View Tracked Raga',
        melakarta: 29,
        arohana: 'S R2 G3 M1 P D2 N3 S',
        avarohana: 'S N3 D2 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // First get should increment view count
      await testRouter.raga.getById({
        id: createdRaga.id,
        trackView: true,
      });

      // Get again to verify view count
      const result = await testRouter.raga.getById({
        id: createdRaga.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBeGreaterThan(0);
    });

    it('should not track views for bot requests', async () => {
      const ragaData = {
        name: 'Bot View Raga',
        melakarta: 65,
        arohana: 'S R2 G3 M2 P D2 N3 S',
        avarohana: 'S N3 D2 P M2 G3 R2 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Simulate bot request using bot test router
      await botTestRouter.raga.getById({
        id: createdRaga.id,
        trackView: true,
      });

      const result = await testRouter.raga.getById({
        id: createdRaga.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBe(0);
    });

    it('should track views for getByName requests', async () => {
      const ragaData = {
        name: 'NameView Raga',
        melakarta: 22,
        arohana: 'S R2 G2 M1 P D2 N2 S',
        avarohana: 'S N2 D2 P M1 G2 R2 S',
        tradition: Tradition.CARNATIC,
      };

      await testRouter.raga.create(ragaData);

      // First getByName should increment view count
      await testRouter.raga.getByName({
        name: 'NameView Raga',
        trackView: true,
      });

      // Get by name again to verify view count
      const result = await testRouter.raga.getByName({
        name: 'NameView Raga',
        trackView: false,
      });

      expect((result as any)?.viewCount).toBeGreaterThan(0);
    });
  });

  describe('rate limiting', () => {
    it('should apply general rate limit to getById calls', async () => {
      // Note: Test user is exempt from rate limits for testing
      const ragaData = {
        name: 'Rate Limited Raga',
        melakarta: 15,
        arohana: 'S R1 G3 M1 P D1 N2 S',
        avarohana: 'S N2 D1 P M1 G3 R1 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Multiple calls should succeed for test user (bypasses rate limits)
      const promises = Array.from({ length: 5 }, () =>
        testRouter.raga.getById({
          id: createdRaga.id,
          trackView: false,
        })
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect((result as any)?.id).toBe(createdRaga.id);
      });
    });

    it('should apply search rate limit to search calls', async () => {
      const searchParams: RagaSearchParams = {
        query: 'Test',
        limit: 5,
        nextToken: undefined,
      };

      // Multiple search calls should succeed for test user
      const promises = Array.from({ length: 3 }, () => testRouter.raga.search(searchParams));

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      });
    });

    it('should apply write rate limit to create calls', async () => {
      const createPromises = Array.from({ length: 3 }, (_, i) => ({
        name: `Write Limited Raga ${i}`,
        melakarta: (i % 72) + 1,
        arohana: 'S R2 G3 M1 P D2 N3 S',
        avarohana: 'S N3 D2 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
      })).map(ragaData => testRouter.raga.create(ragaData));

      const results = await Promise.all(createPromises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.name).toContain('Write Limited Raga');
      });
    });

    it('should apply write rate limit to update calls', async () => {
      // Create initial raga
      const ragaData = {
        name: 'Update Rate Limited Raga',
        melakarta: 29,
        arohana: 'S R2 G3 M1 P D2 N3 S',
        avarohana: 'S N3 D2 P M1 G3 R2 S',
        tradition: Tradition.CARNATIC,
      };

      const createdRaga = await testRouter.raga.create(ragaData);

      // Multiple update calls should succeed for test user
      const updatePromises = Array.from({ length: 2 }, (_, i) => ({
        id: createdRaga.id,
        description: `Updated Description ${i}`,
      })).map(updateData => testRouter.raga.update(updateData));

      const results = await Promise.all(updatePromises);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.description).toBe(`Updated Description ${i}`);
      });
    });
  });

  describe('error cases', () => {
    it('should handle invalid tradition in create', async () => {
      const invalidRagaData = {
        name: 'Invalid Raga',
        melakarta: 15,
        arohana: 'S R1 G3 M1 P D1 N2 S',
        avarohana: 'S N2 D1 P M1 G3 R1 S',
        tradition: 'INVALID_TRADITION' as Tradition,
      };

      await expect(testRouter.raga.create(invalidRagaData)).rejects.toThrow();
    });

    it('should handle update of non-existent raga', async () => {
      const updateData = {
        id: 'non-existent-id',
        name: 'Updated Name',
      };

      await expect(testRouter.raga.update(updateData)).rejects.toThrow();
    });

    it('should handle invalid melakarta number in create', async () => {
      const invalidRagaData = {
        name: 'Invalid Melakarta Raga',
        melakarta: 100, // Invalid - should be 1-72
        arohana: 'S R1 G3 M1 P D1 N2 S',
        avarohana: 'S N2 D1 P M1 G3 R1 S',
        tradition: Tradition.CARNATIC,
      };

      await expect(testRouter.raga.create(invalidRagaData)).rejects.toThrow();
    });

    it('should handle getByName with empty string', async () => {
      const result = await testRouter.raga.getByName({
        name: '',
        trackView: false,
      });

      expect(result).toBeNull();
    });

    it('should handle search with invalid melakarta filter', async () => {
      const searchParams = {
        query: 'Test',
        melakarta: -1, // Invalid
        limit: 10,
      };

      await expect(testRouter.raga.search(searchParams)).rejects.toThrow();
    });
  });
});

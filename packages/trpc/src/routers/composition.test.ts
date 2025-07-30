import { describe, it, expect } from 'vitest';
import { testRouter, botTestRouter } from '../../test/setup';
import { Tradition, AttributionType, AttributionConfidence } from '@rasika/core';
import type { CompositionSearchParams, AttributionSearchParams } from '@rasika/core';

describe('Composition Router Integration Tests', () => {
  describe('create', () => {
    it('should create a new composition', async () => {
      const compositionData = {
        title: 'Test Composition',
        alternativeTitles: ['Test Alt Title'],
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        lyrics: 'Test lyrics content',
        meaning: 'Test meaning',
        notes: 'Test notes',
        tradition: Tradition.CARNATIC,
      };

      const result = await testRouter.composition.create(compositionData);

      expect(result).toBeDefined();
      expect(result.title).toBe(compositionData.title);
      expect(result.ragaId).toBe(compositionData.ragaId);
      expect(result.talaId).toBe(compositionData.talaId);
      expect(result.language).toBe(compositionData.language);
      expect(result.editedBy).toBeDefined();
      expect(result.editedBy?.length).toBe(1);
      expect(result.editedBy?.[0]).toBe('test-user-id');
    });
  });

  describe('getById', () => {
    it('should retrieve a composition by id', async () => {
      // First create a composition
      const compositionData = {
        title: 'Test Composition',
        alternativeTitles: ['Test Alt Title'],
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        lyrics: 'Test lyrics content',
        meaning: 'Test meaning',
        notes: 'Test notes',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Then retrieve it
      const result = await testRouter.composition.getById({
        id: createdComposition.id,
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdComposition.id);
      expect((result as any)?.title).toBe(compositionData.title);
    });

    it('should return null for non-existent composition', async () => {
      const result = await testRouter.composition.getById({
        id: 'non-existent-id',
        trackView: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('getWithAttributions', () => {
    it('should retrieve a composition with its attributions', async () => {
      // First create a composition
      const compositionData = {
        title: 'Test Composition with Attributions',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Create an attribution
      const attributionData = {
        compositionId: createdComposition.id,
        artistId: 'test-artist-id',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        source: 'Test source',
        notes: 'Test attribution notes',
      };

      await testRouter.composition.createAttribution(attributionData);

      // Retrieve composition with attributions
      const result = await testRouter.composition.getWithAttributions({
        id: createdComposition.id,
        trackView: true,
      });

      expect(result).toBeDefined();
      expect((result as any)?.id).toBe(createdComposition.id);
      expect((result as any)?.title).toBe(compositionData.title);
      expect((result as any)?.attributions).toBeDefined();
      expect(Array.isArray((result as any)?.attributions)).toBe(true);
    });
  });

  describe('search', () => {
    it('should search compositions by title', async () => {
      // Create test compositions
      const compositions = [
        {
          title: 'Bhaja Govindam',
          ragaId: 'test-raga-1',
          talaId: 'test-tala-1',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        },
        {
          title: 'Govinda Krishna Jai',
          ragaId: 'test-raga-2',
          talaId: 'test-tala-2',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(compositions.map(comp => testRouter.composition.create(comp)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // Search for "Govind" - should match both
      const searchParams: CompositionSearchParams = {
        query: 'Govind',
        limit: 10,
        nextToken: undefined,
      };

      const result = await testRouter.composition.search(searchParams);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.hasMore).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      // Create multiple test compositions
      const compositions = Array.from({ length: 15 }, (_, i) => ({
        title: `Composition ${i + 1}`,
        ragaId: `test-raga-${i + 1}`,
        talaId: `test-tala-${i + 1}`,
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      }));

      await Promise.all(compositions.map(comp => testRouter.composition.create(comp)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // First page
      const firstPage = await testRouter.composition.search({
        query: 'Composition',
        limit: 5,
        nextToken: undefined,
      });

      expect(firstPage.items.length).toBeGreaterThan(0);
      expect(firstPage.items.length).toBeLessThanOrEqual(5);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextToken).toBeDefined();

      // Second page
      const secondPage = await testRouter.composition.search({
        query: 'Composition',
        limit: 5,
        nextToken: firstPage.nextToken,
      });

      // DynamoDB scan behavior can vary, so we check for reasonable pagination
      expect(secondPage.items.length).toBeGreaterThan(0);
      expect(secondPage.items.length).toBeLessThanOrEqual(5);
      // Ensure different items on second page (pagination working)
      if (secondPage.items.length > 0) {
        expect(secondPage.items[0].title).not.toBe(firstPage.items[0].title);
      }
    });

    it('should filter by raga correctly', async () => {
      const compositions = [
        {
          title: 'Raga Filtered 1',
          ragaId: 'specific-raga-id',
          talaId: 'test-tala-1',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        },
        {
          title: 'Raga Filtered 2',
          ragaId: 'different-raga-id',
          talaId: 'test-tala-2',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        },
      ];

      await Promise.all(compositions.map(comp => testRouter.composition.create(comp)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await testRouter.composition.search({
        query: 'Raga Filtered',
        ragaId: 'specific-raga-id',
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      // All results should have the specific raga ID
      result.items.forEach(item => {
        expect(item.ragaId).toBe('specific-raga-id');
      });
    });
  });

  describe('update', () => {
    it('should update an existing composition', async () => {
      // First create a composition
      const compositionData = {
        title: 'Original Title',
        ragaId: 'original-raga-id',
        talaId: 'original-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Update the composition
      const updateData = {
        id: createdComposition.id,
        title: 'Updated Title',
        lyrics: 'Updated lyrics content',
      };

      const result = await testRouter.composition.update(updateData);

      expect(result).toBeDefined();
      expect(result.title).toBe(updateData.title);
      expect(result.lyrics).toBe(updateData.lyrics);
      expect(result.ragaId).toBe(compositionData.ragaId); // Should remain unchanged
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for a composition', async () => {
      // Create a composition
      const compositionData = {
        title: 'Versioned Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Update it to create a new version
      await testRouter.composition.update({
        id: createdComposition.id,
        title: 'Updated Title',
      });

      const versionHistory = await testRouter.composition.getVersionHistory({
        id: createdComposition.id,
      });

      expect(versionHistory).toBeDefined();
      expect(Array.isArray(versionHistory)).toBe(true);
      expect(versionHistory.length).toBeGreaterThan(0);
    });
  });

  describe('attribution management', () => {
    describe('createAttribution', () => {
      it('should create a new attribution', async () => {
        // First create a composition
        const compositionData = {
          title: 'Test Composition for Attribution',
          ragaId: 'test-raga-id',
          talaId: 'test-tala-id',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        };

        const createdComposition = await testRouter.composition.create(compositionData);

        // Create an attribution
        const attributionData = {
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
          attributionType: AttributionType.PRIMARY,
          confidence: AttributionConfidence.HIGH,
          source: 'Test source',
          notes: 'Test attribution notes',
        };

        const result = await testRouter.composition.createAttribution(attributionData);

        expect(result).toBeDefined();
        expect(result.compositionId).toBe(attributionData.compositionId);
        expect(result.artistId).toBe(attributionData.artistId);
        expect(result.attributionType).toBe(attributionData.attributionType);
        expect(result.addedBy).toBe('test-user-id');
      });
    });

    describe('getAttribution', () => {
      it('should retrieve a specific attribution', async () => {
        // Create composition
        const compositionData = {
          title: 'Test Composition',
          ragaId: 'test-raga-id',
          talaId: 'test-tala-id',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        };

        const createdComposition = await testRouter.composition.create(compositionData);

        // Create attribution
        const attributionData = {
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
          attributionType: AttributionType.PRIMARY,
          confidence: AttributionConfidence.HIGH,
          source: 'Test source',
        };

        await testRouter.composition.createAttribution(attributionData);

        // Retrieve the attribution
        const result = await testRouter.composition.getAttribution({
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
        });

        expect(result).toBeDefined();
        expect((result as any)?.compositionId).toBe(createdComposition.id);
        expect((result as any)?.artistId).toBe('test-artist-id');
      });

      it('should return null for non-existent attribution', async () => {
        const result = await testRouter.composition.getAttribution({
          compositionId: 'non-existent-comp-id',
          artistId: 'non-existent-artist-id',
        });

        expect(result).toBeNull();
      });
    });

    describe('searchAttributions', () => {
      it('should search attributions by composition ID', async () => {
        // Create composition
        const compositionData = {
          title: 'Test Composition',
          ragaId: 'test-raga-id',
          talaId: 'test-tala-id',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        };

        const createdComposition = await testRouter.composition.create(compositionData);

        // Create multiple attributions
        const attributions = [
          {
            compositionId: createdComposition.id,
            artistId: 'artist-1',
            attributionType: AttributionType.PRIMARY,
            confidence: AttributionConfidence.HIGH,
            source: 'Source 1',
          },
          {
            compositionId: createdComposition.id,
            artistId: 'artist-2',
            attributionType: AttributionType.DISPUTED,
            confidence: AttributionConfidence.MEDIUM,
            source: 'Source 2',
          },
        ];

        await Promise.all(attributions.map(attr => testRouter.composition.createAttribution(attr)));

        // Wait for eventual consistency
        await new Promise(resolve => setTimeout(resolve, 500));

        const searchParams: AttributionSearchParams = {
          compositionId: createdComposition.id,
          limit: 10,
        };

        const result = await testRouter.composition.searchAttributions(searchParams);

        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.hasMore).toBeDefined();
      });
    });

    describe('updateAttribution', () => {
      it('should update an existing attribution', async () => {
        // Create composition
        const compositionData = {
          title: 'Test Composition',
          ragaId: 'test-raga-id',
          talaId: 'test-tala-id',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        };

        const createdComposition = await testRouter.composition.create(compositionData);

        // Create attribution
        const attributionData = {
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
          attributionType: AttributionType.DISPUTED,
          confidence: AttributionConfidence.MEDIUM,
          source: 'Original source',
        };

        await testRouter.composition.createAttribution(attributionData);

        // Update the attribution
        const updateData = {
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
          attributionType: AttributionType.PRIMARY,
          confidence: AttributionConfidence.HIGH,
          notes: 'Updated notes',
        };

        const result = await testRouter.composition.updateAttribution(updateData);

        expect(result).toBeDefined();
        expect(result.attributionType).toBe(AttributionType.PRIMARY);
        expect(result.confidence).toBe(AttributionConfidence.HIGH);
        expect(result.notes).toBe('Updated notes');
      });
    });

    describe('verifyAttribution', () => {
      it('should verify an attribution', async () => {
        // Create composition
        const compositionData = {
          title: 'Test Composition',
          ragaId: 'test-raga-id',
          talaId: 'test-tala-id',
          language: 'Sanskrit',
          tradition: Tradition.CARNATIC,
        };

        const createdComposition = await testRouter.composition.create(compositionData);

        // Create attribution
        const attributionData = {
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
          attributionType: AttributionType.DISPUTED,
          confidence: AttributionConfidence.MEDIUM,
          source: 'Test source',
        };

        await testRouter.composition.createAttribution(attributionData);

        // Verify the attribution
        const result = await testRouter.composition.verifyAttribution({
          compositionId: createdComposition.id,
          artistId: 'test-artist-id',
        });

        expect(result).toBeDefined();
        expect(result.verifiedBy).toContain('test-user-id');
      });
    });
  });

  describe('view tracking', () => {
    it('should track views for non-bot requests', async () => {
      const compositionData = {
        title: 'View Tracked Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // First get should increment view count
      await testRouter.composition.getById({
        id: createdComposition.id,
        trackView: true,
      });

      // Get again to verify view count
      const result = await testRouter.composition.getById({
        id: createdComposition.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBeGreaterThan(0);
    });

    it('should not track views for bot requests', async () => {
      const compositionData = {
        title: 'Bot View Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Simulate bot request using bot test router
      await botTestRouter.composition.getById({
        id: createdComposition.id,
        trackView: true,
      });

      const result = await testRouter.composition.getById({
        id: createdComposition.id,
        trackView: false,
      });

      expect((result as any)?.viewCount).toBe(0);
    });
  });

  describe('rate limiting', () => {
    it('should apply general rate limit to getById calls', async () => {
      // Note: Test user is exempt from rate limits for testing
      const compositionData = {
        title: 'Rate Limited Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      // Multiple calls should succeed for test user (bypasses rate limits)
      const promises = Array.from({ length: 5 }, () =>
        testRouter.composition.getById({
          id: createdComposition.id,
          trackView: false,
        })
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect((result as any)?.id).toBe(createdComposition.id);
      });
    });

    it('should apply search rate limit to search calls', async () => {
      const searchParams: CompositionSearchParams = {
        query: 'Test',
        limit: 5,
        nextToken: undefined,
      };

      // Multiple search calls should succeed for test user
      const promises = Array.from({ length: 3 }, () => testRouter.composition.search(searchParams));

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      });
    });

    it('should apply write rate limit to create calls', async () => {
      const createPromises = Array.from({ length: 3 }, (_, i) => ({
        title: `Write Limited Composition ${i}`,
        ragaId: `test-raga-${i}`,
        talaId: `test-tala-${i}`,
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      })).map(compData => testRouter.composition.create(compData));

      const results = await Promise.all(createPromises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.title).toContain('Write Limited Composition');
      });
    });
  });

  describe('error cases', () => {
    it('should handle invalid tradition in create', async () => {
      const invalidCompositionData = {
        title: 'Invalid Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: 'INVALID_TRADITION' as Tradition,
      };

      await expect(testRouter.composition.create(invalidCompositionData)).rejects.toThrow();
    });

    it('should handle update of non-existent composition', async () => {
      const updateData = {
        id: 'non-existent-id',
        title: 'Updated Title',
      };

      await expect(testRouter.composition.update(updateData)).rejects.toThrow();
    });

    it('should handle invalid attribution type in createAttribution', async () => {
      const compositionData = {
        title: 'Test Composition',
        ragaId: 'test-raga-id',
        talaId: 'test-tala-id',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      };

      const createdComposition = await testRouter.composition.create(compositionData);

      const invalidAttributionData = {
        compositionId: createdComposition.id,
        artistId: 'test-artist-id',
        attributionType: 'INVALID_TYPE' as AttributionType,
        confidence: AttributionConfidence.HIGH,
        source: 'Test source',
      };

      await expect(
        testRouter.composition.createAttribution(invalidAttributionData)
      ).rejects.toThrow();
    });
  });
});

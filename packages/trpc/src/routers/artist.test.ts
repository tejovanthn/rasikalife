import { describe, it, expect } from 'vitest';
import { testRouter, botTestRouter } from '../../test/setup';
import { Tradition, ArtistType } from '@rasika/core';
import type { ArtistSearchParams } from '@rasika/core';

describe('Artist Router Integration Tests', () => {
  describe('create', () => {
    it('should create a new artist', async () => {
      const artistData = {
        name: 'Test Artist',
        bio: 'Test Bio',
        profileImage: 'https://example.com/image.jpg',
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      const result = await testRouter.artist.create(artistData);

      expect(result).toBeDefined();
      expect(result.name).toBe(artistData.name);
      expect(result.bio).toBe(artistData.bio);
      expect(result.profileImage).toBe(artistData.profileImage);
      expect(result.editedBy).toBeDefined();
      expect(result.editedBy?.length).toBe(1);
      expect(result.editedBy?.[0]).toBe('test-user-id');
    });
  });

  describe('getById', () => {
    it('should retrieve an artist by id', async () => {
      // First create an artist
      const artistData = {
        name: 'Test Artist',
        bio: 'Test Bio',
        profileImage: 'https://example.com/image.jpg',
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      const createdArtist = await testRouter.artist.create(artistData);

      // Then retrieve it
      const result = await testRouter.artist.getById({
        id: createdArtist.id,
        trackView: true,
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(createdArtist.id);
      expect(result?.name).toBe(artistData.name);
    });

    it('should return null for non-existent artist', async () => {
      const result = await testRouter.artist.getById({
        id: 'non-existent-id',
        trackView: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search artists by name', async () => {
      // Create test artists
      const artists = [
        {
          name: 'John Doe',
          bio: 'Bio 1',
          profileImage: 'https://example.com/1.jpg',
          artistType: ArtistType.VOCALIST,
          instruments: ['Voice'],
          traditions: [Tradition.CARNATIC],
        },
        {
          name: 'Jane Doe',
          bio: 'Bio 2',
          profileImage: 'https://example.com/2.jpg',
          artistType: ArtistType.VOCALIST,
          instruments: ['Voice'],
          traditions: [Tradition.CARNATIC],
        },
      ];

      await Promise.all(artists.map(artist => testRouter.artist.create(artist)));

      // Search for "Doe"
      const searchParams: ArtistSearchParams = {
        query: 'Jane Doe',
        limit: 10,
        nextToken: undefined,
        tradition: Tradition.CARNATIC,
      };

      const result = await testRouter.artist.search(searchParams);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].name).toContain('Doe');
      expect(result.hasMore).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      // Create multiple test artists
      const artists = Array.from({ length: 15 }, (_, i) => ({
        name: `Artist ${i + 1}`,
        bio: `Bio ${i + 1}`,
        profileImage: `https://example.com/${i + 1}.jpg`,
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      }));

      await Promise.all(artists.map(artist => testRouter.artist.create(artist)));

      // Wait a bit for eventual consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // First page
      const firstPage = await testRouter.artist.search({
        query: 'Artist',
        limit: 5,
        nextToken: undefined,
      });

      expect(firstPage.items).toHaveLength(5);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextToken).toBeDefined();

      // Second page
      const secondPage = await testRouter.artist.search({
        query: 'Artist',
        limit: 5,
        nextToken: firstPage.nextToken,
      });

      expect(secondPage.items).toHaveLength(5);
      expect(secondPage.items[0].name).not.toBe(firstPage.items[0].name);
    });

    it.skip('should filter by tradition correctly', async () => {
      const artists = [
        {
          name: 'Carnatic Artist',
          bio: 'Carnatic Bio',
          profileImage: 'https://example.com/carnatic.jpg',
          artistType: ArtistType.VOCALIST,
          instruments: ['Voice'],
          traditions: [Tradition.CARNATIC],
        },
        {
          name: 'Hindustani Artist',
          bio: 'Hindustani Bio',
          profileImage: 'https://example.com/hindustani.jpg',
          artistType: ArtistType.VOCALIST,
          instruments: ['Voice'],
          traditions: [Tradition.HINDUSTANI],
        },
      ];

      await Promise.all(artists.map(artist => testRouter.artist.create(artist)));

      const result = await testRouter.artist.search({
        query: 'Artist',
        limit: 10,
        tradition: Tradition.CARNATIC,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Carnatic Artist');
    });
  });

  describe('update', () => {
    it('should update an existing artist', async () => {
      // First create an artist
      const artistData = {
        name: 'Original Name',
        bio: 'Original Bio',
        profileImage: 'https://example.com/original.jpg',
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      const createdArtist = await testRouter.artist.create(artistData);

      // Update the artist
      const updateData = {
        id: createdArtist.id,
        name: 'Updated Name',
        bio: 'Updated Bio',
      };

      const result = await testRouter.artist.update(updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.bio).toBe(updateData.bio);
      expect(result.profileImage).toBe(artistData.profileImage); // Should remain unchanged
    });
  });

  describe('getPopular', () => {
    it('should return popular artists within limit', async () => {
      // Create multiple artists
      const artists = Array.from({ length: 15 }, (_, i) => ({
        name: `Popular Artist ${i + 1}`,
        bio: `Bio ${i + 1}`,
        profileImage: `https://example.com/${i + 1}.jpg`,
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      }));

      await Promise.all(artists.map(artist => testRouter.artist.create(artist)));

      const result = await testRouter.artist.getPopular({ limit: 5 });

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('viewCount');
    });

    it('should respect maximum limit of 50', async () => {
      const result = await testRouter.artist.getPopular({ limit: 50 });
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('view tracking', () => {
    it('should track views for non-bot requests', async () => {
      const artistData = {
        name: 'View Tracked Artist',
        bio: 'Test Bio',
        profileImage: 'https://example.com/image.jpg',
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      const createdArtist = await testRouter.artist.create(artistData);

      // First get should increment view count
      await testRouter.artist.getById({
        id: createdArtist.id,
        trackView: true,
      });

      // Get again to verify view count
      const result = await testRouter.artist.getById({
        id: createdArtist.id,
        trackView: false,
      });

      expect(result?.viewCount).toBeGreaterThan(0);
    });

    it('should not track views for bot requests', async () => {
      const artistData = {
        name: 'Bot View Artist',
        bio: 'Test Bio',
        profileImage: 'https://example.com/image.jpg',
        artistType: ArtistType.VOCALIST,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      const createdArtist = await testRouter.artist.create(artistData);

      // Simulate bot request using bot test router
      await botTestRouter.artist.getById({
        id: createdArtist.id,
        trackView: true,
      });

      const result = await testRouter.artist.getById({
        id: createdArtist.id,
        trackView: false,
      });

      expect(result?.viewCount).toBe(0);
    });
  });

  describe('error cases', () => {
    it('should handle invalid artist type in create', async () => {
      const invalidArtistData = {
        name: 'Invalid Artist',
        bio: 'Test Bio',
        profileImage: 'https://example.com/image.jpg',
        artistType: 'INVALID_TYPE' as ArtistType,
        instruments: ['Voice'],
        traditions: [Tradition.CARNATIC],
      };

      await expect(testRouter.artist.create(invalidArtistData)).rejects.toThrow();
    });

    it('should handle update of non-existent artist', async () => {
      const updateData = {
        id: 'non-existent-id',
        name: 'Updated Name',
      };

      await expect(testRouter.artist.update(updateData)).rejects.toThrow();
    });

    it('should handle invalid tradition in search', async () => {
      const searchParams = {
        query: 'Test',
        limit: 10,
        tradition: 'INVALID_TRADITION' as Tradition,
      };

      await expect(testRouter.artist.search(searchParams)).rejects.toThrow();
    });
  });
});

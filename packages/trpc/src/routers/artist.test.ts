import { describe, it, expect } from 'vitest';
import { testRouter } from '../../test/setup';
import { Tradition, ArtistType } from '@rasika/core';
import type { Artist, ArtistSearchResult, ArtistSearchParams } from '@rasika/core';

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
}); 
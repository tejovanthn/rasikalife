// ../../domain/artist/schema.test.ts
import { describe, it, expect } from 'vitest';
import { createArtistSchema, updateArtistSchema } from './schema';
import { ArtistType, Tradition } from './types';

describe('Artist Schema', () => {
  describe('createArtistSchema', () => {
    it('should validate a minimal valid artist', () => {
      const input = {
        name: 'M.S. Subbulakshmi',
        artistType: ArtistType.VOCALIST,
        instruments: ['voice'],
        isCommunityManaged: false,
        traditions: [Tradition.CARNATIC],
      };

      const result = createArtistSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should validate a complete artist with all fields', () => {
      const input = {
        name: 'Ganesh Kumaresh',
        bio: 'Renowned violin duo',
        artistType: ArtistType.GROUP,
        instruments: ['violin'],
        gurus: ['Lalgudi Jayaraman', 'M.S. Gopalakrishnan'],
        lineage: 'Lalgudi bani',
        formationYear: 1972,
        location: {
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
        },
        profileImage: 'https://example.com/image.jpg',
        socialLinks: {
          website: 'https://ganeshkumaresh.com',
          youtube: 'https://youtube.com/ganeshkumaresh',
        },
        website: 'https://ganeshkumaresh.com',
        traditions: [Tradition.CARNATIC],
        isCommunityManaged: false,
        protectionLevel: 'medium',
      };

      const result = createArtistSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should reject invalid data', () => {
      expect(() => createArtistSchema.parse({})).toThrow();
      expect(() => createArtistSchema.parse({ name: '' })).toThrow(); // Empty name
      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: 'invalid', // Invalid type
          instruments: [],
          traditions: [],
        })
      ).toThrow();
    });

    it('should enforce array limits', () => {
      const tooManyInstruments = Array(11).fill('instrument');
      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.INSTRUMENTALIST,
          instruments: tooManyInstruments,
          traditions: [Tradition.CARNATIC],
        })
      ).toThrow();

      const tooManyGurus = Array(21).fill('guru');
      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.VOCALIST,
          instruments: ['voice'],
          gurus: tooManyGurus,
          traditions: [Tradition.CARNATIC],
        })
      ).toThrow();
    });

    it('should validate formation year', () => {
      const currentYear = new Date().getFullYear();

      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.GROUP,
          instruments: ['violin'],
          traditions: [Tradition.CARNATIC],
          formationYear: 999, // Too early
        })
      ).toThrow();

      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.GROUP,
          instruments: ['violin'],
          traditions: [Tradition.CARNATIC],
          formationYear: currentYear + 1, // Future
        })
      ).toThrow();
    });

    it('should validate URLs', () => {
      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.VOCALIST,
          instruments: ['voice'],
          traditions: [Tradition.CARNATIC],
          website: 'not-a-url',
        })
      ).toThrow();

      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.VOCALIST,
          instruments: ['voice'],
          traditions: [Tradition.CARNATIC],
          profileImage: 'not-a-url',
        })
      ).toThrow();
    });

    it('should require at least one tradition', () => {
      expect(() =>
        createArtistSchema.parse({
          name: 'Artist',
          artistType: ArtistType.VOCALIST,
          instruments: ['voice'],
          traditions: [],
        })
      ).toThrow();
    });
  });

  describe('updateArtistSchema', () => {
    it('should allow partial updates', () => {
      const input = { id: 'test-id', name: 'Updated Name' };
      const result = updateArtistSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should validate updated fields', () => {
      expect(() => updateArtistSchema.parse({ id: 'test-id', name: '' })).toThrow();
      expect(() => updateArtistSchema.parse({ id: 'test-id', artistType: 'invalid' })).toThrow();
    });
  });
});

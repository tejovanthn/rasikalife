// packages/core/src/domain/search/index.test.ts

import { describe, expect, it } from 'vitest';
import type { Artist } from '../artist';
import type { CompositionWithRelations } from '../composition';
import type { Event } from '../event';
import type { Organiser } from '../organiser';
import type { Venue } from '../venue';
import {
  transformArtistToDocument,
  transformCompositionToDocument,
  transformEventToDocument,
  transformOrganiserToDocument,
  transformVenueToDocument,
} from './transformer';

describe('Search Domain', () => {
  describe('Transformer', () => {
    describe('transformArtistToDocument', () => {
      it('should transform artist to search document', () => {
        const artist: Artist = {
          id: 'artist-123',
          name: 'M.S. Subbulakshmi',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformArtistToDocument(artist);

        expect(doc.id).toBe('artist-123');
        expect(doc.entityType).toBe('artist');
        expect(doc.name).toBe('M.S. Subbulakshmi');
        expect(doc.displayName).toBe('M.S. Subbulakshmi');
        expect(doc.description).toBe('');
      });

      it('should handle artist with special characters in name', () => {
        const artist: Artist = {
          id: 'artist-456',
          name: 'Mysore Vasudevachar',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformArtistToDocument(artist);

        expect(doc.name).toBe('Mysore Vasudevachar');
      });
    });

    describe('transformCompositionToDocument', () => {
      it('should transform composition to search document', () => {
        const composition: CompositionWithRelations = {
          id: 'comp-456',
          title: 'Krishna Nee Begane Baro',
          composer: { id: 'artist-789', name: 'Tyagaraja' },
          language: 'Kannada',
          lyricsV1: [
            { type: 'lyric', order: 1, text: 'krishna nee begane baro' },
            { type: 'lyric', order: 2, text: 'yamunaware' },
          ],
          ragas: [{ id: 'raga-001', name: 'Kalyani' }],
          talas: [{ id: 'tala-001', name: 'Adi' }],
          sourceAttribution: 'Carnatic music tradition',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformCompositionToDocument(composition);

        expect(doc.id).toBe('comp-456');
        expect(doc.entityType).toBe('composition');
        expect(doc.name).toBe('Krishna Nee Begane Baro');
        expect(doc.displayName).toBe('Krishna Nee Begane Baro');
        expect(doc.description).toContain('Tyagaraja');
        expect(doc.description).toContain('Kalyani');
        expect(doc.description).toContain('Adi');
        expect(doc.description).toContain('krishna nee begane baro');
        expect(doc.description).toContain('yamunaware');
      });

      it('should handle composition without optional fields', () => {
        const composition: CompositionWithRelations = {
          id: 'comp-001',
          title: 'Simple Song',
          composer: { id: 'artist-001', name: 'Composer' },
          language: 'Sanskrit',
          lyricsV1: [],
          ragas: [],
          talas: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformCompositionToDocument(composition);

        expect(doc.name).toBe('Simple Song');
        expect(doc.description).toBe('Composer');
      });

      it('should join multiple raga names in description', () => {
        const composition: CompositionWithRelations = {
          id: 'comp-789',
          title: 'Multi Raga Composition',
          composer: { id: 'artist-001', name: 'Composer' },
          language: 'Sanskrit',
          lyricsV1: [],
          ragas: [
            { id: 'raga-001', name: 'Kalyani' },
            { id: 'raga-002', name: 'Sankarabharana' },
          ],
          talas: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformCompositionToDocument(composition);

        expect(doc.description).toContain('Kalyani Sankarabharana');
      });

      it('should join multiple tala names in description', () => {
        const composition: CompositionWithRelations = {
          id: 'comp-999',
          title: 'Multi Tala Composition',
          composer: { id: 'artist-001', name: 'Composer' },
          language: 'Tamil',
          lyricsV1: [],
          ragas: [],
          talas: [
            { id: 'tala-001', name: 'Adi' },
            { id: 'tala-002', name: 'Triputa' },
          ],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformCompositionToDocument(composition);

        expect(doc.description).toContain('Adi Triputa');
      });
    });

    describe('transformVenueToDocument', () => {
      it('should transform venue to search document', () => {
        const venue = {
          id: 'venue-001',
          name: 'Music Academy',
          city: 'Chennai',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        } as Venue;

        const doc = transformVenueToDocument(venue);

        expect(doc.id).toBe('venue-001');
        expect(doc.entityType).toBe('venue');
        expect(doc.name).toBe('Music Academy');
        expect(doc.displayName).toBe('Music Academy');
        expect(doc.description).toBe('Chennai');
      });

      it('should handle venue without city', () => {
        const venue = {
          id: 'venue-002',
          name: 'Concert Hall',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        } as Venue;

        const doc = transformVenueToDocument(venue);

        expect(doc.name).toBe('Concert Hall');
        expect(doc.description).toBe('');
      });
    });

    describe('transformOrganiserToDocument', () => {
      it('should transform organiser to search document', () => {
        const organiser = {
          id: 'org-001',
          name: 'Madras Music Academy',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        } as Organiser;

        const doc = transformOrganiserToDocument(organiser);

        expect(doc.id).toBe('org-001');
        expect(doc.entityType).toBe('organiser');
        expect(doc.name).toBe('Madras Music Academy');
        expect(doc.displayName).toBe('Madras Music Academy');
        expect(doc.description).toBe('');
      });
    });

    describe('transformEventToDocument', () => {
      it('should transform event to search document', () => {
        const event = {
          id: 'event-001',
          title: 'Annual Margazhi Concert',
          artists: [
            { name: 'Sanjay Subrahmanyan', id: 'a1' },
            { name: 'S. Varadarajan', id: 'a2' },
          ],
          venueName: 'Music Academy',
          organiserName: 'Madras Music Academy',
          startDateTime: '2025-12-15T18:00:00.000Z',
          status: 'approved',
          createdBy: 'user-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        } as Event;

        const doc = transformEventToDocument(event);

        expect(doc.id).toBe('event-001');
        expect(doc.entityType).toBe('event');
        expect(doc.name).toBe('Annual Margazhi Concert');
        expect(doc.displayName).toBe('Annual Margazhi Concert');
        expect(doc.description).toContain('Sanjay Subrahmanyan');
        expect(doc.description).toContain('S. Varadarajan');
        expect(doc.description).toContain('Music Academy');
        expect(doc.description).toContain('Madras Music Academy');
      });

      it('should handle event without optional fields', () => {
        const event = {
          id: 'event-002',
          title: 'Simple Concert',
          artists: [],
          startDateTime: '2025-12-15T18:00:00.000Z',
          status: 'approved',
          createdBy: 'user-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        } as Event;

        const doc = transformEventToDocument(event);

        expect(doc.name).toBe('Simple Concert');
        expect(doc.description).toBe('');
      });
    });
  });
});

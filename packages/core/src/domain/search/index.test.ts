// packages/core/src/domain/search/index.test.ts

import { describe, expect, it } from 'vitest';
import type { Artist } from '../artist';
import type { CompositionWithRelations } from '../composition';
import { transformArtistToDocument, transformCompositionToDocument } from './transformer';

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
        expect(doc.artistName).toBe('M.S. Subbulakshmi');
        expect(doc.displayName).toBe('M.S. Subbulakshmi');
        expect(doc.ragaName).toBe('');
        expect(doc.talaName).toBe('');
        expect(doc.compositionTitle).toBe('');
        expect(doc.lyrics).toBe('');
      });

      it('should handle artist with special characters in name', () => {
        const artist: Artist = {
          id: 'artist-456',
          name: 'Mysore Vasudevachar',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const doc = transformArtistToDocument(artist);

        expect(doc.artistName).toBe('Mysore Vasudevachar');
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
        expect(doc.artistName).toBe('Tyagaraja');
        expect(doc.compositionTitle).toBe('Krishna Nee Begane Baro');
        expect(doc.ragaName).toBe('Kalyani');
        expect(doc.talaName).toBe('Adi');
        expect(doc.lyrics).toContain('krishna nee begane baro');
        expect(doc.lyrics).toContain('yamunaware');
        expect(doc.displayName).toBe('Krishna Nee Begane Baro');
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

        expect(doc.lyrics).toBe('');
        expect(doc.ragaName).toBe('');
        expect(doc.talaName).toBe('');
      });

      it('should join multiple raga names', () => {
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

        expect(doc.ragaName).toBe('Kalyani Sankarabharana');
      });

      it('should join multiple tala names', () => {
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

        expect(doc.talaName).toBe('Adi Triputa');
      });
    });
  });
});

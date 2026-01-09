import type { Composition } from '../../src/domain/composition/entity';

export const mockCompositions: Composition[] = [
  {
    id: 'composition_1',
    title: 'Vatapi Ganapatim',
    artistId: 'artist_1',
    ragaId: 'raga_1',
    talaId: 'tala_1',
    lyrics: 'Vatapi Ganapatim bhajeham...',
    language: 'Sanskrit',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'composition_2',
    title: 'Kalyani Pallavi',
    artistId: 'artist_1',
    ragaId: 'raga_2',
    talaId: 'tala_2',
    lyrics: 'Kalyani pallavi...',
    language: 'Telugu',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

import type { Tala } from '../../src/domain/tala/entity';

export const mockTalas: Tala[] = [
  {
    id: 'tala_1',
    name: 'Adi',
    beats: 8,
    fingerCount: 4,
    notation: 'Ta Ka Di Mi Ta Ta Ka Di Mi',
    description: 'Most common tala in Carnatic music',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'tala_2',
    name: 'Rupaka',
    beats: 6,
    fingerCount: 3,
    notation: 'Ta Ka Di Mi Ta Ka',
    description: 'A popular tala with 6 beats',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

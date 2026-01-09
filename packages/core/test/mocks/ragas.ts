import type { Raga } from '../../src/domain/raga/entity';

export const mockRagas: Raga[] = [
  {
    id: 'raga_1',
    name: 'Hamsadhwani',
    notes: 'S R2 G3 P N2 S',
    arohana: 'S R2 G3 P N2 S',
    avarohana: 'S N2 P G3 R2 S',
    description: 'A raga that evokes feeling of evening',
    melakarta: 28,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'raga_2',
    name: 'Kalyani',
    notes: 'S R2 G3 M2 P D2 N3 S',
    arohana: 'S R2 G3 M2 P D2 N3 S',
    avarohana: 'S N3 D2 P M2 G3 R2 S',
    description: 'One of most popular ragas in Carnatic music',
    melakarta: 65,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

import { describe, expect, it } from 'vitest';
import { computePhotoReorder, nextPhotoOrder } from './gallery-order';

describe('computePhotoReorder', () => {
  const photos = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ];

  it('is a no-op moving the first photo up', () => {
    expect(computePhotoReorder(photos, 'a', 'up')).toEqual([]);
  });

  it('is a no-op moving the last photo down', () => {
    expect(computePhotoReorder(photos, 'c', 'down')).toEqual([]);
  });

  it('swaps a middle photo up with its predecessor', () => {
    expect(computePhotoReorder(photos, 'b', 'up')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
  });

  it('swaps a middle photo down with its successor', () => {
    expect(computePhotoReorder(photos, 'b', 'down')).toEqual([
      { id: 'b', order: 2 },
      { id: 'c', order: 1 },
    ]);
  });

  it('only ever returns the two rows that changed, never the whole list', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, order: i }));
    const result = computePhotoReorder(many, 'p10', 'down');
    expect(result).toHaveLength(2);
  });

  it('returns an empty array for an unknown id', () => {
    expect(computePhotoReorder(photos, 'missing', 'up')).toEqual([]);
  });

  it('sorts unsorted input before computing the move', () => {
    const shuffled = [photos[2], photos[0], photos[1]];
    expect(computePhotoReorder(shuffled, 'b', 'up')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
  });

  it('breaks order ties by id, matching the byArtist GSI tiebreak', () => {
    const tied = [
      { id: 'x', order: 0 },
      { id: 'y', order: 0 },
      { id: 'z', order: 0 },
    ];
    // Sorted by (order, id): x, y, z — moving y up swaps with x.
    expect(computePhotoReorder(tied, 'y', 'up')).toEqual([
      { id: 'y', order: 0 },
      { id: 'x', order: 0 },
    ]);
  });
});

describe('nextPhotoOrder', () => {
  it('returns 0 for an empty gallery', () => {
    expect(nextPhotoOrder([])).toBe(0);
  });

  it('returns one past the highest existing order', () => {
    expect(
      nextPhotoOrder([
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
        { id: 'c', order: 2 },
      ])
    ).toBe(3);
  });

  it('is gap-safe: keys off the max order, not the photo count', () => {
    // Simulates a gallery of 3 with the middle photo (order 1) deleted, leaving
    // {0, 2}. Counting by length would return 2 and collide with the survivor.
    expect(
      nextPhotoOrder([
        { id: 'a', order: 0 },
        { id: 'c', order: 2 },
      ])
    ).toBe(3);
  });
});

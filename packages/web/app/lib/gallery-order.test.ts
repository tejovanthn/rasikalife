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
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('touches only the two rows that changed when the gallery is already numbered 0..n', () => {
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
    // Sorted by (order, id): x, y, z. Moving y up must actually move it — swapping the two
    // `order` values would write 0 over 0 twice and leave the gallery exactly as it was, with
    // no error and no way for the moderator to ever shift that photo.
    expect(computePhotoReorder(tied, 'y', 'up')).toEqual([
      { id: 'y', order: 0 },
      { id: 'x', order: 1 },
      { id: 'z', order: 2 },
    ]);
  });

  it('heals duplicate orders it has to renumber past', () => {
    const duplicated = [
      { id: 'a', order: 0 },
      { id: 'b', order: 0 },
      { id: 'c', order: 5 },
    ];
    const result = computePhotoReorder(duplicated, 'c', 'up');
    const finalOrders = [...duplicated]
      .map(photo => result.find(change => change.id === photo.id) ?? photo)
      .map(photo => photo.order)
      .sort((x, y) => x - y);
    expect(finalOrders).toEqual([0, 1, 2]);
  });

  it('moves a photo into the first slot, which requires writing order 0', () => {
    // The route drops a falsy 0 if it parses order with `parseInt(x) || undefined`, so this
    // move is the one that silently did nothing. Guarded here and in form-fields.test.ts.
    expect(computePhotoReorder(photos, 'b', 'up')).toContainEqual({ id: 'b', order: 0 });
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

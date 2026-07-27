// Pure ordering logic for the moderator wizard's gallery editor, kept out of the
// route module so it is testable without a component harness (this package has
// none — see app/lib/*.test.ts for the established pattern).

export interface OrderedPhoto {
  id: string;
  order: number;
}

// Matches the tiebreak the ArtistPhoto byArtist GSI uses (order, then id) — see
// packages/core/src/domain/artist-photo/entity.ts — so "up"/"down" always targets
// the neighbour the gallery actually renders next to, even if two photos share an
// `order` value.
const byOrderThenId = (a: OrderedPhoto, b: OrderedPhoto) =>
  a.order - b.order || a.id.localeCompare(b.id);

// A move only ever changes the moved photo and the neighbour it swaps places
// with — never a renumbering of the whole gallery. Returns the (at most two)
// {id, order} pairs that changed; a move at either end of the list is a no-op
// and returns an empty array.
export function computePhotoReorder(
  photos: OrderedPhoto[],
  id: string,
  direction: 'up' | 'down'
): OrderedPhoto[] {
  const sorted = [...photos].sort(byOrderThenId);
  const index = sorted.findIndex(photo => photo.id === id);
  if (index === -1) return [];

  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= sorted.length) return [];

  const current = sorted[index];
  const neighbor = sorted[neighborIndex];
  return [
    { id: current.id, order: neighbor.order },
    { id: neighbor.id, order: current.order },
  ];
}

// Appends after the highest existing `order`, not the photo count: deleting a
// photo shrinks the count but not the max, so indexing by count risks a new
// photo colliding with a surviving one's order (e.g. photos at order 0 and 2 —
// one deleted from the middle — would both reuse order 2 if keyed off length).
export function nextPhotoOrder(photos: OrderedPhoto[]): number {
  if (photos.length === 0) return 0;
  return Math.max(...photos.map(photo => photo.order)) + 1;
}

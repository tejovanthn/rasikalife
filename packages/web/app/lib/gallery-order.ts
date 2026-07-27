// Pure ordering logic for the moderator wizard's gallery editor, kept out of the
// route module so it is testable without a component harness (this package has
// none — see app/lib/*.test.ts for the established pattern).

export interface OrderedPhoto {
  id: string;
  order: number;
}

// Matches the tiebreak the ArtistPhoto byArtist GSI uses (order, then id) — see
// packages/core/src/domain/artist-photo/entity.ts — so the list we compute against
// is the list the gallery actually renders.
const byOrderThenId = (a: OrderedPhoto, b: OrderedPhoto) =>
  a.order - b.order || a.id.localeCompare(b.id);

// Renumbers the moved list by position and returns only the rows whose `order` actually
// changes. Usually that is two rows; it is more when the gallery holds duplicate `order`
// values, which is exactly the case a swap could not handle.
//
// Swapping the two orders looks cheaper and was the first implementation, but it is a silent
// no-op whenever the two photos share an `order` — writing each one the value it already had.
// Duplicates are easy to come by: `addArtistPhoto` defaults `order` to 0, and any half-applied
// reorder leaves one behind. Renumbering both fixes the move and heals the duplicates on the
// way past, so a gallery can never get stuck. Galleries are capped at 24 photos, so the
// worst-case write count is not worth optimising for.
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

  const moved = [...sorted];
  [moved[index], moved[neighborIndex]] = [moved[neighborIndex], moved[index]];

  return moved
    .map((photo, position) => ({ id: photo.id, order: position }))
    .filter((change, position) => {
      const before = sorted[position];
      return change.id !== before.id || change.order !== before.order;
    });
}

// Appends after the highest existing `order`, not the photo count: deleting a
// photo shrinks the count but not the max, so indexing by count risks a new
// photo colliding with a surviving one's order (e.g. photos at order 0 and 2 —
// one deleted from the middle — would both reuse order 2 if keyed off length).
export function nextPhotoOrder(photos: OrderedPhoto[]): number {
  if (photos.length === 0) return 0;
  return Math.max(...photos.map(photo => photo.order)) + 1;
}

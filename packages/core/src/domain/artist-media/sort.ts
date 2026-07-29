/**
 * Ordering for media items, in its own module so the browser can import it.
 *
 * `index.ts` reaches ElectroDB through `entity.ts`, so anything a web route needs has to
 * live outside it (§11.2). The profile sorts the rows it already holds rather than asking
 * the server to re-sort them.
 */

/**
 * Newest coverage first, with undated items last rather than jumbled among the dated ones.
 *
 * The entity has no date in its sort key deliberately, so the order is applied here. An
 * artist has tens of these, not thousands.
 */
export function sortArtistMedia<T extends { publishedOn?: string; title: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    if (a.publishedOn && b.publishedOn) {
      // ISO dates compare correctly as strings, newest first.
      const byDate = b.publishedOn.localeCompare(a.publishedOn);
      if (byDate !== 0) return byDate;
    } else if (a.publishedOn !== b.publishedOn) {
      // One is dated and the other is not: the dated one leads.
      return a.publishedOn ? -1 : 1;
    }
    // Tie-break on title so the order is stable rather than dependent on scan order.
    return a.title.localeCompare(b.title);
  });
}

// Event.getEvent returns null when the row is gone. A missing event cannot be
// listed, so it is left out of the result instead of crashing the caller.
export function collectFound<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => item != null);
}

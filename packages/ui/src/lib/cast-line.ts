/**
 * A stored `EventArtist` credit as words a reader can take in: "chief-guest" and
 * "guest_of_honour" are slugs typed by whoever verified the poster, and printing them raw put
 * hyphens in the middle of a cast list. Lowercase, so it sits inside a sentence or a bracket;
 * a caller that wants a heading can capitalise it with CSS.
 */
export function roleLabel(role: string): string {
  const label = role.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  // Billing positions, not instruments: the event crawl stores "main" and "accompanist" when a
  // listing names no instrument. "Sandeep Narayan (main)" tells a reader nothing.
  return GENERIC_ROLES.has(label) ? '' : label;
}

/** Roles that say where someone was billed, not what they played. Kept in step with core's
 * `shared/event-card.ts`. */
export const GENERIC_ROLES = new Set(['main', 'accompanist', 'performer', 'artist', 'artiste']);

/**
 * An event's cast on one line, each with what they played: "Vid. Sunil Gargyan (vocal),
 * Keshav Mohankumar (violin)". The role is the stored `EventArtist` credit, read off the
 * poster; the accompanists are who a rasika is often choosing between concerts for.
 */
export function castLine(
  artists: Array<{ title?: string | null; name: string; role?: string | null }>,
  opts: { max?: number } = {}
): string {
  const named = artists.map(a => {
    const name = `${a.title ? `${a.title} ` : ''}${a.name}`;
    const role = a.role ? roleLabel(a.role) : '';
    return role ? `${name} (${role})` : name;
  });
  // A card has room for a concert's cast, not a production's: one Ramayana presentation
  // credits about thirty singers. The event page lists everyone.
  const { max } = opts;
  if (!max || named.length <= max) return named.join(', ');
  return `${named.slice(0, max).join(', ')} and ${named.length - max} more`;
}

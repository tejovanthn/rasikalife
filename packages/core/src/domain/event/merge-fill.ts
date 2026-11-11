/**
 * What a merge copies onto the surviving event before the other one is retired.
 *
 * Two entries of one concert hold different halves of the record: one has the cast, the other
 * the contact numbers. `mergeEvent` moves the junctions (cast, RSVPs, logs) but the loser is then
 * soft-deleted with whatever only it held. Blanks only, nothing overwritten — the rule
 * `artistMergeFillPatch` and the raga `mergeFillPatch` follow — because what the survivor holds
 * was put there by a person or a reviewed submission.
 *
 * Left out on purpose: `title` and `startDateTime` (they name the event), `venueId` (the pair was
 * found by sharing it), `status` and every moderator field, and `entryType` (it defaults to
 * `free`, so "blank" cannot be told from "chosen").
 *
 * Pairs travel together. An organiser id without its name, or a festival id without its name, is
 * a half-written link.
 */

const SINGLE_FIELDS = [
  'description',
  'endDateTime',
  'posterUrl',
  'posterOgUrl',
  'posterUploadId',
  'artForm',
  'venueCity',
  'venueAddress',
  'ticketing',
  'contactInfo',
  'sponsors',
  'tags',
  'artists',
] as const;

const PAIRS = [
  ['organiserId', 'organiserName'],
  ['festivalId', 'festivalName'],
] as const;

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value).every(isBlank);
  return false;
}

export function eventMergeFillPatch(
  survivor: Record<string, unknown>,
  loser: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of SINGLE_FIELDS) {
    if (isBlank(survivor[field]) && !isBlank(loser[field])) patch[field] = loser[field];
  }
  for (const [id, name] of PAIRS) {
    if (isBlank(survivor[id]) && !isBlank(loser[id])) {
      patch[id] = loser[id];
      if (!isBlank(loser[name])) patch[name] = loser[name];
    }
  }
  return patch;
}

/**
 * Which of two events to keep: more billed artists first, then a poster, then the older row (its
 * URL has been indexed longest). An approved event always beats a submitted one, since the
 * keeper of a live URL must be live.
 */
export function suggestEventKeeper<
  T extends {
    id: string;
    status?: string | null;
    createdAt?: string;
    posterUrl?: string | null;
    artists?: unknown[] | null;
  },
>(a: T, b: T): { keeper: T; loser: T } {
  const approved = (e: T) => (e.status === 'approved' ? 1 : 0);
  const cast = (e: T) => e.artists?.length ?? 0;
  const poster = (e: T) => (e.posterUrl ? 1 : 0);
  const age = (e: T) => Date.parse(e.createdAt ?? '') || Number.MAX_SAFE_INTEGER;
  const keepA =
    approved(a) !== approved(b)
      ? approved(a) > approved(b)
      : cast(a) !== cast(b)
        ? cast(a) > cast(b)
        : poster(a) !== poster(b)
          ? poster(a) > poster(b)
          : age(a) !== age(b)
            ? age(a) < age(b)
            : a.id < b.id;
  return keepA ? { keeper: a, loser: b } : { keeper: b, loser: a };
}

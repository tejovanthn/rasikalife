/**
 * What a merge must copy onto the surviving artist before the other record is retired.
 *
 * `mergeArtist` re-points events, compositions and junctions, but it does not copy fields: the
 * loser is soft-deleted with whatever it alone held. Two copies of one person routinely hold
 * different halves of the record — one researched (website, city), the other with an honorific
 * or an instrument read off a poster — so merging without this throws a half away.
 *
 * Blanks only, nothing overwritten, the same rule as the raga merge (`mergeFillPatch`): what the
 * survivor holds was put there by a person or a reviewed import.
 *
 * `isGroup` is left out on purpose. Flipping it strands membership edges, which is why
 * `artist.update` is a moderator procedure at all.
 */

export const ARTIST_FILLABLE_FIELDS = [
  'title',
  'instrument',
  'city',
  'biography',
  'gurus',
  'specialisations',
  'birthYear',
  'birthPlace',
  'practiceStartYear',
  'debutYear',
  'credentials',
  'works',
  'arangetramYear',
  'arangetramGuruId',
  'arangetramVenueId',
  'website',
  'socialLinks',
  'activeYears',
  'photoUrl',
] as const;

type Fillable = Partial<Record<(typeof ARTIST_FILLABLE_FIELDS)[number], unknown>>;

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function artistMergeFillPatch(survivor: Fillable, loser: Fillable): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of ARTIST_FILLABLE_FIELDS) {
    if (isBlank(survivor[field]) && !isBlank(loser[field])) patch[field] = loser[field];
  }
  return patch;
}

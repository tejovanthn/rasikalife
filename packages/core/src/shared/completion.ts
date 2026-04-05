type CheckFn = (entity: Record<string, unknown>) => boolean;

interface FieldRule {
  weight: number;
  check: CheckFn;
}

export type CompletionEntityType =
  | 'artist'
  | 'raga'
  | 'tala'
  | 'composition'
  | 'venue'
  | 'organiser'
  | 'festival';

const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.length > 0;
const isNonEmptyArray = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

const FIELD_RULES: Record<CompletionEntityType, FieldRule[]> = {
  artist: [
    { weight: 25, check: e => isNonEmptyString(e.biography) },
    { weight: 15, check: e => isNonEmptyArray(e.specialisations) },
    { weight: 10, check: e => isNonEmptyArray(e.gurus) },
    { weight: 10, check: e => typeof e.birthYear === 'number' },
    { weight: 10, check: e => isNonEmptyString(e.birthPlace) },
    { weight: 10, check: e => isNonEmptyString(e.title) },
    { weight: 10, check: e => isNonEmptyString(e.website) },
    { weight: 10, check: e => isNonEmptyArray(e.socialLinks) },
  ],
  raga: [
    { weight: 20, check: e => isNonEmptyString(e.description) },
    { weight: 15, check: e => isNonEmptyString(e.tradition) },
    { weight: 15, check: e => isNonEmptyString(e.arohanam) },
    { weight: 15, check: e => isNonEmptyString(e.avarohanam) },
    { weight: 10, check: e => isNonEmptyString(e.rasa) },
    { weight: 10, check: e => isNonEmptyString(e.timeOfDay) },
    { weight: 10, check: e => typeof e.melaNumber === 'number' },
    { weight: 5, check: e => e.parentRaga != null },
  ],
  tala: [
    { weight: 30, check: e => isNonEmptyString(e.description) },
    { weight: 25, check: e => isNonEmptyString(e.tradition) },
    { weight: 25, check: e => typeof e.aksharas === 'number' },
    { weight: 20, check: e => e.angaStructure != null },
  ],
  composition: [
    { weight: 40, check: e => isNonEmptyArray(e.lyricsV1) },
    { weight: 30, check: e => isNonEmptyArray(e.ragas) },
    { weight: 20, check: e => isNonEmptyArray(e.talas) },
    { weight: 10, check: e => isNonEmptyString(e.sourceAttribution) },
  ],
  venue: [
    { weight: 20, check: e => isNonEmptyString(e.description) },
    { weight: 15, check: e => isNonEmptyString(e.venueType) },
    {
      weight: 15,
      check: e => {
        const addr = e.address as Record<string, unknown> | undefined;
        return isNonEmptyString(addr?.city);
      },
    },
    { weight: 10, check: e => isNonEmptyString(e.website) },
    { weight: 10, check: e => typeof e.capacity === 'number' },
    { weight: 10, check: e => isNonEmptyString(e.phone) },
    { weight: 10, check: e => isNonEmptyString(e.email) },
    { weight: 10, check: e => isNonEmptyString(e.mapLink) },
  ],
  organiser: [
    { weight: 20, check: e => isNonEmptyString(e.description) },
    { weight: 15, check: e => isNonEmptyString(e.organisationType) },
    { weight: 15, check: e => isNonEmptyString(e.website) },
    { weight: 15, check: e => isNonEmptyArray(e.socialLinks) },
    { weight: 10, check: e => isNonEmptyString(e.city) },
    { weight: 10, check: e => isNonEmptyString(e.email) },
    { weight: 10, check: e => typeof e.foundedYear === 'number' },
    { weight: 5, check: e => isNonEmptyString(e.phone) },
  ],
  festival: [
    { weight: 35, check: e => isNonEmptyString(e.description) },
    { weight: 25, check: e => isNonEmptyString(e.posterUrl) },
    {
      weight: 20,
      check: e => isNonEmptyString(e.organiserId) || isNonEmptyString(e.organiserName),
    },
    { weight: 10, check: e => isNonEmptyArray(e.tags) },
    { weight: 10, check: e => isNonEmptyArray(e.sponsors) },
  ],
};

/**
 * Compute a 0–100 completion score for an entity based on how many optional
 * enrichment fields are filled in. Lower scores mean more enrichment is needed.
 */
export function computeCompletionScore(
  entity: Record<string, unknown>,
  type: CompletionEntityType
): number {
  const rules = FIELD_RULES[type];
  let score = 0;
  for (const rule of rules) {
    if (rule.check(entity)) {
      score += rule.weight;
    }
  }
  return score;
}

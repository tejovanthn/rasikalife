type CheckFn = (entity: Record<string, unknown>) => boolean;

interface FieldRule {
  weight: number;
  check: CheckFn;
  /**
   * What a contributor would call this gap, in the words a prompt can use directly:
   * "Add your affiliations", not "affiliations is falsy". Only read by `missingFields`.
   */
  label: string;
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
  /**
   * Every rule here reads a field stored **on the artist record**, and that constraint is
   * load-bearing. The moderator enrichment queue scores 100 artists straight off
   * `artist.list`, which never loads a junction — so scoring affiliations here would mark
   * every artist in the pool incomplete and make the ranking meaningless. The profile's
   * claim prompt, which does load them, adds that gap itself.
   *
   * The weights shifted when bios stopped being the goal: the target is now roughly 120
   * words of narrative, with the facts in their own fields, so a long `biography` earns
   * less than it used to and `gurus` earns more — in this domain lineage is the credential.
   */
  artist: [
    { weight: 20, check: e => isNonEmptyString(e.biography), label: 'a short biography' },
    { weight: 15, check: e => isNonEmptyArray(e.gurus), label: 'gurus and lineage' },
    { weight: 13, check: e => isNonEmptyArray(e.specialisations), label: 'specialisations' },
    { weight: 10, check: e => isNonEmptyArray(e.works), label: 'productions and works' },
    { weight: 10, check: e => isNonEmptyString(e.title), label: 'a title' },
    { weight: 9, check: e => typeof e.birthYear === 'number', label: 'a birth year' },
    { weight: 8, check: e => isNonEmptyString(e.birthPlace), label: 'a birth place' },
    { weight: 8, check: e => isNonEmptyString(e.website), label: 'a website' },
    { weight: 7, check: e => isNonEmptyArray(e.socialLinks), label: 'social links' },
  ],
  raga: [
    { weight: 20, check: e => isNonEmptyString(e.description), label: 'a description' },
    { weight: 15, check: e => isNonEmptyString(e.tradition), label: 'a tradition' },
    { weight: 15, check: e => isNonEmptyString(e.arohanam), label: 'an arohanam' },
    { weight: 15, check: e => isNonEmptyString(e.avarohanam), label: 'an avarohanam' },
    { weight: 10, check: e => isNonEmptyString(e.rasa), label: 'a rasa' },
    { weight: 10, check: e => isNonEmptyString(e.timeOfDay), label: 'a time of day' },
    { weight: 10, check: e => typeof e.melaNumber === 'number', label: 'a mela number' },
    { weight: 5, check: e => e.parentRaga != null, label: 'a parent raga' },
  ],
  tala: [
    { weight: 30, check: e => isNonEmptyString(e.description), label: 'a description' },
    { weight: 25, check: e => isNonEmptyString(e.tradition), label: 'a tradition' },
    { weight: 25, check: e => typeof e.aksharas === 'number', label: 'an akshara count' },
    { weight: 20, check: e => e.angaStructure != null, label: 'an anga structure' },
  ],
  composition: [
    { weight: 40, check: e => isNonEmptyArray(e.lyricsV1), label: 'lyrics' },
    { weight: 30, check: e => isNonEmptyArray(e.ragas), label: 'ragas' },
    { weight: 20, check: e => isNonEmptyArray(e.talas), label: 'talas' },
    { weight: 10, check: e => isNonEmptyString(e.sourceAttribution), label: 'a source' },
  ],
  venue: [
    { weight: 20, check: e => isNonEmptyString(e.description), label: 'a description' },
    { weight: 15, check: e => isNonEmptyString(e.venueType), label: 'a venue type' },
    {
      weight: 15,
      check: e => {
        const addr = e.address as Record<string, unknown> | undefined;
        return isNonEmptyString(addr?.city);
      },
      label: 'a city',
    },
    { weight: 10, check: e => isNonEmptyString(e.website), label: 'a website' },
    { weight: 10, check: e => typeof e.capacity === 'number', label: 'a capacity' },
    { weight: 10, check: e => isNonEmptyString(e.phone), label: 'a phone number' },
    { weight: 10, check: e => isNonEmptyString(e.email), label: 'an email address' },
    { weight: 10, check: e => isNonEmptyString(e.mapLink), label: 'a map link' },
  ],
  organiser: [
    { weight: 20, check: e => isNonEmptyString(e.description), label: 'a description' },
    { weight: 15, check: e => isNonEmptyString(e.organisationType), label: 'an organisation type' },
    { weight: 15, check: e => isNonEmptyString(e.website), label: 'a website' },
    { weight: 15, check: e => isNonEmptyArray(e.socialLinks), label: 'social links' },
    { weight: 10, check: e => isNonEmptyString(e.city), label: 'a city' },
    { weight: 10, check: e => isNonEmptyString(e.email), label: 'an email address' },
    { weight: 10, check: e => typeof e.foundedYear === 'number', label: 'a founding year' },
    { weight: 5, check: e => isNonEmptyString(e.phone), label: 'a phone number' },
  ],
  festival: [
    { weight: 35, check: e => isNonEmptyString(e.description), label: 'a description' },
    { weight: 25, check: e => isNonEmptyString(e.posterUrl), label: 'a poster' },
    {
      weight: 20,
      check: e => isNonEmptyString(e.organiserId) || isNonEmptyString(e.organiserName),
      label: 'an organiser',
    },
    { weight: 10, check: e => isNonEmptyArray(e.tags), label: 'tags' },
    { weight: 10, check: e => isNonEmptyArray(e.sponsors), label: 'sponsors' },
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

/**
 * The unfilled fields, heaviest first, labelled for a reader.
 *
 * This is what turns a claim prompt from "Are you Yagnika? Claim this profile" into "Are you
 * Yagnika? Add your affiliations" — naming the gap converts better than a generic ask, and it
 * is also what lets a page hide sections it has nothing to put in. Ordering by weight means
 * the first entry is always the most worth asking for.
 */
export function missingFields(
  entity: Record<string, unknown>,
  type: CompletionEntityType
): string[] {
  return FIELD_RULES[type]
    .filter(rule => !rule.check(entity))
    .sort((a, b) => b.weight - a.weight)
    .map(rule => rule.label);
}

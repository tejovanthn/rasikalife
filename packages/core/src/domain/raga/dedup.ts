/**
 * Matching keys for finding the same raga stored twice.
 *
 * The corpus carries two import generations, and the same raga appears in both
 * under different spellings — `aabheri` beside `abheri`, `hamirkalyani` beside
 * `hamir-kalyani`, `kalyANi` beside `kalyani (meca kalyani, shantakalyani)`.
 * Around 312 of 1,869 raga pages are a second copy of one already on the site.
 *
 * Two keys, because the two carry very different confidence. `ragaExactKey` only
 * removes what is certainly noise — case, diacritics, punctuation, the alias
 * bracket — so a collision is a real duplicate. `ragaVariantKey` guesses at
 * transliteration spelling and will occasionally collide two genuinely different
 * ragas, so nothing it matches may be merged without a person looking.
 */

/** Case, diacritics, punctuation and alias brackets removed. A collision here is real. */
export function ragaExactKey(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Collapses the ways one raga gets spelled: doubled vowels marking length
 * (`bahudaari`/`bahudari`), c/k, sh/s, w/v, and a trailing -m or -am.
 *
 * Lossy on purpose, and it does collide distinct ragas — which is why the dedup
 * CLI reports variant matches for review rather than applying them.
 */
export function ragaVariantKey(name: string): string {
  let key = ragaExactKey(name);
  // Long vowels first: collapsing doubles first turned `ee` into `e` and `oo`
  // into `o`, so `gaanamoorti` never met `ganamurti`, nor `eesa` met `isa`.
  key = key.replace(/ee/g, 'i').replace(/oo/g, 'u');
  key = key.replace(/(.)\1+/g, '$1');
  // Aspirates and the dental/retroflex pairs that romanisations drop:
  // `hamsadhvani`/`hamsadwani`, `gambheera`/`gambhira`.
  key = key.replace(/kh/g, 'k').replace(/sh/g, 's').replace(/c/g, 'k').replace(/w/g, 'v');
  key = key.replace(/dh/g, 'd').replace(/th/g, 't');
  // `hindolam` and `hindola` are one raga written two ways, so the ending has to
  // go entirely rather than just its -am form.
  key = key.replace(/(am|m|a)$/, '');
  return key;
}

/** Swara notation compared as notation: case, spacing and punctuation ignored. */
export function swaraKey(scale?: string | null): string {
  return (scale ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export type DuplicateEvidence = {
  name: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  melaNumber?: number | null;
  parentRaga?: { name: string } | null;
};

export type DuplicateConfidence = 'high' | 'medium' | 'low';

/**
 * Whether two name-matched ragas are one raga, judged from what they store.
 *
 * - `low`: the records contradict each other: a different arohanam or
 *   avarohanam, a different mela, a different parent, or one melakarta and one
 *   janya. Treat as a false match.
 * - `high`: nothing contradicts, and either the names differ only by noise
 *   (`exact` tier) or both scales are stored and agree.
 * - `medium`: nothing contradicts, but the scale is missing on one side, so
 *   only the name says they are the same. A person decides.
 */
export function assessRagaDuplicate(
  tier: 'exact' | 'variant',
  a: DuplicateEvidence,
  b: DuplicateEvidence
): { confidence: DuplicateConfidence; reason: string } {
  const conflicts: string[] = [];
  const agreements: string[] = [];

  for (const field of ['arohanam', 'avarohanam'] as const) {
    const ka = swaraKey(a[field]);
    const kb = swaraKey(b[field]);
    if (ka && kb) {
      if (ka === kb) agreements.push(`same ${field}`);
      else conflicts.push(`${field} differs`);
    }
  }

  if (a.melaNumber && b.melaNumber) {
    if (a.melaNumber === b.melaNumber) agreements.push(`same mela ${a.melaNumber}`);
    else conflicts.push(`mela ${a.melaNumber} vs ${b.melaNumber}`);
  }

  const pa = a.parentRaga?.name;
  const pb = b.parentRaga?.name;
  if (pa && pb) {
    if (ragaVariantKey(pa) === ragaVariantKey(pb)) agreements.push('same parent');
    else conflicts.push(`parent ${pa} vs ${pb}`);
  } else if ((pa || pb) && a.melaNumber && b.melaNumber) {
    // Both carry a mela, but only one names a parent: one is stored as the
    // melakarta itself and the other as a janya of it.
    conflicts.push('one melakarta, one janya');
  }

  const nameNote = tier === 'exact' ? 'names differ only in case or marks' : 'spelling variant';

  if (conflicts.length > 0) {
    return { confidence: 'low', reason: `${nameNote}; ${conflicts.join(', ')}` };
  }
  const bothScales = agreements.includes('same arohanam') && agreements.includes('same avarohanam');
  const detail = agreements.length > 0 ? `; ${agreements.join(', ')}` : '; no scale to compare';
  if (tier === 'exact' || bothScales) {
    return { confidence: 'high', reason: `${nameNote}${detail}` };
  }
  return { confidence: 'medium', reason: `${nameNote}${detail}` };
}

export type SurvivorStats = {
  id: string;
  /** Search Console impressions for the page, all slugs summed. */
  impressions: number;
  compositions: number;
  performances: number;
  /** Filled descriptive fields, a proxy for which record a person curated. */
  filledFields: number;
  createdAt: string;
};

/**
 * Which of two duplicates keeps its URL. Search impressions first, because that
 * page is the one Google already shows and a 301 into it loses nothing. Then
 * linked compositions and performances, then completeness, then age.
 * Negative when `a` should survive.
 */
export function compareSurvivors(a: SurvivorStats, b: SurvivorStats): number {
  if (a.impressions !== b.impressions) return b.impressions - a.impressions;
  const usesA = a.compositions + a.performances;
  const usesB = b.compositions + b.performances;
  if (usesA !== usesB) return usesB - usesA;
  if (a.filledFields !== b.filledFields) return b.filledFields - a.filledFields;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

const FILLABLE_FIELDS = [
  'arohanam',
  'avarohanam',
  'alternateScales',
  'description',
  'melaNumber',
  'parentRaga',
  'tradition',
  'rasa',
  'timeOfDay',
  'season',
] as const;

type Fillable = Partial<Record<(typeof FILLABLE_FIELDS)[number], unknown>>;

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Fields the loser holds that the survivor lacks, to copy before a merge.
 *
 * The survivor is picked by search impressions, so it is sometimes the barer
 * record: `keeravaaNi` won on impressions while `kIravANi` held the scale and
 * mela number. Without this the merge would hide the melakarta's scale behind a
 * redirect. Only blanks are filled; nothing the survivor holds is overwritten.
 */
export function mergeFillPatch(survivor: Fillable, loser: Fillable): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of FILLABLE_FIELDS) {
    if (isBlank(survivor[field]) && !isBlank(loser[field])) patch[field] = loser[field];
  }
  return patch;
}

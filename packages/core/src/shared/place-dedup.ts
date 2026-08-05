/**
 * Matching keys for finding the same hall or the same organisation stored twice.
 *
 * Venues and organisers arrived name-only, one row created every time an event named
 * something the database had not seen, so the corpus carries the same body under every
 * spelling a poster used. One hall is split six ways — `The Bangalore Gayana Samaja (R)`,
 * `Gayana Samaja`, `Gayana Samaaja`, `Bangalore Gayana Samaja`,
 * `The Bangalore Gayana Samaja Hall`, `Bengaluru Gayana Samaaja` — which splits its events
 * across six indexable URLs.
 *
 * Both domains share these keys because they are the same naming problem: Indian arts
 * institutions carrying honorifics (`Sri`, `Shree`), a registration marker (`(R)`,
 * `(Regd.)`, `®`), an optional city, an optional generic building word, and whichever
 * transliteration the person typing chose.
 *
 * Four tiers, in descending confidence, because they must not be treated alike:
 *
 *   - `placeExactKey`   — removes only what is certainly noise. A collision is real.
 *   - `placeVariantKey` — also drops honorifics, city, registration and generic building
 *                         words, then collapses transliteration spellings. Lossy, and it
 *                         will occasionally collide two genuinely different places.
 *   - `nearKeys`        — one or two letters apart (`Chowdaiah` beside `Chowdiah`), which
 *                         no rule predicts because it is simply how someone heard it.
 *   - `wordsSubsetOf`   — one name's words inside another's (`Arohy` inside
 *                         `Arohy, Shaale Building`). Usually a hall named inside its
 *                         building, which may or may not be worth merging.
 *
 * Nothing here may merge on its own. `ranjani` is not `rasikaranjani` was the raga lesson;
 * here it is that `Sri Vani Vidya Kendra` is not `Sri Vanikala Kendra`, and that a hall
 * inside a building is sometimes a real second venue worth keeping apart.
 */

/** Registration marks and the bracketed `(R)` / `(Regd.)` that mean the same thing. */
const DECORATION = /[®™©]/g;
const BRACKETED = /\s*\(.*?\)\s*/g;

/** Dropped from the front of a name; they are respect, not identity. */
const HONORIFICS = new Set(['the', 'sri', 'shri', 'shree', 'sree', 'smt', 'dr', 'srimathi']);

/** Dropped anywhere. Every one of these is Bangalore, and the events are nearly all here. */
const CITY_WORDS = new Set(['bangalore', 'bengaluru', 'bangaluru', 'banglore', 'blr']);

/** Registration words left over once the brackets are gone. */
const REGISTRATION_WORDS = new Set(['r', 'regd', 'registered', 'reg']);

/**
 * Generic building and body words. Dropping these is what lets `Seva Sadan` meet
 * `Seva Sadan Auditorium`, and it is also the most dangerous rule here — `Ananya
 * Auditorium` becomes `ananya` — so it applies only to the variant tier.
 */
const GENERIC_WORDS = new Set([
  'hall',
  'auditorium',
  'memorial',
  'building',
  'premises',
  'campus',
  'centre',
  'center',
]);

function stripDecoration(name: string): string {
  return name
    .replace(BRACKETED, ' ')
    .replace(DECORATION, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

/**
 * Case, diacritics, punctuation, bracketed asides and registration marks removed.
 * A collision here is a real duplicate: `A. D. A. Ranga Mandira` meets `ADA Rangamandira`,
 * and `Trust (R)` meets `Trust(R)`.
 */
export function placeExactKey(name: string): string {
  return stripDecoration(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]/g, '');
}

/** The significant words of a name: decoration, honorifics, city and registration gone. */
export function placeWords(name: string): string[] {
  const words = stripDecoration(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter(word => !CITY_WORDS.has(word) && !REGISTRATION_WORDS.has(word) && word !== 'and');

  // Honorifics only lead. `Sri Rama Temple` is decorated; a `Sri` deeper in the name is
  // usually part of it (`Sree Ramaseva Mandali`, `Kanchana Shree ...`).
  let start = 0;
  while (start < words.length && HONORIFICS.has(words[start])) start++;
  return words.slice(start);
}

/**
 * Collapses the ways one name gets spelled: aspirated consonants written with and without
 * their `h` (`Samskruthika`/`Samskrutika`), doubled vowels marking length
 * (`Samaaja`/`Samaja`), c/k, w/v, and a trailing `-a`.
 *
 * Lossy on purpose. Nothing it matches may be merged without a person looking.
 */
export function collapseSpelling(key: string): string {
  let out = key;
  out = out.replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a');
  out = out.replace(/(.)\1+/g, '$1');
  // Aspirates first, so `kshethra` reaches `ksetra` the same way `kshetra` does.
  out = out
    .replace(/ch/g, 'c')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/ph/g, 'p')
    .replace(/th/g, 't')
    .replace(/sh/g, 's');
  out = out.replace(/c/g, 'k').replace(/w/g, 'v').replace(/z/g, 'j');
  out = out.replace(/(.)\1+/g, '$1');
  // `Mandir` and `Mandira` are one word written two ways, as are `Samaj` and `Samaja`.
  out = out.replace(/a$/, '');
  return out;
}

/**
 * The variant key: significant words only, generic building words dropped, spelling
 * collapsed. This is what gathers the six Gayana Samaja rows into one group.
 */
export function placeVariantKey(name: string): string {
  const words = placeWords(name).filter(word => !GENERIC_WORDS.has(word));
  // A name that is nothing but generic words (`Main Auditorium`) keeps them, because an
  // empty key would collide every such row with every other.
  const significant = words.length > 0 ? words : placeWords(name);
  return collapseSpelling(significant.join(''));
}

/** Levenshtein distance, stopped early once it cannot come in under `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Two names one or two letters apart. Short names are excluded because at eight characters
 * a distance of two is most of the word, and the first letter must agree — `Seshadripuram`
 * and `Sheshadripuram` differ at the front, but two unrelated names that agree nowhere else
 * are not worth a reviewer's time.
 */
export function isNearMatch(a: string, b: string): boolean {
  if (a.length < 8 || b.length < 8) return false;
  if (a[0] !== b[0]) return false;
  return editDistance(a, b, 2) <= 2;
}

/**
 * Whether every significant word of `inner` appears in `outer`, with `outer` adding no more
 * than three of its own. Usually a hall named inside its building —
 * `Wadia Auditorium, Indian Institute of World Culture` — which is a judgement call rather
 * than a duplicate, so it is reported last and never assumed.
 */
export function wordsSubsetOf(inner: string[], outer: string[]): boolean {
  if (inner.length === 0 || outer.length <= inner.length) return false;
  if (outer.length - inner.length > 3) return false;
  // Five characters, not six, because `Arohy` is a real venue sitting inside
  // `Arohy, Shaale Building` and a six-character floor drops exactly that pair.
  if (inner.join('').length < 5) return false;
  const have = new Set(outer.map(word => collapseSpelling(word)));
  return inner.every(word => have.has(collapseSpelling(word)));
}

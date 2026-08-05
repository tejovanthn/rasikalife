/**
 * Deriving venue fields that are not stored anywhere else.
 *
 * 132 of the 132 venues in prod carry a name; 8 carry anything else. Nothing on the event
 * record fills that gap — `venueCity` is set on 5 events out of 739, and the `contactInfo`
 * block belongs to the **organiser**, not the hall (see `organiser/enrich.ts`). So the only
 * honest source for a venue is its own name.
 *
 * That limits this module to `venueType`, and only where the name states the type outright.
 * A name that does not say what the place is gets no type: "Hamsadhwani", "Arohy" and
 * "Bhoomiverse" are all real venues whose kind cannot be read off the string, and guessing
 * puts a wrong claim on a page whose whole problem is that it holds too few claims.
 */

import { VENUE_TYPES, type VenueType } from './schema';

/**
 * Lowercase, strip diacritics, and pad with spaces so ` word ` matches whole words only.
 * `Sri Pattabhirama Seva Mandali` must not match on a bare `mandal`.
 */
function normalize(name: string): string {
  return ` ${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * Ordered because names stack: "Kuteera Hall, Sri Yadugiri Yathiraja Mutt" is a hall inside a
 * mutt, and "J.N. Tata Auditorium, IISc" is an auditorium on a campus. The rule is that the
 * more specific claim wins, so a pandal beats a temple and a named auditorium beats the
 * institution hosting it.
 */
const PATTERNS: ReadonlyArray<readonly [VenueType, RegExp]> = [
  // A pandal is temporary and is put up somewhere else — usually temple or school grounds —
  // so it has to be read before either of those.
  ['pandal', / pandal /],

  // A lecture theatre is a teaching room, not a concert hall, so it is claimed by the campus
  // rule below rather than by `theatre` in the auditorium rule.
  ['university', / lecture (theatre|theater|hall) /],

  ['temple-hall', / (temple|devasthana|devalaya|mutt|math|kovil|iskcon) /],

  [
    'auditorium',
    / (auditorium|theatre|theater|rangamandira|ranga mandira|rangamancha|kalakshetra|kalakshethra|kala kshethra|concert hall) /,
  ],

  ['sabha-hall', / (sabhangana|sabha|samaja|samaaja) /],

  ['open-air', / (terrace|grounds|quadrangle|open air) |( park )/],

  ['university', / (college|university|iisc|vidyalaya) /],

  [
    'community-hall',
    / (convention hall|community hall|welfare association hall|bhavana|bhavan|mantapa|mandapa|mantapam) /,
  ],
];

/**
 * The venue type a name states outright, or `undefined` when it states none.
 *
 * Never returns `'other'`: `other` asserts that the kind was determined and is none of the
 * listed ones, which is a stronger claim than this function can make from a string.
 */
export function venueTypeFromName(name: string): VenueType | undefined {
  const n = normalize(name);
  for (const [type, pattern] of PATTERNS) {
    if (pattern.test(n)) return type;
  }
  return undefined;
}

/**
 * Names that are not places. `Zoom` and `Google Meet` arrived as venues because the importer
 * had nowhere else to put an online concert's location; they should not be sitting in the
 * venue list or the sitemap. Reported, never deleted — the events pointing at them are real.
 */
const NON_PLACE_NAMES = new Set(['zoom', 'google meet', 'google meets', 'online', 'youtube']);

export function isNonPlaceVenueName(name: string): boolean {
  return NON_PLACE_NAMES.has(name.trim().toLowerCase());
}

export { VENUE_TYPES };

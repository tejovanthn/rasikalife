import Sanscript from '@indic-transliteration/sanscript';

export type TransliterationScheme =
  | 'itrans'
  | 'roman'
  | 'iast'
  | 'devanagari'
  | 'tamil'
  | 'telugu'
  | 'kannada';

/**
 * Stored names are ITRANS with the Dravidian extensions — `E` and `O` mark the long
 * vowels that Sanskrit does not distinguish. The plain `itrans` scheme leaves those
 * two letters untouched, which is where display names like `husEni` and `vEgavAhini`
 * came from: a capital in the middle of a word that reads as broken data.
 */
const SOURCE_SCHEME = 'itrans_dravidian';

const COMBINING_MARKS = /\p{M}/gu;

/**
 * IAST with the diacritics removed — `kalyāṇi` becomes `kalyani`. This is how people
 * actually spell these names when they search, and it matches the URL slugs.
 */
function toRoman(text: string): string {
  return Sanscript.t(text, SOURCE_SCHEME, 'iast')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .normalize('NFC');
}

/**
 * Sanscript's Tamil output is Sanskrit-in-Tamil-script, and two of its habits are wrong in
 * Tamil lyrics. It marks vocalic ṛ with an apostrophe (`ஹ்ரு'தய`), which Tamil never prints;
 * and it writes ñj as ஞ்ஜ, a cluster Tamil does not use — `nenjam` is நெஞ்சம், `anjali`
 * அஞ்சலி.
 */
function tidyTamil(text: string): string {
  return text.replace(/(ரு|ரூ)'/g, '$1').replace(/ஞ்ஜ/g, 'ஞ்ச');
}

/**
 * Telugu and Kannada write a nasal before a stop or a sibilant as the anusvara — ఎందరో,
 * ವಂದನ, ಸಂಸಾರ — and sanscript spells it out as a conjunct (ఎన్దరో, ವನ್ದನ, ಸಮ್ಸಾರ), which
 * a reader of either script takes for a spelling mistake. Before another nasal, y, r, l or v
 * the conjunct is the normal spelling (అన్న, జన్మ, కన్య) and stays.
 */
const ANUSVARA_RULES: Partial<Record<TransliterationScheme, RegExp>> = {
  telugu:
    /[\u0C19\u0C1E\u0C23\u0C28\u0C2E]\u0C4D(?=[\u0C15-\u0C18\u0C1A-\u0C1D\u0C1F-\u0C22\u0C24-\u0C27\u0C2A-\u0C2D\u0C36-\u0C39])/g,
  kannada:
    /[\u0C99\u0C9E\u0CA3\u0CA8\u0CAE]\u0CCD(?=[\u0C95-\u0C98\u0C9A-\u0C9D\u0C9F-\u0CA2\u0CA4-\u0CA7\u0CAA-\u0CAD\u0CB6-\u0CB9])/g,
};
const ANUSVARA: Partial<Record<TransliterationScheme, string>> = {
  telugu: '\u0C02',
  kannada: '\u0C82',
};

export function transliterate(
  text: string,
  from: TransliterationScheme,
  to: TransliterationScheme
): string {
  if (from === to) return text;
  // `_` is ITRANS's no-op separator, and the only way to write ற்றி: `RRi` reads as vocalic
  // ṛ. Devanagari drops it; the other targets copy it through, so it is removed here.
  if (to === 'roman') return toRoman(text).replace(/_/g, '');
  // `n2` is Tamil ன. Tamil and Devanagari have a letter for it (ன, ऩ); Telugu and Kannada do
  // not, and sanscript copies the code through as a literal "n2". There it is plain n.
  // karnatik.com marks a sandhi split with a hyphen inside the line (`mahAnubhAvu-landariki`),
  // which no Indic script prints. Joined here; a hyphen ending a line is a real line break.
  const joined = text.replace(/(?<=[A-Za-z~^.])-(?=[A-Za-z~])/g, '');
  const source = to === 'telugu' || to === 'kannada' ? joined.replace(/n2/g, 'n') : joined;
  const out = Sanscript.t(source, from === 'itrans' ? SOURCE_SCHEME : from, to).replace(/_/g, '');
  if (to === 'tamil') return tidyTamil(out);
  const rule = ANUSVARA_RULES[to];
  return rule ? out.replace(rule, ANUSVARA[to] ?? '') : out;
}

/**
 * Convert a stored ITRANS name to a target scheme.
 *
 * Defaults to `roman` rather than `iast` on purpose. An anonymous visitor — and
 * Googlebot, which never carries a script cookie — should see the everyday spelling,
 * not scholarly diacritics. IAST stays available for anyone who picks it.
 */
export function fromItrans(text: string, to: TransliterationScheme = 'roman'): string {
  return transliterate(text, 'itrans', to);
}

/**
 * Swara notation (`S R2 G2 M1 P D1 N2 S`) is not a word and must never be
 * transliterated. Its letters collide with ITRANS consonant codes — `S` means the
 * retroflex `ṣ`, `D` means `ḍ` — so running an arohanam through `fromItrans` turned
 * every raga's defining feature into `ṣ ṟ2 ġ2 ṃ1 P ḍ1 ṇ2 ṣ`.
 *
 * Swaras are uppercased and spaced; the variant digits that follow them are kept.
 */
export function formatSwaras(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/^[a-zA-Z]+/, letters => letters.toUpperCase()))
    .join(' ');
}

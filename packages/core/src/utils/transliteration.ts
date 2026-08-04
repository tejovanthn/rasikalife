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

export function transliterate(
  text: string,
  from: TransliterationScheme,
  to: TransliterationScheme
): string {
  if (from === to) return text;
  if (to === 'roman') return toRoman(text);
  return Sanscript.t(text, from === 'itrans' ? SOURCE_SCHEME : from, to);
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

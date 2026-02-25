import Sanscript from '@indic-transliteration/sanscript';

export type TransliterationScheme =
  | 'itrans'
  | 'iast'
  | 'devanagari'
  | 'tamil'
  | 'telugu'
  | 'kannada';

export function transliterate(
  text: string,
  from: TransliterationScheme,
  to: TransliterationScheme
): string {
  if (from === to) return text;
  return Sanscript.t(text, from, to);
}

// Convenience: convert from ITRANS to a target scheme
export function fromItrans(text: string, to: TransliterationScheme = 'iast'): string {
  return transliterate(text, 'itrans', to);
}

/**
 * The search phrases whose volume stands for a composition or a raga.
 *
 * Keyword Planner counts one spelling at a time, and spelling decides the number. On
 * 2026-10-27 "chintaya ma" had no volume because people type "chintayama", while
 * "koluvaiyunnade" had 170 a month. So each name is asked in several spellings and the
 * highest wins (`bestVolume`). Never summed: Google merges close variants into one row, so a
 * sum would count the same searches twice.
 *
 * Browser-safe and pure; the CLI writes these out and imports the volumes back.
 */

import { fromItrans } from '../utils/transliteration';

/** Keyword Planner refuses a keyword over 80 characters or 10 words. */
const MAX_CHARS = 80;
const MAX_WORDS = 10;

/** `roman` display, lowercased, punctuation and qualifiers removed. */
export function romanPhrase(itrans: string): string {
  return fromItrans(itrans, 'roman')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The common way to type a long vowel: one letter. `raaga` → `raga`, `seeta` → `sita`. */
export function foldVowels(phrase: string): string {
  return phrase
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/([a-z])\1+/g, '$1');
}

/**
 * How people type what IAST writes as `c`: "chintayama", not "cintayama". The `roman` view keeps
 * `c` because it is what the URL slugs hold; search boxes do not.
 */
export function typedSpelling(phrase: string): string {
  return phrase.replace(/c(?!h)/g, 'ch');
}

function usable(phrases: string[]): string[] {
  return [
    ...new Set(
      phrases
        .map(p => p.replace(/\s+/g, ' ').trim())
        .filter(p => p.length >= 3 && p.length <= MAX_CHARS)
        .filter(p => p.split(' ').length <= MAX_WORDS)
    ),
  ];
}

const TYPE_WORDS: Record<string, string> = {
  varnam: 'varnam',
  kriti: 'kriti',
  krithi: 'kriti',
  keertanam: 'keerthanam',
  kirtana: 'keerthanam',
  javali: 'javali',
  tillana: 'thillana',
  padam: 'padam',
  geetam: 'geetham',
  swarajati: 'swarajathi',
};

/** Phrases for a composition: its title as typed, joined, folded, and with its form. */
export function compositionKeywords(c: { title: string; compositionType?: string }): string[] {
  const title = romanPhrase(c.title);
  if (!title) return [];
  const folded = foldVowels(typedSpelling(title));
  const form = TYPE_WORDS[(c.compositionType ?? '').toLowerCase()];
  return usable([
    title,
    folded,
    title.replace(/ /g, ''),
    folded.replace(/ /g, ''),
    ...(form ? [`${folded} ${form}`] : []),
  ]);
}

/** Phrases for a raga: "<name> raga" and "<name> ragam", as typed and folded. */
export function ragaKeywords(name: string): string[] {
  const roman = romanPhrase(name);
  if (!roman) return [];
  const folded = foldVowels(typedSpelling(roman));
  return usable([`${roman} raga`, `${folded} raga`, `${folded} ragam`]);
}

/**
 * The highest volume among an entity's phrases. Keyword Planner reports in lowercase and may
 * reorder words of a merged variant, so the lookup ignores case.
 */
export function bestVolume(phrases: string[], volumes: ReadonlyMap<string, number>): number {
  let best = 0;
  for (const p of phrases) best = Math.max(best, volumes.get(p.toLowerCase()) ?? 0);
  return best;
}

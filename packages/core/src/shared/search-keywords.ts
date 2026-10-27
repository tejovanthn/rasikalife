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
 * How people type a name: "chintayama", "shankarabharanam", "ritigaula". Read from IAST, which
 * still tells ś from s and c from ch; the `roman` view has already merged them, because it is
 * what the URL slugs hold. Qualifiers in brackets are dropped.
 */
export function typedSpelling(itrans: string): string {
  return fromItrans(itrans, 'iast')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\u015b|\u1e63/g, 'sh') // ś, ṣ
    .replace(/\u1e5b/g, 'ri') // ṛ
    .replace(/c(?!h)/g, 'ch')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The other names a raga is stored with, from its brackets: `Ahiri bhairavi (Ahir bhairav)`
 * is also searched as "ahir bhairav". Ragas only: a composition's brackets hold a qualifier
 * such as `(varNam)`, not a second name.
 */
export function bracketAliases(itrans: string): string[] {
  return [...itrans.matchAll(/\(([^)]*)\)/g)]
    .flatMap(m => (m[1] ?? '').split(/[,/;]/))
    .map(a => a.trim())
    .filter(a => a.length >= 3);
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
  const folded = foldVowels(typedSpelling(c.title));
  const form = TYPE_WORDS[(c.compositionType ?? '').toLowerCase()];
  return usable([
    title,
    folded,
    title.replace(/ /g, ''),
    folded.replace(/ /g, ''),
    ...(form ? [`${folded} ${form}`] : []),
  ]);
}

/** Phrases for a raga and each bracketed alias: "<name> raga" and "<name> ragam". */
export function ragaKeywords(name: string): string[] {
  const names = [name.replace(/\([^)]*\)/g, ' '), ...bracketAliases(name)];
  return usable(
    names.flatMap(n => {
      const roman = romanPhrase(n);
      if (!roman) return [];
      const typed = foldVowels(typedSpelling(n));
      return [`${roman} raga`, `${typed} raga`, `${typed} ragam`];
    })
  );
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

/** "1,300" → 1300, "1K" → 1000, "1K – 10K" → 1000 (a range counts as its lower bound). */
export function plannerNumber(cell: string): number | undefined {
  const low = cell.split(/[–-]/)[0]?.trim().replace(/,/g, '') ?? '';
  const m = /^(\d+(?:\.\d+)?)\s*([KM])?$/i.exec(low);
  if (!m) return undefined;
  const scale = m[2]?.toUpperCase() === 'M' ? 1e6 : m[2] ? 1e3 : 1;
  return Math.round(Number(m[1]) * scale);
}

/**
 * Keyword → monthly volume from either a plain `keyword,avg_monthly_searches` CSV or Keyword
 * Planner's own download: tab-separated, a title and a date line above the header, and
 * "Avg. monthly searches" as a number or, on an account without ad spend, a range. A range is
 * read as its lower bound, which keeps the order and claims no more than the planner said.
 */
export function parsePlannerVolumes(text: string): Map<string, number> {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerAt = lines.findIndex(l => /^"?keyword"?[\t,]/i.test(l.trim()));
  if (headerAt < 0) throw new Error('no header row starting with "Keyword"');
  const delimiter = lines[headerAt]?.includes('\t') ? '\t' : ',';
  const cells = (line: string) =>
    line.split(delimiter).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
  const header = cells(lines[headerAt] as string).map(h => h.toLowerCase());
  const volumeCol = header.findIndex(
    h => h === 'avg_monthly_searches' || h === 'avg. monthly searches'
  );
  if (volumeCol < 0) throw new Error('no "Avg. monthly searches" column');

  const volumes = new Map<string, number>();
  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim()) continue;
    const row = cells(line);
    const keyword = row[0]?.toLowerCase();
    const n = plannerNumber(row[volumeCol] ?? '');
    if (keyword && n !== undefined) volumes.set(keyword, n);
  }
  return volumes;
}

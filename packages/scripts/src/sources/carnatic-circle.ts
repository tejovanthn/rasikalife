import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CARNATIC_CIRCLE_API,
  type WpPage,
  parseSongPage,
  selectSongPages,
} from '@rasika/core/domain/composition/carnatic-circle';
import type { SourceRecord } from '@rasika/core/domain/composition/source-import';
import type { SourceAdapter } from './types.js';

/**
 * carnatic-circle.com, a Midlands (UK) bhajan and Carnatic music group: mostly the
 * sampradaya bhajan repertoire (divyanaamam, ashtapadis, tarangini) and kritis, as lyrics.
 * WordPress, so the whole site is read once from the REST API and parsed on load: a
 * parser change needs no refetch. Delete `pages.json` to fetch again.
 */

const USER_AGENT = 'rasika.life archive import (+https://rasika.life)';
const FIELDS = 'id,parent,link,title,content,modified';

async function fetchPages(outDir: string): Promise<void> {
  const file = path.join(outDir, 'pages.json');
  if (existsSync(file)) {
    console.log(`📚 ${file} is already here; delete it to fetch again`);
    return;
  }
  const pages: WpPage[] = [];
  for (let page = 1; ; page++) {
    const url = `${CARNATIC_CIRCLE_API}?per_page=100&page=${page}&_fields=${FIELDS}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    // WordPress answers a page past the end with 400.
    if (response.status === 400) break;
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const batch = (await response.json()) as WpPage[];
    pages.push(...batch);
    console.log(`  ${pages.length} pages`);
    if (batch.length < 100) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, JSON.stringify(pages));
  console.log(`✅ wrote ${pages.length} pages to ${file}`);
}

function load(outDir: string): SourceRecord[] {
  const file = path.join(outDir, 'pages.json');
  if (!existsSync(file)) throw new Error(`${file} is missing; run source-fetch first`);
  const pages = JSON.parse(readFileSync(file, 'utf8')) as WpPage[];
  const byId = new Map(pages.map(page => [page.id, page]));
  const ancestors = (page: WpPage) => {
    const chain: WpPage[] = [];
    for (let up = byId.get(page.parent); up; up = byId.get(up.parent)) chain.unshift(up);
    return chain;
  };

  const records: SourceRecord[] = [];
  for (const page of selectSongPages(pages)) {
    const song = parseSongPage(page, ancestors(page));
    if (!song) continue;
    records.push({
      key: song.url,
      title: song.title,
      raga: song.raga,
      tala: song.tala,
      composer: song.composer,
      // Only the page: the videos embedded on it are often someone else's concert.
      sources: [song.url],
      lyrics: song.lyrics,
      scale: song.scale,
      romanisation: song.romanisation,
      note: [song.collection, ...song.notes].filter(Boolean).join('; '),
    });
  }
  return records;
}

export const carnaticCircle: SourceAdapter = {
  name: 'carnatic-circle',
  // Most pages are plain English romanisation; a page in ITRANS or ISO says so itself.
  romanisation: 'plain',
  fetch: fetchPages,
  load,
};

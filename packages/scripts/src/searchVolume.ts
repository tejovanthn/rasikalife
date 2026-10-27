/**
 * Search volume for compositions and ragas, in two steps with Keyword Planner in between.
 *
 *   search-volume-keywords --domain <composition|raga> --out keywords.csv
 *   (ask Keyword Planner for every phrase in the `keyword` column, India, and save the answer
 *    as volumes.csv with columns `keyword,avg_monthly_searches`)
 *   search-volume-import --domain <d> --keywords keywords.csv --volumes volumes.csv [--dry-run]
 *
 * The planner is not called from here: its credentials stay with whoever holds them, and a
 * run of a few thousand phrases is better checked by eye before it is written. The phrase
 * rules are `compositionKeywords`/`ragaKeywords` (`core/src/shared/search-keywords.ts`,
 * tested); this file reads, writes CSV and patches.
 *
 * A record whose phrases all come back empty is written as 0, not skipped: "checked, nobody
 * searches for it" is different from "never checked", and `searchVolumeCheckedAt` says which.
 * Reindex after an import: the raga documents carry the volume as `popularity`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { Composition, Raga } from '@rasika/core';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import { bestVolume, compositionKeywords, ragaKeywords } from '@rasika/core/shared/search-keywords';

type Domain = 'composition' | 'raga';

interface Named {
  id: string;
  name: string;
  phrases: string[];
}

async function loadNamed(domain: Domain): Promise<Named[]> {
  const out: Named[] = [];
  let nextToken: string | undefined;
  do {
    if (domain === 'composition') {
      const page = await Composition.listCompositions({ limit: 100, nextToken });
      for (const c of page.items) {
        out.push({ id: c.id, name: c.title, phrases: compositionKeywords(c) });
      }
      nextToken = page.nextToken;
    } else {
      const page = await Raga.listRagas({ limit: 100, nextToken });
      for (const r of page.items) {
        if (r.deletedAt) continue;
        out.push({ id: r.id, name: r.name, phrases: ragaKeywords(r.name) });
      }
      nextToken = page.nextToken;
    }
  } while (nextToken);
  return out;
}

export async function searchVolumeKeywords(opts: { domain: Domain; out: string }) {
  const named = await loadNamed(opts.domain);
  const rows = [['id', 'name', 'keyword']];
  for (const n of named) for (const p of n.phrases) rows.push([n.id, n.name, p]);
  await writeFile(opts.out, toCsv(rows));
  const distinct = new Set(rows.slice(1).map(r => r[2])).size;
  console.log(
    `${named.length} ${opts.domain}s, ${rows.length - 1} rows, ${distinct} distinct phrases → ${opts.out}`
  );
}

function readTable(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

export async function searchVolumeImport(opts: {
  domain: Domain;
  keywords: string;
  volumes: string;
  dryRun?: boolean;
}) {
  const keywordRows = readTable(await readFile(opts.keywords, 'utf8'));
  const volumeRows = readTable(await readFile(opts.volumes, 'utf8'));

  const volumes = new Map<string, number>();
  for (const row of volumeRows) {
    const n = Number(row.avg_monthly_searches);
    if (row.keyword && Number.isFinite(n)) volumes.set(row.keyword.toLowerCase(), n);
  }

  const phrasesById = new Map<string, { name: string; phrases: string[] }>();
  for (const row of keywordRows) {
    if (!row.id || !row.keyword) continue;
    const entry = phrasesById.get(row.id) ?? { name: row.name ?? '', phrases: [] };
    entry.phrases.push(row.keyword);
    phrasesById.set(row.id, entry);
  }

  // Refuse a volumes file that answers too little of the keyword file: a half-finished
  // planner run would otherwise write 0 over every record it never asked about.
  const asked = new Set(
    [...phrasesById.values()].flatMap(e => e.phrases.map(p => p.toLowerCase()))
  );
  const answered = [...asked].filter(p => volumes.has(p)).length;
  if (answered < asked.size * 0.9) {
    throw new Error(
      `volumes file answers ${answered} of ${asked.size} phrases; finish the planner run first`
    );
  }

  const checkedAt = new Date().toISOString();
  const results = [...phrasesById].map(([id, e]) => ({
    id,
    name: e.name,
    volume: bestVolume(e.phrases, volumes),
  }));
  results.sort((a, b) => b.volume - a.volume);

  console.log(`Top ${opts.domain}s by volume:`);
  for (const r of results.slice(0, 15)) console.log(`  ${String(r.volume).padStart(6)}  ${r.name}`);
  console.log(`${results.filter(r => r.volume > 0).length} of ${results.length} have any volume`);

  if (opts.dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }

  const set =
    opts.domain === 'composition'
      ? Composition.setCompositionSearchVolume
      : Raga.setRagaSearchVolume;
  let written = 0;
  let failed = 0;
  for (const r of results) {
    try {
      await set(r.id, r.volume, checkedAt);
      written++;
    } catch (error) {
      failed++;
      console.warn(`  ${r.id} ${r.name}: ${(error as Error).message}`);
    }
  }
  console.log(`Wrote ${written}, failed ${failed}. Run \`pnpm cli reindex\` next.`);
}

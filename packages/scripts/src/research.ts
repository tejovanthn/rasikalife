import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdminData } from '@rasika/core';
import { ADMIN_CSV_DOMAINS, domainToCsv } from '@rasika/core/admin/columns';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  RESEARCH_FIELDS,
  type ResearchRecord,
  foreignNotes,
  mergeResearch,
  selectRecords,
} from '@rasika/core/admin/research';
import { MELAKARTA_SOURCE } from './generateMelakartaLinks.js';

/**
 * Two halves of a research run that a *different* agent — on a different model, in a
 * different tool — does the middle of.
 *
 * `research-batches` writes self-contained work packets; `research-ingest` reads whatever
 * comes back, refuses what does not survive validation, and produces an ordinary admin CSV
 * for `admin-csv-import`. Nothing in between touches the database, so the expensive judgement
 * stays here and the cheap fetching can happen anywhere.
 *
 * Each packet carries its own brief. A worker should not need a prompt that repeats the rules,
 * because a prompt and a validator that disagree is how a rule quietly stops applying.
 */

const BRIEF: Record<string, string[]> = {
  raga: [
    'You are filling reference data about Carnatic and Hindustani ragas.',
    'Claim nothing your source does not state. A blank is a correct answer; a plausible guess is a wrong claim on a page people trust.',
    'NEVER report melaNumber. It is derived from the parent raga after you finish, and an agent-supplied one is discarded.',
    'arohanam / avarohanam / alternateScales must be swara notation and nothing else, e.g. "S R2 G3 M1 P D2 N3 S". Never words ("sa ri ga"), never prose, never diacritics.',
    'A janya raga is named by its parent in parentRaga. Copy the parent name EXACTLY as it appears in parent_raga_must_be_one_of (the part after the number) — do not romanise it yourself. A parent that is not on that list is refused, so leave it blank and say why in notes.',
    'tradition is exactly carnatic, hindustani or both. timeOfDay is exactly morning, afternoon, evening, night or universal. Anything else is refused.',
    'description: 2-5 plain factual sentences. No praise (renowned, famous, one of the greatest), no ranking (the oldest, most popular), no hedging (likely, appears to, unclear). Say what the raga is, its parent or melakarta status, its mood and when it is sung — only what a source states.',
    'Do not invent an alias, a composer or a famous composition unless a source names it.',
  ],
};

interface Packet {
  domain: string;
  batch: string;
  brief: string[];
  fields_to_research: readonly string[];
  /** Only for raga: the parent names that will actually resolve. See `parentVocabulary`. */
  parent_raga_must_be_one_of?: string[];
  records: Array<{
    id: string;
    name: string;
    missing: string[];
    current: Record<string, string>;
  }>;
}

/**
 * The melakarta names spelled the way this corpus spells them.
 *
 * A `parentRaga` is resolved by name, so a worker guessing at romanisation gets refused: one
 * run reported Dheerashankarabharanam in ten different spellings, none of which matched the
 * stored `shankarAbharaNa`, and every one was thrown away. Guessing was never the worker's job
 * — the corpus knows its own spellings, so the packet carries them and the worker copies one.
 *
 * **Only the id map identifies the 72.** Two cheaper rules were tried and both put a janya in
 * a melakarta's place. "Has a melaNumber and no parentRaga" matches about 300 records, because
 * a janya stores its *parent's* number — that offered `shIlAngi` for mela 65 instead of
 * `kalyANi`. Adding "and its scale is the melakarta's" still fails, because a sampurna janya
 * can carry its parent's exact scale — that offered `mAyadravila` for mela 29. So the
 * hand-resolved `MELAKARTA_SOURCE` decides which record, and the live rows supply its name,
 * since several have been renamed since that map was written and its own `name` field is stale.
 */
function parentVocabulary(rows: FlatRow[]): string[] {
  const byId = new Map(rows.map(row => [row.id, row.name]));
  const named: string[] = [];
  const missing: number[] = [];
  for (const [mela, link] of Object.entries(MELAKARTA_SOURCE)) {
    const name = byId.get(link.id);
    if (name) named.push(`${mela}. ${name}`);
    else missing.push(Number(mela));
  }
  if (missing.length > 0) {
    console.warn(`⚠️  no live record for melakarta ${missing.join(', ')}; omitted from packets`);
  }
  return named.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
}

/**
 * A flattened CSV row. `id` and `name` are spelled out because every domain's column list
 * starts with them and callers key on both; a bare index signature does not satisfy a
 * required-property constraint, so `selectRecords` cannot take one.
 */
type FlatRow = Record<string, string> & { id: string; name: string };

/** The domain's rows, flattened through the CSV columns so a packet and the ingest agree. */
async function flatRows(domain: string): Promise<{ header: string[]; rows: FlatRow[] }> {
  const entities = await AdminData.listAllForDomain(domain);
  const [header, ...data] = parseCsv(domainToCsv(domain, entities as Record<string, unknown>[]));
  const rows = data.map(
    cells =>
      Object.fromEntries(
        header.map((column, index) => [column, cells[index] ?? ''])
      ) as unknown as FlatRow
  );
  return { header, rows };
}

/** One id per line; blank lines and `#` comments ignored. Order is the batching order. */
function readIdList(path: string): string[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .map(line => line.replace(/#.*/, '').trim())
    .filter(Boolean);
}

export async function writeResearchBatches(opts: {
  domain: string;
  outDir: string;
  size: number;
  onlyMissing?: boolean;
  limit?: number;
  idsFile?: string;
  excludeFile?: string;
}): Promise<void> {
  const { domain, outDir, size, onlyMissing = true, limit, idsFile, excludeFile } = opts;
  const fields = RESEARCH_FIELDS[domain];
  if (!fields) throw new Error(`No research field list for "${domain}"`);
  if (!ADMIN_CSV_DOMAINS[domain]) throw new Error(`Unknown CSV domain "${domain}"`);

  const { rows } = await flatRows(domain);
  mkdirSync(outDir, { recursive: true });

  // The selection itself is in core, where it is unit-tested; this reads the files.
  const { records: ordered, unmatched } = selectRecords<FlatRow>(rows, {
    wanted: idsFile ? readIdList(idsFile) : undefined,
    excluded: excludeFile ? readIdList(excludeFile) : undefined,
  });
  if (unmatched > 0) console.warn(`⚠️  ${unmatched} of the listed ids are not in ${domain}`);

  const candidates = ordered
    .map(row => ({
      id: row.id,
      name: row.name,
      missing: fields.filter(field => !(row[field] ?? '').trim()),
      // Only what is already known, so a worker does not spend a call re-finding it.
      current: Object.fromEntries(
        fields.filter(field => (row[field] ?? '').trim()).map(field => [field, row[field]])
      ),
    }))
    .filter(record => !onlyMissing || record.missing.length > 0)
    .slice(0, limit);

  const vocabulary = domain === 'raga' ? parentVocabulary(rows) : [];

  const packets: Packet[] = [];
  for (let index = 0; index < candidates.length; index += size) {
    const batch = String(packets.length + 1).padStart(3, '0');
    packets.push({
      domain,
      batch,
      brief: BRIEF[domain] ?? [],
      fields_to_research: fields,
      ...(domain === 'raga' ? { parent_raga_must_be_one_of: vocabulary } : {}),
      records: candidates.slice(index, index + size),
    });
  }

  for (const packet of packets) {
    writeFileSync(
      join(outDir, `${domain}-${packet.batch}.json`),
      JSON.stringify(packet, null, 1),
      'utf-8'
    );
  }
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        domain,
        total_records: candidates.length,
        batches: packets.map(p => ({
          file: `${domain}-${p.batch}.json`,
          result: `${domain}-${p.batch}.result.json`,
          records: p.records.length,
        })),
      },
      null,
      1
    ),
    'utf-8'
  );

  console.log(`📦 ${candidates.length} ${domain} records needing work → ${packets.length} batches`);
  console.log(`   ${outDir}/${domain}-001.json … and manifest.json`);
  console.log('\nEach worker writes <batch>.result.json beside its input, then:');
  console.log(`   pnpm cli research-ingest --domain ${domain} --dir ${outDir} --out filled.csv`);
}

/**
 * Prints janya scales carrying a note their parent melakarta does not have.
 *
 * Advisory, never a refusal — an *anya swara* is a real thing and defines some of the
 * best-known ragas (Yamunakalyani is Kalyani with M1). What it is for is the other cause: a
 * scale paired with the wrong parent, and the junk that reached the field before any of this
 * existed. It reads the merged sheet, so it covers what was already stored as well as what
 * this run adds, and the second is where the reviewer should look first.
 */
function reportForeignNotes(rows: FlatRow[]): void {
  const flagged: string[] = [];
  for (const row of rows) {
    const mela = Number(row.melaNumber);
    if (!Number.isInteger(mela) || mela < 1 || mela > 72 || !row.parentRaga?.trim()) continue;
    for (const field of ['arohanam', 'avarohanam']) {
      const scale = row[field]?.trim();
      if (!scale) continue;
      const foreign = foreignNotes(scale, mela);
      if (foreign.length > 0) {
        flagged.push(`     ${row.name} (mela ${mela}) ${field}: ${scale} → ${foreign.join(' ')}`);
      }
    }
  }
  if (flagged.length === 0) return;
  console.log(`\n🔍 ${flagged.length} scale(s) use a note outside their parent melakarta.`);
  console.log('   An anya swara is legitimate; a wrong parent or a junk value is not.');
  for (const line of flagged.slice(0, 20)) console.log(line);
  if (flagged.length > 20) console.log(`     … and ${flagged.length - 20} more`);
}

export async function ingestResearch(opts: {
  domain: string;
  dir: string;
  out: string;
  report?: string;
}): Promise<void> {
  const { domain, dir, out, report } = opts;

  const results: ResearchRecord[] = [];
  let files = 0;
  for (const file of readdirSync(dir)
    .filter(f => f.endsWith('.result.json'))
    .sort()) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      if (!Array.isArray(parsed)) throw new Error('not a JSON array');
      results.push(...(parsed as ResearchRecord[]));
      files += 1;
    } catch (error) {
      // A worker killed mid-write leaves a truncated file. Say so and keep the rest, rather
      // than losing every other batch to one bad one.
      console.error(`⚠️  skipped ${file}: ${(error as Error).message}`);
    }
  }
  console.log(`📥 ${results.length} researched records from ${files} result files`);

  // Read the live rows at ingest time, so a value stored since the batches were cut still
  // wins over a researched one.
  const { header, rows } = await flatRows(domain);
  const merged = mergeResearch(domain, rows, results);

  writeFileSync(
    out,
    toCsv([header, ...rows.map(row => header.map(column => row[column] ?? ''))]),
    'utf-8'
  );

  console.log(`\n✅ ${merged.filled} cells filled, ${merged.keptExisting} left as stored`);
  if (merged.derivedMela > 0) {
    console.log(`   ${merged.derivedMela} mela numbers derived from parent ragas`);
  }
  console.log(`   ${merged.rejections.length} values refused`);

  const byReason = new Map<string, number>();
  for (const rejection of merged.rejections) {
    const key = rejection.reason.replace(/".*?"/g, '"…"');
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`     ${String(count).padStart(4)}  ${reason}`);
  }

  if (domain === 'raga') reportForeignNotes(rows);

  if (report) {
    writeFileSync(
      report,
      toCsv([
        ['id', 'name', 'field', 'reason', 'value'],
        ...merged.rejections.map(r => [r.id, r.name, r.field, r.reason, r.value]),
      ]),
      'utf-8'
    );
    console.log(`   refusals → ${report}`);
  }

  console.log(`\n📄 ${out}`);
  console.log(
    `Review it, then:\n   pnpm cli admin-csv-import --domain ${domain} --file ${out} --user <id> --dry-run`
  );
}

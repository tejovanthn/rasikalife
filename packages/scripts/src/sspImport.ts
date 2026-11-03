import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  SSP_SOURCE_SLUG,
  type SspHeld,
  type SspRagaRecord,
  type SspReviewRow,
  type SspStoredRaga,
  buildSspRagaPatch,
  sspMatchCheck,
} from '@rasika/core/domain/raga/ssp';
import {
  type SspManifestEntry,
  planSspApply,
  planSspUndo,
} from '@rasika/core/domain/raga/ssp-apply';
import { type SspMatchInput, matchSspRagas } from '@rasika/core/domain/raga/ssp-match';
import { loadAllRagas } from './dedupRagas.js';

/**
 * Importing Sangita Sampradaya Pradarshini (English edition) into ragas: match, review,
 * apply with a manifest, undo. Same shape as `dedup-ragas` and `source-*`. The decisions live
 * in `@rasika/core/domain/raga/ssp-match` and `ssp-apply`, where they are tested.
 *
 * Never creates a raga. A row is written only when a person (or the pre-filled suggestion)
 * says `apply`, and the stored raga is read again at run time.
 */

const VOLUMES = [1, 2, 3];
const DEFAULT_BOOKS_DIR = join(homedir(), 'codes', 'rasika-books');

type SspEntry = SspMatchInput & { reviews: SspReviewRow[] };

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as T);
}

function loadSsp(booksDir: string): SspEntry[] {
  const out: SspEntry[] = [];
  for (const volume of VOLUMES) {
    const dir = join(
      booksDir,
      'extractions',
      `ssp-2008-english-vol-${volume}`,
      'run-2026-10-27-055202'
    );
    const records = readJsonl<SspMatchInput['record']>(join(dir, 'entities', 'ragas.jsonl'));
    const reviews = readJsonl<SspReviewRow>(join(dir, 'review.jsonl'));
    for (const record of records) {
      out.push({
        record,
        volume,
        reviews: reviews.filter(r => r.section_id === record.merged_provisional_id),
      });
    }
  }
  return out;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function asStored(raga: unknown): SspStoredRaga & Record<string, unknown> {
  return raga as SspStoredRaga & Record<string, unknown>;
}

const MATCH_HEADER = [
  'decision',
  'suggestion',
  'section',
  'ssp_id',
  'ssp_name',
  'volume',
  'kind',
  'tier',
  'candidate_id',
  'candidate_name',
  'candidate_mela',
  'all_candidates',
  'flags',
  'would_set',
  'would_cite',
  'held',
];

export async function matchSspToRagas(opts: { booksDir?: string; out: string }): Promise<void> {
  const ssp = loadSsp(opts.booksDir ?? DEFAULT_BOOKS_DIR);
  console.log(`📚 ${ssp.length} SSP raga records`);
  console.log('📖 Loading all ragas...');
  const all = await loadAllRagas();
  console.log(`📋 Loaded ${all.length} ragas`);
  const byId = new Map(all.map(r => [r.id, r]));

  const matches = matchSspRagas(ssp, all as never[]);
  const rows = matches.map((m, i) => {
    const { record, reviews, volume } = ssp[i];
    const first = m.candidates[0];
    let wouldSet = '';
    let wouldCite = '';
    let held = '';
    if (first && m.candidates.length === 1) {
      const result = buildSspRagaPatch({
        record,
        reviews,
        volume,
        stored: asStored(byId.get(first.id)),
      });
      wouldSet = Object.keys(result.patch).join(' ');
      wouldCite = String(result.citations.length);
      held = String(result.held.length);
    }
    return [
      m.suggestion === 'review' ? '' : m.suggestion,
      m.suggestion,
      m.section,
      m.sspId,
      m.sspName,
      String(m.volume),
      m.kind,
      m.tier,
      m.candidates.length === 1 ? first.id : '',
      m.candidates.length === 1 ? first.name : '',
      m.candidates.length === 1 ? String(first.melaNumber ?? '') : '',
      m.candidates.length > 1 ? m.candidates.map(c => `${c.id}:${c.name}`).join(' | ') : '',
      m.flags.join(' '),
      wouldSet,
      wouldCite,
      held,
    ];
  });
  writeFileSync(opts.out, toCsv([MATCH_HEADER, ...rows]), 'utf-8');

  const count = (f: (r: (typeof matches)[number]) => boolean) => matches.filter(f).length;
  console.log(`\n✅ Wrote ${rows.length} rows to ${opts.out}`);
  console.log(
    `   tiers: ${count(r => r.tier === 'exact')} exact, ${count(r => r.tier === 'variant')} variant, ${count(r => r.tier === 'none')} none`
  );
  console.log(
    `   suggestions: ${count(r => r.suggestion === 'apply')} apply, ${count(r => r.suggestion === 'review')} review, ${count(r => r.suggestion === 'skip')} skip`
  );
  console.log(`   flagged: ${count(r => r.flags.length > 0)}`);
  console.log(
    '\nReview the file. Rows marked "apply" are written; blank and "skip" are not. Then:'
  );
  console.log(`   pnpm prod-cli ssp-apply --file ${opts.out} --user <id> --only melas --dry-run`);
}

export async function applySsp(opts: {
  file: string;
  userId: string;
  dryRun?: boolean;
  only?: string;
  booksDir?: string;
}): Promise<void> {
  const { file, dryRun = false } = opts;
  if (opts.only && opts.only !== 'melas' && opts.only !== 'janyas') {
    throw new Error('--only takes "melas" or "janyas"');
  }
  const { Source } = await import('@rasika/core');
  const Raga = await import('@rasika/core/domain/raga');

  if (!(await Source.getSource(SSP_SOURCE_SLUG))) {
    const message = `source "${SSP_SOURCE_SLUG}" does not exist. Import the sources sheet first (docs/research/sources-2026-10.csv, domain source).`;
    // A dry run still previews; only a real run needs the source to cite.
    if (!dryRun) throw new Error(message);
    console.warn(`⚠️  ${message}`);
  }

  const ssp = loadSsp(opts.booksDir ?? DEFAULT_BOOKS_DIR);
  const sspById = new Map(ssp.map(e => [e.record.merged_provisional_id, e]));
  const duplicateNames = new Set(
    ssp.map(e => e.record.name_canonical).filter((name, i, names) => names.indexOf(name) !== i)
  );

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  for (const name of ['decision', 'ssp_id', 'candidate_id']) {
    if (col(name) < 0) throw new Error(`${file} is missing the ${name} column`);
  }
  const cell = (row: string[], name: string) => (row[col(name)] ?? '').trim();

  let approved = rows.filter(r => cell(r, 'decision').toLowerCase() === 'apply');
  if (opts.only) {
    const kind = opts.only === 'melas' ? 'mela' : 'janya';
    approved = approved.filter(r => cell(r, 'kind') === kind);
  }
  console.log(
    `📋 ${rows.length} rows, ${approved.length} to apply${opts.only ? ` (${opts.only})` : ''}`
  );

  // Two apply rows on one raga: neither may write.
  const targets = new Map<string, number>();
  for (const r of approved) {
    const id = cell(r, 'candidate_id');
    targets.set(id, (targets.get(id) ?? 0) + 1);
  }

  const time = stamp();
  const manifestFile = `${file}.${dryRun ? 'dry-run' : 'applied'}-${time}.json`;
  const heldFile = `${file}.held-${time}.csv`;
  const manifest: SspManifestEntry[] = [];
  const heldRows: string[][] = [];
  const saveManifest = () =>
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  const counts = { written: 0, unchanged: 0, refused: 0, fields: 0, citations: 0, held: 0 };
  const addHeld = (id: string, name: string, items: SspHeld[], notes: string[]) => {
    for (const h of items) {
      heldRows.push([id, name, 'held', h.field, JSON.stringify(h.value), h.reason]);
      counts.held++;
    }
    for (const n of notes) heldRows.push([id, name, 'note', '', n, '']);
  };

  for (const row of approved) {
    const sspId = cell(row, 'ssp_id');
    const ragaId = cell(row, 'candidate_id');
    const label = `${cell(row, 'ssp_name')} → ${ragaId || '(no candidate)'}`;
    const refuse = (why: string) => {
      console.log(`⚠️  held ${label}: ${why}`);
      heldRows.push([ragaId, cell(row, 'ssp_name'), 'row', '', '', why]);
      counts.refused++;
    };

    const entry = sspById.get(sspId);
    if (!entry) {
      refuse('SSP record not found in the books directory');
      continue;
    }
    if (!ragaId) {
      refuse('no single candidate id');
      continue;
    }
    if ((targets.get(ragaId) ?? 0) > 1) {
      refuse('two SSP records are marked apply for this raga');
      continue;
    }

    let stored: Awaited<ReturnType<typeof Raga.getRaga>>;
    try {
      stored = await Raga.getRaga(ragaId);
    } catch (error) {
      refuse(`could not read the raga: ${(error as Error).message}`);
      continue;
    }
    if (!stored || stored.deletedAt) {
      refuse('stored raga is missing, merged or deleted');
      continue;
    }

    const check = sspMatchCheck(entry.record as SspRagaRecord, stored, { duplicateNames });
    if (check.melaMismatch || check.junkHeading) {
      refuse(check.reasons.join('; '));
      continue;
    }

    const result = buildSspRagaPatch({
      record: entry.record,
      reviews: entry.reviews,
      volume: entry.volume,
      stored: asStored(stored),
    });
    const plan = planSspApply(result, asStored(stored));
    addHeld(ragaId, stored.name, plan.held, plan.notes);
    if (plan.error) {
      refuse(`patch fails the raga schema: ${plan.error}`);
      continue;
    }
    const fields = Object.keys(plan.changes);
    if (Object.keys(plan.update).length === 0) {
      counts.unchanged++;
      continue;
    }

    const summary = `${fields.join(', ') || 'no fields'}; +${plan.citationsAdded.length} citations`;
    const entryOut: SspManifestEntry = {
      ragaId,
      ragaName: stored.name,
      sspId,
      section: cell(row, 'section'),
      volume: entry.volume,
      changes: plan.changes,
      citationsAdded: plan.citationsAdded,
    };
    if (dryRun) {
      console.log(`[dry-run] would update ${stored.name}: ${summary}`);
    } else {
      try {
        await Raga.updateRaga(ragaId, plan.update as never);
        console.log(`✍️  ${stored.name}: ${summary}`);
      } catch (error) {
        refuse(`write failed: ${(error as Error).message}`);
        continue;
      }
    }
    // Saved after every raga, so a run that dies midway still leaves the record of what it wrote.
    manifest.push(entryOut);
    saveManifest();
    counts.written++;
    counts.fields += fields.length;
    counts.citations += plan.citationsAdded.length;
  }

  saveManifest();
  writeFileSync(
    heldFile,
    toCsv([['raga_id', 'raga_name', 'kind', 'field', 'value', 'reason'], ...heldRows]),
    'utf-8'
  );
  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}🎉 ${counts.written} ragas ${dryRun ? 'would change' : 'updated'}, ` +
      `${counts.unchanged} unchanged, ${counts.refused} rows held back`
  );
  console.log(
    `   ${counts.fields} fields, ${counts.citations} citations, ${counts.held} held items`
  );
  console.log(`   Manifest: ${manifestFile}`);
  console.log(`   Held items and notes: ${heldFile}`);
  if (!dryRun && counts.written > 0) {
    console.log('Next, against the same stage: reindex search (`pnpm cli reindex`).');
  }
}

export async function undoSsp(opts: {
  manifest: string;
  only?: string[];
  dryRun?: boolean;
}): Promise<void> {
  const { manifest: file, dryRun = false } = opts;
  const Raga = await import('@rasika/core/domain/raga');
  const entries = JSON.parse(readFileSync(file, 'utf-8')) as (SspManifestEntry & {
    undoSkipped?: { field: string; reason: string }[];
  })[];
  const only = opts.only ? new Set(opts.only.map(s => s.trim())) : null;
  const save = () => writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');

  let undone = 0;
  let skippedEntries = 0;
  let skippedFields = 0;
  for (const entry of entries) {
    if (only && !only.has(entry.ragaId)) continue;
    if (entry.undoneAt) {
      console.log(`↩️  ${entry.ragaName}: already undone`);
      continue;
    }
    const current = await Raga.getRaga(entry.ragaId);
    if (!current) {
      console.log(`⚠️  ${entry.ragaName}: raga is gone, skipped`);
      skippedEntries++;
      continue;
    }
    const plan = planSspUndo(entry, current as never);
    for (const s of plan.skipped) {
      console.log(`⚠️  ${entry.ragaName}.${s.field}: ${s.reason}, left as it is`);
      skippedFields++;
    }
    const note = `restore ${plan.restored.join(', ') || 'nothing'}; remove ${plan.citationsRemoved} citations`;
    if (dryRun) {
      console.log(`[dry-run] would undo ${entry.ragaName}: ${note}`);
      continue;
    }
    await Raga.applyRagaFieldPlan(entry.ragaId, { set: plan.set, remove: plan.remove });
    entry.undoneAt = new Date().toISOString();
    if (plan.skipped.length > 0) entry.undoSkipped = plan.skipped;
    save();
    console.log(`↩️  ${entry.ragaName}: ${note}`);
    undone++;
  }
  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}${undone} ragas undone, ${skippedEntries} skipped, ${skippedFields} fields left as edited`
  );
  if (!dryRun && undone > 0) console.log('Reindex search next.');
}

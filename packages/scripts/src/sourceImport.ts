import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { AdminData, Artist, Composition, Raga, Tala } from '@rasika/core';
import { domainToCsv, parseDomainCsv } from '@rasika/core/admin/columns';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  type OurComposition,
  canonicalTala,
  composerAgrees,
  matchComposition,
  ragaAgrees,
  resolveName,
} from '@rasika/core/domain/composition/match';
import {
  type AttachedEntry,
  type ImportManifest,
  type SourceRecord,
  forNewRecord,
  planAttach,
  planAttachUndo,
} from '@rasika/core/domain/composition/source-import';
import { swaraKey } from '@rasika/core/domain/raga/dedup';
import { getAdapter, sourceDir } from './sources/index.js';

/**
 * Importing compositions from an outside source, the same way for every source:
 *
 * 1. `source-fetch --source <name>`: the adapter downloads its archive (cached).
 * 2. `source-match --source <name>`: one review row per record, matched against ours.
 *    A person writes `decision`: attach, create or skip.
 * 3. `source-csv --source <name> --file <reviewed>`: the admin CSV for those decisions.
 * 4. `source-apply --source <name> --file <admin csv> --user <id>`: writes it, and writes a
 *    manifest of exactly what changed beside the file.
 * 5. `source-undo --manifest <file> [--only <ids>]`: takes it back, wholly or per song.
 *
 * The adapter (`sources/<name>.ts`) is the only part that knows one source.
 */

type Row = Record<string, unknown>;

const refName = (value: unknown) => (value as { name?: string } | undefined)?.name ?? '';
const refNames = (value: unknown) =>
  Array.isArray(value) ? value.map(refName).filter(Boolean) : [];

function countNames(names: string[]): Array<{ name: string; uses: number }> {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, uses]) => ({ name, uses }));
}

// Both lines: Sri and Madhyamavati share an arohanam and differ on the way down.
function scaleKey(aro?: unknown, ava?: unknown): string {
  const up = swaraKey(String(aro ?? ''));
  const down = swaraKey(String(ava ?? ''));
  return up.length >= 8 && down.length >= 8 ? `${up}/${down}` : '';
}

export async function fetchSource(opts: { source: string }): Promise<void> {
  await getAdapter(opts.source).fetch(sourceDir(opts.source));
}

const MATCH_HEADER = [
  'key',
  'title',
  'raga',
  'tala',
  'composer',
  'suggestion',
  'confidence',
  'reason',
  'decision',
  'match_id',
  'match_title',
  'match_ragas',
  'match_composer',
  'other_ids',
  'new_title',
  'new_raga',
  'new_tala',
  'new_composer',
  'new_language',
  'note',
  'lyrics_preview',
] as const;

export async function matchSource(opts: { source: string; out: string }): Promise<void> {
  const adapter = getAdapter(opts.source);
  const records = adapter.load(sourceDir(adapter.name));
  const [compositions, ragas] = await Promise.all([
    AdminData.listAllForDomain('composition') as Promise<Row[]>,
    AdminData.listAllForDomain('raga') as Promise<Row[]>,
  ]);

  const ours: OurComposition[] = compositions.map(row => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    composer: refName(row.composer),
    ragas: refNames(row.ragas),
    weight: JSON.stringify(row.lyricsV1 ?? []).length,
  }));
  // Every raga record is a candidate, not just those a composition uses: our geethams
  // in Malahari were imported as Bilahari, so no composition carries `malahari`.
  const used = new Map(countNames(ours.flatMap(o => o.ragas)).map(r => [r.name, r.uses]));
  const ragaUses = ragas.map(raga => ({
    name: String(raga.name),
    uses: used.get(String(raga.name)) ?? 0,
  }));
  const composerUses = countNames(ours.map(o => o.composer).filter(Boolean));
  const scaleOf = new Map(
    ragas.map(raga => [String(raga.name), scaleKey(raga.arohanam, raga.avarohanam)])
  );
  const languageByComposer = new Map<string, Map<string, number>>();
  for (const row of compositions) {
    const composer = refName(row.composer);
    const counts = languageByComposer.get(composer) ?? new Map<string, number>();
    counts.set(String(row.language), (counts.get(String(row.language)) ?? 0) + 1);
    languageByComposer.set(composer, counts);
  }
  const usualLanguage = (composer?: string) => {
    const counts = composer ? languageByComposer.get(composer) : undefined;
    return counts ? [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  };
  const rows: string[][] = [[...MATCH_HEADER]];
  const tally = new Map<string, number>();
  for (const record of records) {
    // One raga carries several names (Panthuvarali is kAmavardhani), so the record's own
    // printed scale agreeing with ours counts as the same raga.
    const theirScale = scaleKey(record.scale?.arohanam, record.scale?.avarohanam);
    const sameRaga = (theirs: string, oursName: string) =>
      ragaAgrees(theirs, oursName) || (theirScale !== '' && scaleOf.get(oursName) === theirScale);
    const result = matchComposition(record, ours, { ragaAgrees: sameRaga });
    const key = `${result.suggestion}/${result.confidence}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);

    const newComposer = resolveName(record.composer, composerUses, composerAgrees) ?? '';
    const forNew = (text: string) => forNewRecord(text, record, adapter.romanisation);
    rows.push([
      record.key,
      record.title,
      record.raga ?? '',
      record.tala ?? '',
      record.composer ?? '',
      result.suggestion,
      result.confidence,
      result.reason,
      '',
      result.match?.id ?? '',
      result.match?.title ?? '',
      result.match?.ragas.join('|') ?? '',
      result.match?.composer ?? '',
      result.others.map(o => o.id).join('|'),
      forNew(record.title),
      resolveName(record.raga, ragaUses, sameRaga) ?? forNew(record.raga ?? ''),
      canonicalTala(record.tala) ?? '',
      newComposer || (record.composer ?? ''),
      usualLanguage(newComposer) ?? '',
      record.note ?? '',
      record.lyrics
        .map(section => section.text)
        .join(' / ')
        .slice(0, 160),
    ]);
  }

  writeFileSync(opts.out, toCsv(rows));
  console.log(`✅ wrote ${records.length} rows to ${opts.out}`);
  for (const [key, count] of [...tally].sort()) console.log(`  ${key}: ${count}`);
  console.log(
    'Write attach, create or skip in `decision`. For attach, `match_id` is the record that gets the links and notation; edit it to choose another. For create, check new_* (a name that is not ours yet becomes a new artist, raga or tala).'
  );
}

/** The admin CSV for the reviewed decisions. Attach rows carry only what to add. */
export async function buildSourceCsv(opts: {
  source: string;
  file: string;
  out: string;
}): Promise<void> {
  const adapter = getAdapter(opts.source);
  const records = new Map<string, SourceRecord>(
    adapter.load(sourceDir(adapter.name)).map(record => [record.key, record])
  );
  const [header, ...body] = parseCsv(readFileSync(opts.file, 'utf8'));
  if (!header) throw new Error(`${opts.file} is empty`);
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`${opts.file} has no "${name}" column`);
    return index;
  };
  const cell = (row: string[], name: string) => (row[col(name)] ?? '').trim();

  const out: Row[] = [];
  const attached = new Set<string>();
  const problems: string[] = [];
  for (const row of body) {
    const decision = cell(row, 'decision').toLowerCase();
    if (!decision || decision === 'skip') continue;
    const record = records.get(cell(row, 'key'));
    if (!record) {
      problems.push(`no record for key ${cell(row, 'key')}`);
      continue;
    }

    if (decision === 'attach') {
      const id = cell(row, 'match_id');
      if (!id) {
        problems.push(`${record.title}: attach needs match_id`);
        continue;
      }
      if (attached.has(id)) {
        problems.push(`${record.title}: ${id} is already attached to another record; skipped`);
        continue;
      }
      attached.add(id);
      // What to add, not the result: `source-apply` merges it into the record as it
      // stands when it runs, so a stale CSV cannot drop a link or overwrite notation.
      out.push({ id, sources: record.sources, notation: record.notation });
    } else if (decision === 'create') {
      const language = cell(row, 'new_language');
      const composer = cell(row, 'new_composer');
      if (!language || !composer) {
        problems.push(`${record.title}: create needs new_language and new_composer`);
        continue;
      }
      out.push({
        title: cell(row, 'new_title'),
        composer: { name: composer },
        language,
        ragas: cell(row, 'new_raga') ? [{ name: cell(row, 'new_raga') }] : undefined,
        talas: cell(row, 'new_tala') ? [{ name: cell(row, 'new_tala') }] : undefined,
        compositionType: record.compositionType,
        sources: record.sources,
        notation: record.notation,
        lyricsV1: record.lyrics.map(section => ({
          ...section,
          text: forNewRecord(section.text, record, adapter.romanisation),
        })),
      });
    } else {
      problems.push(`${record.title}: unknown decision "${decision}"`);
    }
  }

  writeFileSync(opts.out, domainToCsv('composition', out));
  const creates = out.filter(row => !row.id).length;
  console.log(
    `✅ wrote ${out.length} rows to ${opts.out}: ${out.length - creates} attach, ${creates} create`
  );
  for (const problem of problems) console.warn(`  ⚠️  ${problem}`);
  console.log(
    `Next: source-apply --source ${adapter.name} --file ${opts.out} --user <admin id> --dry-run`
  );
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];

/** Names on create rows that match no artist, raga or tala yet, so the import would add one. */
async function newLinkedNames(rows: Row[]): Promise<string[]> {
  const lookups: Array<[string, string, (name: string) => Promise<unknown>]> = [];
  for (const row of rows.filter(r => !r.id)) {
    for (const name of asList(row.composerName))
      lookups.push(['artist', name, Artist.getArtistByName]);
    for (const name of asList(row.ragaNames)) lookups.push(['raga', name, Raga.getRagaByName]);
    for (const name of asList(row.talaNames)) lookups.push(['tala', name, Tala.getTalaByName]);
  }
  const unique = new Map(lookups.map(lookup => [`${lookup[0]}:${lookup[1]}`, lookup]));
  const missing: string[] = [];
  for (const [label, [, name, find]] of unique) if (!(await find(name))) missing.push(label);
  return missing;
}

/**
 * Applies an admin CSV from `source-csv` and writes `<file>.applied-<time>.json`: for each
 * attached song the links and notation it added, the ids of the songs it created, and any
 * artist, raga or tala a new name created. `source-undo` reads that file.
 */
export async function applySource(opts: {
  source: string;
  file: string;
  userId: string;
  dryRun?: boolean;
}): Promise<void> {
  const parsed = parseDomainCsv('composition', readFileSync(opts.file, 'utf8'));
  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) console.log(`  ⚠️  ${error}`);
    console.log('Fix the cells above and run again. Nothing was written.');
    return;
  }

  // Attach rows are planned against each record as it stands now.
  const rows: Row[] = [];
  const pending: Array<{ index: number; entry: AttachedEntry }> = [];
  let unchanged = 0;
  for (const row of parsed.rows) {
    if (typeof row.id !== 'string' || !row.id) {
      rows.push(row);
      continue;
    }
    const current = await Composition.getComposition(row.id);
    if (!current) {
      console.warn(`  ⚠️  composition ${row.id} not found; skipped`);
      continue;
    }
    const { patch, entry } = planAttach(
      { sources: current.sources, notation: current.notation },
      { sources: asList(row.sources), notation: row.notation as string | undefined }
    );
    if (Object.keys(patch).length === 0) {
      unchanged++;
      continue;
    }
    pending.push({ index: rows.length, entry: { id: row.id, title: current.title, ...entry } });
    rows.push({ id: row.id, ...patch });
  }

  const creates = rows.filter(row => !row.id).length;
  const willCreate = await newLinkedNames(rows);
  console.log(
    `📋 ${pending.length} to attach, ${unchanged} already up to date, ${creates} to create`
  );
  if (willCreate.length > 0) console.log(`  new linked records: ${willCreate.join(', ')}`);
  if (opts.dryRun) {
    console.log('[dry-run] nothing written');
    return;
  }

  const result = await AdminData.bulkUpsertForDomain('composition', rows, opts.userId);
  const failed = new Set(result.errors.map(error => error.index));
  for (const error of result.errors) {
    console.error(
      `  ❌ row ${error.index}${error.name ? ` (${error.name})` : ''}: ${error.message}`
    );
  }

  const appliedAt = new Date().toISOString();
  const manifest: ImportManifest = {
    source: opts.source,
    file: opts.file,
    appliedAt,
    userId: opts.userId,
    attached: pending.filter(p => !failed.has(p.index)).map(p => p.entry),
    created: result.createdIds.map(({ index, id }) => ({
      id,
      title: String(rows[index]?.title ?? ''),
    })),
    createdLinks: result.createdLinks.map(link => ({ ...link })),
  };
  const out = `${opts.file}.applied-${appliedAt.replace(/[:.]/g, '-')}.json`;
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(
    `🎉 attached ${manifest.attached.length}, created ${manifest.created.length}, new linked records ${manifest.createdLinks.length}, ${result.errors.length} errors`
  );
  console.log(`📝 manifest: ${out}\nReindex search next (reindex).`);
}

/**
 * Takes an import back from its manifest, wholly or only the songs in `only` (composition,
 * artist, raga or tala ids). Never removes what a person changed since: a link added later
 * stays, an edited notation stays, a created song that has since been logged in a concert
 * stays. Marks what it undid in the manifest, so a second run is a no-op.
 */
export async function undoSource(opts: {
  manifest: string;
  only?: string[];
  dryRun?: boolean;
}): Promise<void> {
  if (!existsSync(opts.manifest)) throw new Error(`${opts.manifest} not found`);
  const manifest = JSON.parse(readFileSync(opts.manifest, 'utf8')) as ImportManifest;
  const only = opts.only ? new Set(opts.only) : undefined;
  const wanted = (entry: { id: string; undoneAt?: string }) =>
    !entry.undoneAt && (!only || only.has(entry.id));
  const now = new Date().toISOString();
  const say = (line: string) => console.log(`${opts.dryRun ? '[dry-run] ' : ''}${line}`);
  const kept: string[] = [];

  for (const entry of manifest.attached.filter(wanted)) {
    const current = await Composition.getComposition(entry.id);
    if (!current) {
      kept.push(`${entry.title}: no longer exists`);
      continue;
    }
    const plan = planAttachUndo({ sources: current.sources, notation: current.notation }, entry);
    if (plan.keptEditedNotation) kept.push(`${entry.title}: notation edited since; kept`);
    say(
      `${entry.title}: remove ${current.sources.length - (plan.sources?.length ?? current.sources.length)} links${plan.clearNotation ? ' and the notation' : ''}`
    );
    if (opts.dryRun) continue;
    if (plan.sources) await Composition.updateComposition(entry.id, { sources: plan.sources });
    if (plan.clearNotation)
      await AdminData.clearFieldsForDomain('composition', entry.id, ['notation']);
    entry.undoneAt = now;
  }

  const { CompositionEntity } = await import('../../core/src/domain/composition/entity.js');
  for (const entry of manifest.created.filter(wanted)) {
    // The raw record: the reader leaves out `performanceCount`.
    const current = (await CompositionEntity.get({ id: entry.id }).go()).data;
    if (!current) {
      kept.push(`${entry.title}: already gone`);
      entry.undoneAt = opts.dryRun ? entry.undoneAt : now;
      continue;
    }
    if (Number(current.performanceCount ?? 0) > 0) {
      kept.push(`${entry.title}: logged in a concert since; delete by hand if wanted`);
      continue;
    }
    say(`${entry.title}: delete the composition created by the import`);
    if (opts.dryRun) continue;
    await Composition.deleteComposition(entry.id);
    entry.undoneAt = now;
  }

  // Last, so the compositions that used them are gone first. Only removed while unused.
  for (const link of manifest.createdLinks.filter(wanted)) {
    const inUse =
      link.domain === 'artist'
        ? (await Composition.getCompositionsByComposer(link.id, { limit: 1 })).items.length > 0
        : link.domain === 'raga'
          ? (await Composition.getCompositionsByRaga(link.id, { limit: 1 })).items.length > 0
          : link.domain === 'tala'
            ? (await Composition.getCompositionsByTala(link.id, { limit: 1 })).items.length > 0
            : true;
    if (inUse) {
      kept.push(`${link.domain} ${link.name}: still in use; kept`);
      continue;
    }
    say(`${link.domain} ${link.name}: remove, created by the import and now unused`);
    if (opts.dryRun) continue;
    if (link.domain === 'artist') await Artist.softDeleteArtist(link.id);
    if (link.domain === 'raga') await Raga.deleteRaga(link.id);
    if (link.domain === 'tala') await Tala.deleteTala(link.id);
    link.undoneAt = now;
  }

  for (const line of kept) console.warn(`  ⚠️  ${line}`);
  if (!opts.dryRun) {
    writeFileSync(opts.manifest, JSON.stringify(manifest, null, 2));
    console.log(`✅ undone; ${opts.manifest} updated. Reindex search next (reindex).`);
  }
}

/**
 * Moves the legacy single `sourceAttribution` into `sources` and removes it. Reads keep a
 * fallback (`sourcesOf`), so this is tidying, not a fix; it does bump every row's
 * `updatedAt`, which ElectroDB sets on any write.
 */
export async function migrateCompositionSources(opts: { dryRun?: boolean }): Promise<void> {
  const { CompositionEntity } = await import('../../core/src/domain/composition/entity.js');
  const rows = (await AdminData.listAllForDomain('composition')) as Row[];
  const pending = rows.filter(
    row =>
      typeof row.sourceAttribution === 'string' &&
      row.sourceAttribution !== '' &&
      !(Array.isArray(row.sources) && row.sources.length > 0)
  );
  console.log(`${pending.length} of ${rows.length} compositions still hold sourceAttribution only`);
  if (opts.dryRun) return;
  let done = 0;
  for (const row of pending) {
    await CompositionEntity.update({ id: String(row.id) })
      .set({ sources: [String(row.sourceAttribution)] })
      .remove(['sourceAttribution'])
      .go();
    done++;
    if (done % 500 === 0) console.log(`  ${done}/${pending.length}`);
  }
  console.log(`✅ migrated ${done}`);
}

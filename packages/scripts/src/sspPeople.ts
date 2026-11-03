import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import { CreateArtistSchema, UpdateArtistSchema } from '@rasika/core/domain/artist/client';
import {
  MAJOR_COMPOSER_COUNT,
  type SspMatchArtist,
  type SspPersonMatch,
  matchSspPeople,
  matchSspPerson,
} from '@rasika/core/domain/artist/ssp-match';
import {
  type SspArtistRow,
  type SspPeopleResult,
  type SspPerson,
  type SspRelationshipRow,
  type SspVolumeInput,
  buildSspPeople,
} from '@rasika/core/domain/artist/ssp-people';
import {
  type SspPeopleManifestEntry,
  type SspPeopleManifestPatched,
  type SspStoredArtist,
  planSspCreatedUndo,
  planSspPersonAttach,
  planSspPersonCreate,
  planSspPersonUndo,
} from '@rasika/core/domain/artist/ssp-people-apply';
import { SSP_SOURCE_SLUG } from '@rasika/core/domain/raga/ssp';

/**
 * Importing the people of Sangita Sampradaya Pradarshini (English edition): match, review,
 * apply with a manifest, undo. Same shape as `ssp-match` / `ssp-apply` for ragas. The
 * decisions live in `@rasika/core/domain/artist/ssp-people`, `ssp-match` and
 * `ssp-people-apply`, where they are tested.
 *
 * An artist is never created on its own. A row is written only when its `decision` says
 * `create` or `attach`, the file pre-fills those only where the rules allow, and the stored
 * records are read again at run time. A person with no match is created only on `create`.
 */

const VOLUMES = [1, 2, 3, 4, 5];
const RUN = 'run-2026-10-27-055202';
const DEFAULT_BOOKS_DIR = join(homedir(), 'codes', 'rasika-books');

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as T);
}

export function loadSspVolumes(booksDir: string): SspVolumeInput[] {
  return VOLUMES.map(volume => {
    const dir = join(booksDir, 'extractions', `ssp-2008-english-vol-${volume}`, RUN);
    return {
      volume,
      artists: readJsonl<SspArtistRow>(join(dir, 'entities', 'artists.jsonl')),
      relationships: readJsonl<SspRelationshipRow>(join(dir, 'entities', 'relationships.jsonl')),
      reviews: readJsonl<{ kind?: string; detail?: unknown }>(join(dir, 'review.jsonl')),
      printedPages: JSON.parse(readFileSync(join(dir, 'page-manifest.json'), 'utf-8')),
    };
  });
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

type Core = typeof import('@rasika/core');

/** What the artist schema accepts, so a field it does not know yet is refused, not dropped. */
interface PayloadSchema {
  safeParse(
    value: unknown
  ):
    | { success: true; data: unknown }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

function checkPayload(schema: PayloadSchema, payload: Record<string, unknown>): string | undefined {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return parsed.error.issues.map(i => `${i.path.join('.') || 'artist'}: ${i.message}`).join('; ');
  }
  const kept = parsed.data as Record<string, unknown>;
  const dropped = Object.keys(payload).filter(k => payload[k] !== undefined && !(k in kept));
  return dropped.length > 0
    ? `the artist schema does not accept: ${dropped.join(', ')}`
    : undefined;
}

function toMatchArtist(a: {
  id: string;
  name: string;
  alternateNames?: string[] | null;
  deletedAt?: string | null;
  mergedIntoId?: string | null;
}): SspMatchArtist {
  return {
    id: a.id,
    name: a.name,
    alternateNames: a.alternateNames,
    deletedAt: a.deletedAt,
    mergedIntoId: a.mergedIntoId,
  };
}

async function compositionCount(core: Core, artistId: string): Promise<number> {
  let total = 0;
  let nextToken: string | undefined;
  do {
    const page = await core.Composition.getCompositionsByComposer(artistId, {
      limit: 500,
      nextToken,
    });
    total += page.items.length;
    nextToken = page.nextToken;
  } while (nextToken);
  return total;
}

const MATCH_HEADER = [
  'decision',
  'suggestion',
  'ssp_key',
  'new_name',
  'iast_name',
  'scope',
  'volumes',
  'composed',
  'tier',
  'candidate_id',
  'candidate_name',
  'candidate_compositions',
  'matched_on',
  'all_candidates',
  'flags',
  'would_set',
  'would_cite',
  'held',
  'gurus',
  'notes',
];

function summarize(people: SspPeopleResult): void {
  const f = (pick: (p: SspPerson) => boolean) => people.people.filter(pick).length;
  console.log(
    `📚 ${people.stats.rows} SSP rows joined into ${people.stats.components} people; ${people.people.length} in scope, ${people.skipped.length} skipped`
  );
  console.log(
    `   facts: ${f(p => p.facts.birthYear !== undefined)} birth years, ${f(p => p.facts.deathYear !== undefined)} death years, ` +
      `${f(p => !!p.facts.birthPlace)} birthplaces, ${f(p => !!p.facts.deathPlace)} death places, ${f(p => !!p.facts.mudra)} mudras, ` +
      `${f(p => p.facts.works.length > 0)} with works; ${people.stats.guruEdges} guru edges`
  );
}

export async function matchSspToPeople(opts: { booksDir?: string; out: string }): Promise<void> {
  const people = buildSspPeople(loadSspVolumes(opts.booksDir ?? DEFAULT_BOOKS_DIR));
  summarize(people);

  const core = await import('@rasika/core');
  console.log('📖 Loading all artists...');
  const all = await core.Artist.listAllArtistsForMatching();
  console.log(`📋 Loaded ${all.length} artists`);
  const artists = all.map(toMatchArtist);
  const byId = new Map(all.map(a => [a.id, a]));

  // Counts are read only for records that came up, since one query per artist would be 1,100.
  const first = matchSspPeople(people.people, artists);
  const counts = new Map<string, number>();
  for (const row of first) {
    for (const c of row.candidates.slice(0, 6)) {
      if (!counts.has(c.id)) counts.set(c.id, await compositionCount(core, c.id));
    }
  }
  const matches = matchSspPeople(people.people, artists, { compositionCounts: counts });

  const rows = people.people.map((person, i) => {
    const m: SspPersonMatch = matches[i];
    const top = m.candidates.find(c => c.tier !== 'loose');
    const single =
      top && m.candidates.filter(c => c.tier === top.tier).length === 1 ? top : undefined;
    let wouldSet = '';
    let wouldCite = '';
    let held = '';
    if (single) {
      const plan = planSspPersonAttach(person, byId.get(single.id) as unknown as SspStoredArtist);
      wouldSet = Object.keys(plan.update)
        .filter(k => k !== 'citations')
        .join(' ');
      wouldCite = String(plan.citationsAdded.length);
      held = plan.held.map(h => h.field).join(' ');
    } else if (m.suggestion === 'create') {
      wouldSet = ['name', 'alternateNames', 'isHistorical', ...Object.keys(person.facts)]
        .filter(k => k !== 'works' || person.facts.works.length > 0)
        .join(' ');
      wouldCite = String(person.citations.length);
    }
    const flags = [...m.flags];
    if (person.composedCount >= MAJOR_COMPOSER_COUNT) flags.push('major-composer');
    return [
      m.suggestion === 'attach' || m.suggestion === 'create' ? m.suggestion : '',
      m.suggestion,
      person.key,
      person.name,
      person.iastName + (person.qualifier ? ` (${person.qualifier})` : ''),
      person.scope,
      person.volumes.join(' '),
      String(person.composedCount),
      m.tier,
      single ? single.id : '',
      single ? single.name : '',
      single ? String(single.compositions) : '',
      single ? single.matchedOn : '',
      m.candidates
        .filter(c => c !== single)
        .map(c => `${c.id}:${c.name}[${c.tier},${c.compositions}]`)
        .join(' | '),
      flags.join(' '),
      wouldSet,
      wouldCite,
      held,
      person.gurus.map(g => `${g.name}${g.spiritual ? '*' : ''}`).join('; '),
      person.notes.join('; '),
    ];
  });
  writeFileSync(opts.out, toCsv([MATCH_HEADER, ...rows]), 'utf-8');

  const count = (f: (r: SspPersonMatch) => boolean) => matches.filter(f).length;
  console.log(`\n✅ Wrote ${rows.length} rows to ${opts.out}`);
  console.log(
    `   tiers: ${count(r => r.tier === 'exact')} exact, ${count(r => r.tier === 'close')} close, ${count(r => r.tier === 'loose')} loose, ${count(r => r.tier === 'none')} none`
  );
  console.log(
    `   pre-filled: ${count(r => r.suggestion === 'attach')} attach, ${count(r => r.suggestion === 'create')} create; ${count(r => r.suggestion === 'review')} left for you`
  );
  console.log(
    '\nReview the file. Only rows whose decision is "attach" or "create" are written. For attach, edit candidate_id to pick another record; for create, edit new_name. Then:'
  );
  console.log(`   pnpm prod-cli ssp-people-apply --file ${opts.out} --user <id> --dry-run`);
}

export async function applySspPeople(opts: {
  file: string;
  userId: string;
  dryRun?: boolean;
  booksDir?: string;
}): Promise<void> {
  const { file, dryRun = false } = opts;
  const core = await import('@rasika/core');
  const Artist = core.Artist;

  if (!(await core.Source.getSource(SSP_SOURCE_SLUG))) {
    const message = `source "${SSP_SOURCE_SLUG}" does not exist. Import the sources sheet first (docs/research/sources-2026-10.csv, domain source).`;
    // A dry run still previews; only a real run needs the source to cite.
    if (!dryRun) throw new Error(message);
    console.warn(`⚠️  ${message}`);
  }

  const people = buildSspPeople(loadSspVolumes(opts.booksDir ?? DEFAULT_BOOKS_DIR));
  const personByKey = new Map(people.people.map(p => [p.key, p]));

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  for (const name of ['decision', 'ssp_key', 'candidate_id', 'new_name']) {
    if (col(name) < 0) throw new Error(`${file} is missing the ${name} column`);
  }
  const cell = (row: string[], name: string) => (row[col(name)] ?? '').trim();

  const wanted = rows.filter(r => ['attach', 'create'].includes(cell(r, 'decision').toLowerCase()));
  console.log(
    `📋 ${rows.length} rows, ${wanted.filter(r => cell(r, 'decision').toLowerCase() === 'create').length} to create, ${wanted.filter(r => cell(r, 'decision').toLowerCase() === 'attach').length} to attach`
  );

  const time = stamp();
  const manifestFile = `${file}.${dryRun ? 'dry-run' : 'applied'}-${time}.json`;
  const heldFile = `${file}.held-${time}.csv`;
  const manifest: SspPeopleManifestEntry[] = [];
  const heldRows: string[][] = [];
  const saveManifest = () =>
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  const counts = {
    created: 0,
    patched: 0,
    unchanged: 0,
    refused: 0,
    fields: 0,
    citations: 0,
    held: 0,
  };
  const hold = (key: string, name: string, why: string) => {
    console.log(`⚠️  held ${name}: ${why}`);
    heldRows.push([key, name, 'row', '', '', why]);
    counts.refused++;
  };

  // Two attach rows on one record: neither may write.
  const targets = new Map<string, number>();
  for (const r of wanted) {
    if (cell(r, 'decision').toLowerCase() !== 'attach') continue;
    const id = cell(r, 'candidate_id');
    targets.set(id, (targets.get(id) ?? 0) + 1);
  }

  // Who each person is in our records, for the guru rows.
  const resolved = new Map<string, { id: string; name: string }>();
  const attachRows: { row: string[]; person: SspPerson; id: string; stored: SspStoredArtist }[] =
    [];
  for (const row of wanted.filter(r => cell(r, 'decision').toLowerCase() === 'attach')) {
    const key = cell(row, 'ssp_key');
    const person = personByKey.get(key);
    const id = cell(row, 'candidate_id');
    if (!person) {
      hold(key, cell(row, 'iast_name'), 'SSP person not found in the books directory');
      continue;
    }
    if (!id) {
      hold(key, person.iastName, 'attach needs a candidate_id');
      continue;
    }
    if ((targets.get(id) ?? 0) > 1) {
      hold(key, person.iastName, 'two SSP people are marked attach for this artist');
      continue;
    }
    const stored = await Artist.getArtist(id).catch(() => null);
    if (!stored || stored.deletedAt || stored.mergedIntoId) {
      hold(key, person.iastName, 'stored artist is missing, merged or deleted');
      continue;
    }
    resolved.set(key, { id, name: stored.name });
    attachRows.push({ row, person, id, stored: stored as unknown as SspStoredArtist });
  }

  const resolveGuru = (guruKey: string | undefined) =>
    guruKey ? resolved.get(guruKey) : undefined;
  const loaded = (await Artist.listAllArtistsForMatching()).map(toMatchArtist);

  // Creates first, busiest first, so the gurus of a later person can name an earlier one.
  const createRows = wanted
    .filter(r => cell(r, 'decision').toLowerCase() === 'create')
    .map(row => ({ row, person: personByKey.get(cell(row, 'ssp_key')) }))
    .sort((a, b) => (b.person?.composedCount ?? 0) - (a.person?.composedCount ?? 0));
  const created: { person: SspPerson; id: string }[] = [];

  for (const { row, person } of createRows) {
    const key = cell(row, 'ssp_key');
    if (!person) {
      hold(key, cell(row, 'iast_name'), 'SSP person not found in the books directory');
      continue;
    }
    const name = cell(row, 'new_name') || person.name;
    const existing = await Artist.getArtistByName(name);
    if (existing) {
      hold(
        key,
        person.iastName,
        `an artist named "${name}" already exists (${existing.id}); mark it attach`
      );
      continue;
    }
    // A record that matches now and that the reviewer did not see in the file: ask first.
    // One the file listed, and that the reviewer passed over, is a decision to create.
    const seen = `${cell(row, 'candidate_id')} ${cell(row, 'all_candidates')}`;
    const unseen = matchSspPerson(person, loaded).candidates.filter(
      c => c.tier !== 'loose' && !seen.includes(c.id)
    );
    if (unseen.length > 0) {
      const list = unseen.map(c => `${c.id}:${c.name}`).join(' | ');
      hold(key, person.iastName, `a matching artist exists that the review did not list: ${list}`);
      continue;
    }
    const plan = planSspPersonCreate(person, { name, resolveGuru });
    const problem = checkPayload(CreateArtistSchema, plan.input);
    if (problem) {
      hold(key, person.iastName, `payload fails the artist schema: ${problem}`);
      continue;
    }
    let id = `dry-run:${key}`;
    if (dryRun) {
      console.log(
        `[dry-run] would create ${name} (${person.iastName}): ${Object.keys(plan.input).join(', ')}`
      );
    } else {
      try {
        const made = await Artist.createArtist(plan.input as never);
        id = made.id;
        console.log(`✍️  created ${name} → ${id}`);
      } catch (error) {
        hold(key, person.iastName, `create failed: ${(error as Error).message}`);
        continue;
      }
    }
    resolved.set(key, { id, name });
    created.push({ person, id });
    manifest.push({ kind: 'created', sspKey: key, artistId: id, name });
    saveManifest();
    counts.created++;
    counts.citations += plan.citations.length;
  }

  for (const { person, id, stored } of attachRows) {
    const fresh = (await Artist.getArtist(id)) as unknown as SspStoredArtist;
    const plan = planSspPersonAttach(person, fresh ?? stored, { resolveGuru });
    for (const h of plan.held) {
      heldRows.push([
        person.key,
        person.iastName,
        'held',
        h.field,
        JSON.stringify(h.value),
        h.reason,
      ]);
      counts.held++;
    }
    if (Object.keys(plan.update).length === 0) {
      counts.unchanged++;
      continue;
    }
    const problem = checkPayload(UpdateArtistSchema, plan.update);
    if (problem) {
      hold(person.key, person.iastName, `patch fails the artist schema: ${problem}`);
      continue;
    }
    const fields = Object.keys(plan.changes);
    const summary = `${fields.join(', ') || 'citations only'}; +${plan.citationsAdded.length} citations`;
    const entry: SspPeopleManifestPatched = {
      kind: 'patched',
      sspKey: person.key,
      artistId: id,
      name: (fresh ?? stored).name,
      changes: plan.changes,
      citationsAdded: plan.citationsAdded,
    };
    if (dryRun) {
      console.log(`[dry-run] would update ${entry.name}: ${summary}`);
    } else {
      try {
        await Artist.updateArtist(id, plan.update as never);
        console.log(`✍️  ${entry.name}: ${summary}`);
      } catch (error) {
        hold(person.key, person.iastName, `write failed: ${(error as Error).message}`);
        continue;
      }
    }
    manifest.push(entry);
    saveManifest();
    counts.patched++;
    counts.fields += fields.length;
    counts.citations += plan.citationsAdded.length;
  }

  // Second pass for created people: their gurus may name someone created after them.
  if (!dryRun) {
    for (const { person, id } of created) {
      if (person.gurus.every(g => !g.guruKey)) continue;
      const fresh = (await Artist.getArtist(id)) as unknown as SspStoredArtist | null;
      if (!fresh) continue;
      const plan = planSspPersonAttach(person, fresh, { resolveGuru });
      if (!plan.update.gurus) continue;
      const problem = checkPayload(UpdateArtistSchema, { gurus: plan.update.gurus });
      if (problem) {
        hold(person.key, person.iastName, `guru ids fail the artist schema: ${problem}`);
        continue;
      }
      await Artist.updateArtist(id, { gurus: plan.update.gurus } as never);
      console.log(`✍️  ${fresh.name}: guru ids filled`);
    }
  }

  saveManifest();
  writeFileSync(
    heldFile,
    toCsv([['ssp_key', 'name', 'kind', 'field', 'value', 'reason'], ...heldRows]),
    'utf-8'
  );
  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}🎉 ${counts.created} artists ${dryRun ? 'would be created' : 'created'}, ` +
      `${counts.patched} ${dryRun ? 'would be updated' : 'updated'}, ${counts.unchanged} unchanged, ${counts.refused} rows held back`
  );
  console.log(
    `   ${counts.fields} fields filled, ${counts.citations} citations, ${counts.held} values held`
  );
  console.log(`   Manifest: ${manifestFile}`);
  console.log(`   Held values and refusals: ${heldFile}`);
  if (!dryRun && counts.created + counts.patched > 0) {
    console.log('Next, against the same stage: reindex search (`pnpm cli reindex`).');
  }
}

export async function undoSspPeople(opts: {
  manifest: string;
  only?: string[];
  dryRun?: boolean;
}): Promise<void> {
  const { manifest: file, dryRun = false } = opts;
  const core = await import('@rasika/core');
  const Artist = core.Artist;
  const entries = JSON.parse(readFileSync(file, 'utf-8')) as SspPeopleManifestEntry[];
  const only = opts.only ? new Set(opts.only.map(s => s.trim())) : null;
  const save = () => writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
  const inRun = new Set(entries.map(e => e.artistId));

  let restored = 0;
  let deleted = 0;
  let kept = 0;
  let skippedFields = 0;

  // Patched records first: that removes the guru rows that point at records we may delete.
  for (const entry of entries) {
    if (entry.kind !== 'patched') continue;
    if (only && !only.has(entry.artistId)) continue;
    if (entry.undoneAt) {
      console.log(`↩️  ${entry.name}: already undone`);
      continue;
    }
    const current = await Artist.getArtist(entry.artistId);
    if (!current) {
      console.log(`⚠️  ${entry.name}: artist is gone, skipped`);
      continue;
    }
    const plan = planSspPersonUndo(entry, current as never);
    for (const s of plan.skipped) {
      console.log(`⚠️  ${entry.name}.${s.field}: ${s.reason}, left as it is`);
      skippedFields++;
    }
    const note = `restore ${plan.restored.join(', ') || 'nothing'}; remove ${plan.citationsRemoved} citations`;
    if (dryRun) {
      console.log(`[dry-run] would undo ${entry.name}: ${note}`);
      continue;
    }
    // `isHistorical` is not clearable; a record that was not historical goes back to false.
    const set: Record<string, unknown> = { ...plan.set };
    const clear = plan.remove.filter(f => f !== 'isHistorical');
    if (plan.remove.includes('isHistorical')) set.isHistorical = false;
    if (Object.keys(set).length > 0 || clear.length > 0) {
      await Artist.updateArtist(entry.artistId, set as never, clear);
    }
    entry.undoneAt = new Date().toISOString();
    if (plan.skipped.length > 0) entry.undoSkipped = plan.skipped;
    save();
    console.log(`↩️  ${entry.name}: ${note}`);
    restored++;
  }

  const everyone = dryRun ? [] : await Artist.listAllArtistsForMatching();
  for (const entry of entries) {
    if (entry.kind !== 'created') continue;
    if (only && !only.has(entry.artistId)) continue;
    if (entry.undoneAt) {
      console.log(`↩️  ${entry.name}: already undone`);
      continue;
    }
    const current = await Artist.getArtist(entry.artistId);
    if (!current) {
      console.log(`⚠️  ${entry.name}: artist is gone, skipped`);
      continue;
    }
    const compositions = await compositionCount(core, entry.artistId);
    const events = (await core.EventArtist.getEventsByArtist(entry.artistId, { limit: 5 })).items
      .length;
    // Another record naming it as guru, unless that record is one this run made and is undoing.
    const gurusReferencing = everyone.filter(
      a =>
        a.id !== entry.artistId &&
        !a.deletedAt &&
        !(inRun.has(a.id) && (!only || only.has(a.id))) &&
        (a.gurus ?? []).some(g => g.id === entry.artistId)
    ).length;
    const verdict = planSspCreatedUndo({ compositions, events, gurusReferencing });
    if (!verdict.delete) {
      console.log(`⚠️  ${entry.name}: kept, ${verdict.reasons.join('; ')}`);
      entry.undoNote = `kept: ${verdict.reasons.join('; ')}`;
      kept++;
      if (!dryRun) save();
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would delete ${entry.name} (${entry.artistId})`);
      continue;
    }
    await Artist.softDeleteArtist(entry.artistId);
    entry.undoneAt = new Date().toISOString();
    save();
    console.log(`↩️  ${entry.name}: deleted`);
    deleted++;
  }
  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}${restored} records restored, ${deleted} created records deleted, ${kept} kept because something links to them, ${skippedFields} fields left as edited`
  );
  if (!dryRun && restored + deleted > 0) console.log('Reindex search next.');
}

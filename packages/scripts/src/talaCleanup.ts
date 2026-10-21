import { readFileSync, writeFileSync } from 'node:fs';
import { AdminData } from '@rasika/core';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  formatTalaCleanupDecision,
  parseTalaCleanupDecision,
  suggestTalaCleanup,
  talaIdsAfter,
  talaKey,
} from '@rasika/core/domain/tala/cleanup';

/**
 * The tala table, in two steps: report, then apply a reviewed file. Rules and the meaning of each
 * decision are in `domain/tala/cleanup.ts`.
 *
 * The canonical list is the talas that carry real use. Anything else either merges into one of
 * them, splits into several, stays, or comes off its compositions.
 */

const CSV_HEADER = ['decision', 'suggestion', 'id', 'name', 'compositions', 'sample_titles'];

/** Talas used widely enough that a second spelling should become them. */
const CANONICAL = [
  'Adi',
  'rUpaka',
  'cApu',
  'aTa',
  'jhampa',
  'tripuTa',
  'Eka',
  'dEshaadi',
  'madhyaadi',
  'maTya',
  'dhruva',
  'cempat',
  'aTanta',
];

type TalaRow = { id: string; name: string; deletedAt?: string; mergedIntoId?: string };
type CompositionRow = {
  id: string;
  title: string;
  deletedAt?: string;
  talas?: Array<{ id: string; name: string }>;
};

async function load() {
  const talas = (await AdminData.listAllForDomain('tala')) as unknown as TalaRow[];
  const compositions = (
    (await AdminData.listAllForDomain('composition')) as unknown as CompositionRow[]
  ).filter(c => !c.deletedAt);
  const live = talas.filter(t => !t.deletedAt && !t.mergedIntoId);
  const byTala = new Map<string, CompositionRow[]>();
  for (const c of compositions) {
    for (const t of c.talas ?? []) {
      const list = byTala.get(t.id) ?? [];
      list.push(c);
      byTala.set(t.id, list);
    }
  }
  return { live, byTala };
}

export async function reportTalaCleanup(opts: { out: string }): Promise<void> {
  const { live, byTala } = await load();
  const ragas = (await AdminData.listAllForDomain('raga')) as unknown as TalaRow[];
  const ragaKeys = new Set(ragas.filter(r => !r.deletedAt).map(r => talaKey(r.name)));

  const rows = live
    .map(t => {
      const used = byTala.get(t.id) ?? [];
      const suggestion = suggestTalaCleanup(t.name, CANONICAL, ragaKeys);
      return {
        count: used.length,
        cells: [
          '',
          suggestion ? formatTalaCleanupDecision(suggestion) : '',
          t.id,
          t.name,
          String(used.length),
          used
            .slice(0, 3)
            .map(c => c.title)
            .join(' | '),
        ],
      };
    })
    .sort((a, b) => b.count - a.count);

  writeFileSync(opts.out, toCsv([CSV_HEADER, ...rows.map(r => r.cells)]));
  const unsuggested = rows.filter(r => !r.cells[1]).length;
  console.log(`🔎 ${rows.length} talas → ${opts.out} (${unsuggested} with no suggestion)`);
  console.log('   decision: keep, unlink, merge:<name> or split:<name>|<name>');
}

export async function applyTalaCleanup(opts: { file: string; dryRun?: boolean }): Promise<void> {
  const { file, dryRun = false } = opts;
  const { Composition, Tala } = await import('@rasika/core');
  const { live, byTala } = await load();
  const byName = new Map(live.map(t => [t.name, t]));
  const byId = new Map(live.map(t => [t.id, t]));

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  const decisionAt = col('decision');
  const idAt = col('id');
  if (decisionAt < 0 || idAt < 0) throw new Error(`${file} is missing decision/id columns`);

  // Written after every tala, so a run that dies midway still records what it changed. Each
  // entry holds the compositions' talas before, which is what an undo would restore.
  const log: unknown[] = [];
  const logFile = `${file}.${dryRun ? 'dry-run' : 'applied'}.json`;
  const saveLog = () => writeFileSync(logFile, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
  const totals = { merged: 0, split: 0, unlinked: 0, compositions: 0, skipped: 0 };

  for (const row of rows) {
    const raw = (row[decisionAt] ?? '').trim();
    const id = (row[idAt] ?? '').trim();
    const tala = byId.get(id);
    const decision = parseTalaCleanupDecision(raw);
    if (!raw || decision?.kind === 'keep') continue;
    if (!decision || !tala) {
      console.log(`⚠️  skipped ${row[col('name')] ?? id}: ${tala ? `"${raw}"` : 'not live'}`);
      totals.skipped++;
      continue;
    }

    const targets =
      decision.kind === 'merge' ? [decision.into] : decision.kind === 'split' ? decision.into : [];
    const targetRows = targets.map(name => byName.get(name));
    if (targetRows.some(t => !t || t.id === tala.id)) {
      console.log(`⚠️  skipped ${tala.name}: ${targets.join(', ')} is not another live tala`);
      totals.skipped++;
      continue;
    }
    const targetIds = targetRows.map(t => t?.id ?? '');
    const used = byTala.get(tala.id) ?? [];
    const label = `${tala.name} → ${formatTalaCleanupDecision(decision)} (${used.length} compositions)`;
    console.log(`${dryRun ? '🔍' : '✍️ '} ${label}`);

    const changes = used.map(c => {
      const before = (c.talas ?? []).map(t => t.id);
      return { id: c.id, title: c.title, before, after: talaIdsAfter(before, tala.id, targetIds) };
    });
    log.push({ id: tala.id, name: tala.name, decision: raw, compositions: changes });

    if (!dryRun) {
      if (decision.kind === 'merge') {
        await Tala.mergeTala(tala.id, targetIds[0] ?? '');
      } else {
        for (const change of changes) {
          await Composition.updateComposition(change.id, { talaIds: change.after });
        }
        if (decision.kind === 'split') await Tala.mergeTala(tala.id, targetIds[0] ?? '');
        else await Tala.softDeleteTala(tala.id);
      }
      saveLog();
    }
    totals.compositions += changes.length;
    if (decision.kind === 'merge') totals.merged++;
    else if (decision.kind === 'split') totals.split++;
    else totals.unlinked++;
  }

  saveLog();
  console.log(
    `\n${dryRun ? 'Would change' : 'Changed'}: ${totals.merged} merged, ${totals.split} split, ` +
      `${totals.unlinked} unlinked, ${totals.compositions} compositions; ${totals.skipped} skipped`
  );
  console.log(`   record → ${logFile}`);
  if (!dryRun) console.log('   Reindex search next: pnpm prod-cli reindex');
}

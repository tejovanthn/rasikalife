import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  type SurvivorStats,
  assessRagaDuplicate,
  compareSurvivors,
  ragaExactKey,
  ragaVariantKey,
} from '@rasika/core/domain/raga/dedup';

/**
 * Duplicate ragas, in two steps: report, then apply a reviewed file.
 *
 * The first version of this matched on the lowercased name and called deleteRaga.
 * Both halves were wrong. Exact-name matching found the case variants and none of
 * the real duplicates, which are spellings — `aabheri` beside `abheri`,
 * `hamirkalyani` beside `hamir-kalyani`, `kalyANi` beside
 * `kalyani (meca kalyani, shantakalyani)`. Around 312 of 1,869 raga pages are a
 * second copy of a raga already on the site, splitting search signals between two
 * indexable URLs.
 *
 * And deleting orphans every composition linked to the loser. `mergeRaga`
 * re-points those junctions and soft-deletes with `mergedIntoId`, which the raga
 * route already turns into a redirect — so a merge consolidates the two URLs
 * instead of breaking one.
 *
 * Fuzzy matching cannot be trusted to write on its own: `ranjani` and
 * `rasikaranjani` are different ragas, and so are `shri` and `shuddha shri`. So
 * this reports candidates with the evidence needed to judge them, and merges only
 * what a person has marked. Same shape as the bio extraction pipeline, for the
 * same reason.
 */

type RagaItem = {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  tradition?: string;
  arohanam?: string;
  avarohanam?: string;
  alternateScales?: string[];
  rasa?: string;
  timeOfDay?: string;
  season?: string;
  melaNumber?: number;
  parentRaga?: { id: string; name: string };
  performanceCount?: number;
};

type Candidate = {
  tier: 'exact' | 'variant';
  canonical: RagaItem;
  loser: RagaItem;
  canonicalStats: SurvivorStats;
  loserStats: SurvivorStats;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

const CSV_HEADER = [
  'decision',
  'suggestion',
  'confidence',
  'reason',
  'tier',
  'match_key',
  'canonical_id',
  'canonical_name',
  'canonical_impressions',
  'canonical_mela',
  'canonical_parent',
  'canonical_arohanam',
  'canonical_avarohanam',
  'canonical_compositions',
  'canonical_performances',
  'loser_id',
  'loser_name',
  'loser_impressions',
  'loser_mela',
  'loser_parent',
  'loser_arohanam',
  'loser_avarohanam',
  'loser_compositions',
  'loser_performances',
];

const SUGGESTION = { high: 'merge', medium: 'review', low: 'skip' } as const;

/**
 * Search Console impressions per raga id, from a page-dimension export: a JSON
 * array of `{ page, impressions }`. Every slug of one id is summed, and the
 * `/compositions` subpage is left out — it is a different page.
 */
function loadImpressions(file?: string): Map<string, number> {
  const byId = new Map<string, number>();
  if (!file) return byId;
  const rows = JSON.parse(readFileSync(file, 'utf-8')) as Array<{
    page: string;
    impressions: number;
  }>;
  for (const row of rows) {
    const path = decodeURIComponent(new URL(row.page).pathname);
    const match = path.match(/^\/carnatic\/ragas\/[^/]*-([A-Za-z0-9]+)$/);
    if (!match) continue;
    byId.set(match[1], (byId.get(match[1]) ?? 0) + row.impressions);
  }
  return byId;
}

/** Fields a person would look at to decide which record is the real one. */
function filledFieldCount(r: RagaItem): number {
  return [
    r.description,
    r.tradition,
    r.arohanam,
    r.avarohanam,
    r.rasa,
    r.timeOfDay,
    r.season,
    r.melaNumber,
    r.parentRaga,
  ].filter(v => v !== undefined && v !== null && v !== '').length;
}

async function loadAllRagas(): Promise<RagaItem[]> {
  const Raga = await import('@rasika/core/domain/raga');
  const all: RagaItem[] = [];
  let nextToken: string | undefined;
  do {
    const page = await Raga.listRagas({ limit: 200, nextToken });
    all.push(...(page.items as RagaItem[]));
    nextToken = page.nextToken;
  } while (nextToken);
  return all;
}

export async function reportDuplicateRagas(opts: {
  out: string;
  impressions?: string;
}): Promise<void> {
  const Raga = await import('@rasika/core/domain/raga');
  const impressions = loadImpressions(opts.impressions);
  if (opts.impressions) console.log(`📈 Impressions for ${impressions.size} raga pages`);

  console.log('📖 Loading all ragas...');
  const all = await loadAllRagas();
  console.log(`📋 Loaded ${all.length} ragas`);

  const groups = new Map<string, { tier: 'exact' | 'variant'; items: RagaItem[] }>();

  const byExact = new Map<string, RagaItem[]>();
  for (const raga of all) {
    const key = ragaExactKey(raga.name);
    byExact.set(key, [...(byExact.get(key) ?? []), raga]);
  }
  for (const [key, items] of byExact) {
    if (items.length > 1) groups.set(key, { tier: 'exact', items });
  }

  // Variant grouping runs over the exact-key survivors only, so a pair already
  // reported as exact is not reported a second time.
  const byVariant = new Map<string, RagaItem[]>();
  for (const [key, items] of byExact) {
    if (items.length > 1) continue;
    const vk = ragaVariantKey(key);
    byVariant.set(vk, [...(byVariant.get(vk) ?? []), items[0]]);
  }
  for (const [key, items] of byVariant) {
    if (items.length > 1) groups.set(`~${key}`, { tier: 'variant', items });
  }

  console.log(`🔍 ${groups.size} groups to review — counting compositions on each...`);

  const stats = new Map<string, SurvivorStats>();
  for (const raga of [...groups.values()].flatMap(g => g.items)) {
    if (stats.has(raga.id)) continue;
    stats.set(raga.id, {
      id: raga.id,
      impressions: impressions.get(raga.id) ?? 0,
      compositions: await Raga.getRagaMergeScore(raga.id),
      performances: raga.performanceCount ?? 0,
      filledFields: filledFieldCount(raga),
      createdAt: raga.createdAt,
    });
  }
  const statsOf = (r: RagaItem) => stats.get(r.id) as SurvivorStats;

  const candidates: Candidate[] = [];
  for (const { tier, items } of groups.values()) {
    const sorted = [...items].sort((a, b) => compareSurvivors(statsOf(a), statsOf(b)));
    const [canonical, ...losers] = sorted;
    for (const loser of losers) {
      const { confidence, reason } = assessRagaDuplicate(tier, canonical, loser);
      candidates.push({
        tier,
        canonical,
        loser,
        canonicalStats: statsOf(canonical),
        loserStats: statsOf(loser),
        confidence,
        reason,
      });
    }
  }

  // Most-searched pairs first: they are the ones worth reviewing carefully.
  candidates.sort(
    (a, b) =>
      b.canonicalStats.impressions +
      b.loserStats.impressions -
      (a.canonicalStats.impressions + a.loserStats.impressions)
  );

  const rows = candidates.map(c => [
    '', // decision: write "merge" to apply; anything else is skipped
    SUGGESTION[c.confidence],
    c.confidence,
    c.reason,
    c.tier,
    ragaExactKey(c.canonical.name),
    c.canonical.id,
    c.canonical.name,
    String(c.canonicalStats.impressions),
    String(c.canonical.melaNumber ?? ''),
    c.canonical.parentRaga?.name ?? '',
    c.canonical.arohanam ?? '',
    c.canonical.avarohanam ?? '',
    String(c.canonicalStats.compositions),
    String(c.canonicalStats.performances),
    c.loser.id,
    c.loser.name,
    String(c.loserStats.impressions),
    String(c.loser.melaNumber ?? ''),
    c.loser.parentRaga?.name ?? '',
    c.loser.arohanam ?? '',
    c.loser.avarohanam ?? '',
    String(c.loserStats.compositions),
    String(c.loserStats.performances),
  ]);

  writeFileSync(opts.out, toCsv([CSV_HEADER, ...rows]), 'utf-8');

  const exact = candidates.filter(c => c.tier === 'exact').length;
  const by = (level: string) => candidates.filter(c => c.confidence === level).length;
  console.log(`\n✅ Wrote ${candidates.length} candidate pairs to ${opts.out}`);
  console.log(`   ${exact} exact-name, ${candidates.length - exact} spelling variants`);
  console.log(`   confidence: ${by('high')} high, ${by('medium')} medium, ${by('low')} low`);
  console.log('\nReview the file, put "merge" in the decision column, then run:');
  console.log(`   pnpm prod-cli dedup-ragas --apply --file ${opts.out} --dry-run`);
  console.log('   (`pnpm cli` runs against your personal stage, not production.)');
}

export async function applyDuplicateRagaMerges(opts: {
  file: string;
  dryRun?: boolean;
}): Promise<void> {
  const { file, dryRun = false } = opts;
  const Raga = await import('@rasika/core/domain/raga');

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  const decisionAt = col('decision');
  const canonicalAt = col('canonical_id');
  const loserAt = col('loser_id');
  if (decisionAt < 0 || canonicalAt < 0 || loserAt < 0) {
    throw new Error(`${file} is missing decision/canonical_id/loser_id columns`);
  }

  const approved = rows.filter(r => (r[decisionAt] ?? '').trim().toLowerCase() === 'merge');
  console.log(`📋 ${rows.length} rows, ${approved.length} marked merge`);

  if (approved.length === 0) {
    console.log('Nothing marked. Put "merge" in the decision column first.');
    return;
  }

  let merged = 0;
  let skipped = 0;
  const totals = { moved: 0, alreadyThere: 0, performances: 0, children: 0, filled: 0 };
  const log: unknown[] = [];

  for (const row of approved) {
    const canonicalId = (row[canonicalAt] ?? '').trim();
    const loserId = (row[loserAt] ?? '').trim();
    const label = `${row[col('loser_name')] ?? loserId} → ${row[col('canonical_name')] ?? canonicalId}`;

    if (!canonicalId || !loserId || canonicalId === loserId) {
      console.log(`⚠️  skipped ${label}: needs two different ids`);
      skipped++;
      continue;
    }

    const preview = await Raga.previewRagaMerge(loserId, canonicalId);
    if (!preview.loser || !preview.canonical) {
      console.log(`⚠️  skipped ${label}: a record is missing`);
      skipped++;
      continue;
    }
    if (preview.loser.deletedAt || preview.canonical.deletedAt) {
      console.log(`⚠️  skipped ${label}: already merged or deleted`);
      skipped++;
      continue;
    }

    const { children, fillPatch } = preview;
    const filled = Object.keys(fillPatch);
    totals.moved += preview.compositionsMoved.length;
    totals.alreadyThere += preview.compositionsAlreadyOnCanonical.length;
    totals.performances += preview.loserPerformances;
    totals.children += children.length;
    if (filled.length) totals.filled++;

    const notes = [
      `${preview.compositionsMoved.length} compositions re-pointed`,
      `${preview.compositionsAlreadyOnCanonical.length} already on canonical`,
      preview.loserPerformances ? `${preview.loserPerformances} performances NOT moved` : '',
      children.length ? `janya re-parented: ${children.join(', ')}` : '',
      filled.length ? `survivor gains: ${filled.join(', ')}` : '',
    ].filter(Boolean);

    log.push({
      loserId,
      canonicalId,
      loserName: preview.loser.name,
      canonicalName: preview.canonical.name,
      compositionsMoved: preview.compositionsMoved,
      compositionsAlreadyOnCanonical: preview.compositionsAlreadyOnCanonical,
      loserPerformances: preview.loserPerformances,
      children,
      fillPatch,
    });

    if (dryRun) {
      console.log(`[dry-run] would merge ${label}: ${notes.join('; ')}`);
      merged++;
      continue;
    }
    try {
      await Raga.mergeRaga(loserId, canonicalId);
      console.log(`🔗 merged ${label}: ${notes.join('; ')}`);
      merged++;
    } catch (error) {
      console.error(`❌ failed ${label}: ${(error as Error).message}`);
      skipped++;
    }
  }

  // The record of what moved. A merge has no automatic undo; this is what one
  // would be rebuilt from: clear deletedAt/mergedIntoId on the loser, re-point
  // these junctions and children back, and blank the filled survivor fields.
  const logFile = `${file}.${dryRun ? 'dry-run' : 'applied'}.json`;
  writeFileSync(logFile, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');

  console.log(`\n${dryRun ? '[dry-run] ' : ''}🎉 ${merged} merged, ${skipped} skipped`);
  console.log(
    `   ${totals.moved} compositions re-pointed, ${totals.alreadyThere} already on canonical, ` +
      `${totals.performances} performances not moved, ${totals.children} janya re-parented, ` +
      `${totals.filled} survivors gain fields from the loser`
  );
  console.log(`   Details: ${logFile}`);
  if (!dryRun && merged > 0) {
    console.log('Merged ragas redirect to their canonical URL. Next, against the same stage:');
    console.log(
      '   reindex search, then `generate-melakarta-links` (a merged id may be in the map).'
    );
  }
}

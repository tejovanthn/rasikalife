import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import { ragaExactKey, ragaVariantKey } from '@rasika/core/domain/raga/dedup';

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
};

type Candidate = {
  tier: 'exact' | 'variant';
  canonical: RagaItem;
  loser: RagaItem;
  canonicalUses: number;
  loserUses: number;
};

const CSV_HEADER = [
  'decision',
  'tier',
  'match_key',
  'canonical_id',
  'canonical_name',
  'canonical_mela',
  'canonical_arohanam',
  'canonical_compositions',
  'loser_id',
  'loser_name',
  'loser_mela',
  'loser_arohanam',
  'loser_compositions',
];

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

/**
 * The record with more compositions attached wins, because that is the one the
 * rest of the database — and Google — already points at. Completeness breaks a
 * tie, then age.
 */
function rank(a: RagaItem, aUses: number, b: RagaItem, bUses: number): number {
  if (aUses !== bUses) return bUses - aUses;
  const fields = filledFieldCount(b) - filledFieldCount(a);
  if (fields !== 0) return fields;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export async function reportDuplicateRagas(opts: { out: string }): Promise<void> {
  const Raga = await import('@rasika/core/domain/raga');

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

  const uses = new Map<string, number>();
  for (const raga of [...groups.values()].flatMap(g => g.items)) {
    if (uses.has(raga.id)) continue;
    uses.set(raga.id, await Raga.getRagaMergeScore(raga.id));
  }

  const candidates: Candidate[] = [];
  for (const { tier, items } of groups.values()) {
    const sorted = [...items].sort((a, b) => rank(a, uses.get(a.id) ?? 0, b, uses.get(b.id) ?? 0));
    const [canonical, ...losers] = sorted;
    for (const loser of losers) {
      candidates.push({
        tier,
        canonical,
        loser,
        canonicalUses: uses.get(canonical.id) ?? 0,
        loserUses: uses.get(loser.id) ?? 0,
      });
    }
  }

  const rows = candidates.map(c => [
    '', // decision: write "merge" to apply; anything else is skipped
    c.tier,
    ragaExactKey(c.canonical.name),
    c.canonical.id,
    c.canonical.name,
    String(c.canonical.melaNumber ?? ''),
    c.canonical.arohanam ?? '',
    String(c.canonicalUses),
    c.loser.id,
    c.loser.name,
    String(c.loser.melaNumber ?? ''),
    c.loser.arohanam ?? '',
    String(c.loserUses),
  ]);

  writeFileSync(opts.out, toCsv([CSV_HEADER, ...rows]), 'utf-8');

  const exact = candidates.filter(c => c.tier === 'exact').length;
  console.log(`\n✅ Wrote ${candidates.length} candidate pairs to ${opts.out}`);
  console.log(`   ${exact} exact-name, ${candidates.length - exact} spelling variants`);
  console.log('\nReview the file, put "merge" in the decision column, then run:');
  console.log(`   pnpm cli dedup-ragas --apply --file ${opts.out} --dry-run`);
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
  for (const row of approved) {
    const canonicalId = (row[canonicalAt] ?? '').trim();
    const loserId = (row[loserAt] ?? '').trim();
    const label = `${row[col('loser_name')] ?? loserId} → ${row[col('canonical_name')] ?? canonicalId}`;

    if (!canonicalId || !loserId || canonicalId === loserId) {
      console.log(`⚠️  skipped ${label}: needs two different ids`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would merge ${label}`);
      merged++;
      continue;
    }
    try {
      await Raga.mergeRaga(loserId, canonicalId);
      console.log(`🔗 merged ${label}`);
      merged++;
    } catch (error) {
      console.error(`❌ failed ${label}: ${(error as Error).message}`);
      skipped++;
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}🎉 ${merged} merged, ${skipped} skipped`);
  if (!dryRun && merged > 0) {
    console.log('Merged ragas redirect to their canonical URL. Reindex search next.');
  }
}

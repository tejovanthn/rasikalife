import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';
import {
  isNearMatch,
  placeExactKey,
  placeVariantKey,
  placeWords,
  wordsSubsetOf,
} from '@rasika/core/shared/place-dedup';

/**
 * Duplicate venues and organisers, in two steps: report, then apply a reviewed file.
 * Same shape as `dedup-ragas`, for the same reasons — see `shared/place-dedup.ts` for why
 * the matching is tiered and `docs` for why nothing here merges on its own.
 *
 * Both lists arrived name-only, one row created every time an event named something the
 * database had not seen, so the same body is stored under every spelling a poster used.
 * `Bangalore Gayana Samaja` is split six ways, which splits its events across six
 * indexable URLs.
 *
 * `mergeVenue` and `mergeOrganiser` re-point the junctions, soft-delete the loser with
 * `mergedIntoId` — which both routes already turn into a redirect — and keep the loser's
 * name as an `alternateName`. Nothing here deletes.
 */

type Domain = 'venue' | 'organiser';

type PlaceItem = {
  id: string;
  name: string;
  createdAt: string;
  city?: string;
  address?: { city?: string; street?: string };
  website?: string;
  phone?: string;
  description?: string;
};

type Tier = 'exact' | 'variant' | 'near' | 'contains';

type Candidate = {
  domain: Domain;
  tier: Tier;
  matchKey: string;
  canonical: PlaceItem;
  loser: PlaceItem;
  canonicalScore: number;
  loserScore: number;
};

const CSV_HEADER = [
  'decision',
  'domain',
  'tier',
  'match_key',
  'canonical_id',
  'canonical_name',
  'canonical_score',
  'canonical_detail',
  'loser_id',
  'loser_name',
  'loser_score',
  'loser_detail',
];

/** What a reviewer needs beside the name to tell two rows apart. */
function detail(item: PlaceItem): string {
  return [item.city ?? item.address?.city, item.address?.street, item.website, item.phone]
    .filter(Boolean)
    .join(' · ');
}

async function loadAll(domain: Domain): Promise<PlaceItem[]> {
  const all: PlaceItem[] = [];
  let nextToken: string | undefined;
  if (domain === 'venue') {
    const Venue = await import('@rasika/core/domain/venue');
    do {
      const page = await Venue.listVenues({ limit: 200, nextToken });
      all.push(...(page.items as unknown as PlaceItem[]));
      nextToken = page.nextToken;
    } while (nextToken);
  } else {
    const Organiser = await import('@rasika/core/domain/organiser');
    do {
      const page = await Organiser.listOrganisers({ limit: 200, nextToken });
      all.push(...(page.items as unknown as PlaceItem[]));
      nextToken = page.nextToken;
    } while (nextToken);
  }
  return all;
}

async function scoreOf(domain: Domain, id: string): Promise<number> {
  if (domain === 'venue') {
    const Venue = await import('@rasika/core/domain/venue');
    return Venue.getVenueMergeScore(id);
  }
  const Organiser = await import('@rasika/core/domain/organiser');
  return Organiser.getOrganiserMergeScore(id);
}

/**
 * The record the rest of the database already points at wins — that is what the merge
 * score measures, events attached plus the fields a person filled. Age breaks a tie, so
 * the URL that has been indexed longest survives.
 */
function rank(a: PlaceItem, aScore: number, b: PlaceItem, bScore: number): number {
  if (aScore !== bScore) return bScore - aScore;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

type Group = { key: string; items: PlaceItem[]; tierOf: Map<string, Tier> };

/**
 * Every duplicate relation found, as one connected group per real place.
 *
 * The tiers are not a filter that each row falls through once — a row already gathered by
 * a shared key must still be reachable by the weaker tiers, or the report misses the pairs
 * most worth seeing. `Chowdiah Memorial Hall` and `Chowdiah memorial hall, Bengaluru` share
 * a variant key, and `Chowdaiah Memorial Hall` is one letter from both; claiming the first
 * two and moving on left the third stranded and the report said there were no near matches
 * at all. So relations accumulate and the rows they touch are joined into one group, with
 * each row keeping the strongest tier that reached it — which is what the reviewer sorts on.
 */
export function groupDuplicates(items: PlaceItem[]): Group[] {
  const parent = new Map<string, string>(items.map(item => [item.id, item.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor) as string;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(ra, rb);
  };

  const TIER_RANK: Record<Tier, number> = { exact: 0, variant: 1, near: 2, contains: 3 };
  const tierOf = new Map<string, Tier>();
  const relate = (a: PlaceItem, b: PlaceItem, tier: Tier) => {
    for (const id of [a.id, b.id]) {
      const current = tierOf.get(id);
      if (!current || TIER_RANK[tier] < TIER_RANK[current]) tierOf.set(id, tier);
    }
    union(a.id, b.id);
  };

  const byKey = (keyOf: (item: PlaceItem) => string, tier: Tier) => {
    const map = new Map<string, PlaceItem[]>();
    for (const item of items) map.set(keyOf(item), [...(map.get(keyOf(item)) ?? []), item]);
    for (const group of map.values()) {
      for (let i = 1; i < group.length; i++) relate(group[0], group[i], tier);
    }
  };

  byKey(item => placeExactKey(item.name), 'exact');
  byKey(item => placeVariantKey(item.name), 'variant');

  // The last two tiers are relations between two names rather than a shared key, so they
  // are found pairwise. A pair already in the same group is skipped, which keeps a large
  // group from re-reporting every internal pair, but a pair spanning two groups is what
  // joins them.
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (find(items[i].id) === find(items[j].id)) continue;
      if (isNearMatch(placeExactKey(items[i].name), placeExactKey(items[j].name))) {
        relate(items[i], items[j], 'near');
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (i === j || find(items[i].id) === find(items[j].id)) continue;
      if (wordsSubsetOf(placeWords(items[i].name), placeWords(items[j].name))) {
        relate(items[i], items[j], 'contains');
      }
    }
  }

  const components = new Map<string, PlaceItem[]>();
  for (const item of items) {
    if (!tierOf.has(item.id)) continue;
    const root = find(item.id);
    components.set(root, [...(components.get(root) ?? []), item]);
  }

  return [...components.values()]
    .filter(group => group.length > 1)
    .map(group => ({ key: placeVariantKey(group[0].name), items: group, tierOf }));
}

export async function reportDuplicatePlaces(opts: { out: string }): Promise<void> {
  const candidates: Candidate[] = [];

  for (const domain of ['venue', 'organiser'] as const) {
    console.log(`📖 Loading ${domain}s...`);
    const all = await loadAll(domain);
    console.log(`📋 ${all.length} ${domain}s`);

    const groups = groupDuplicates(all);
    console.log(`🔍 ${groups.length} ${domain} groups — scoring each row...`);

    const scores = new Map<string, number>();
    for (const item of groups.flatMap(g => g.items)) {
      if (scores.has(item.id)) continue;
      scores.set(item.id, await scoreOf(domain, item.id));
    }

    for (const { key, items: group, tierOf } of groups) {
      const sorted = [...group].sort((a, b) =>
        rank(a, scores.get(a.id) ?? 0, b, scores.get(b.id) ?? 0)
      );
      const [canonical, ...losers] = sorted;
      for (const loser of losers) {
        candidates.push({
          domain,
          tier: tierOf.get(loser.id) ?? 'contains',
          matchKey: key,
          canonical,
          loser,
          canonicalScore: scores.get(canonical.id) ?? 0,
          loserScore: scores.get(loser.id) ?? 0,
        });
      }
    }
  }

  const order: Record<Tier, number> = { exact: 0, variant: 1, near: 2, contains: 3 };
  candidates.sort(
    (a, b) =>
      order[a.tier] - order[b.tier] ||
      a.domain.localeCompare(b.domain) ||
      a.matchKey.localeCompare(b.matchKey)
  );

  const rows = candidates.map(c => [
    '', // decision: write "merge" to apply; anything else is skipped
    c.domain,
    c.tier,
    c.matchKey,
    c.canonical.id,
    c.canonical.name,
    String(c.canonicalScore),
    detail(c.canonical),
    c.loser.id,
    c.loser.name,
    String(c.loserScore),
    detail(c.loser),
  ]);

  writeFileSync(opts.out, toCsv([CSV_HEADER, ...rows]), 'utf-8');

  const byTier = (tier: Tier) => candidates.filter(c => c.tier === tier).length;
  console.log(`\n✅ Wrote ${candidates.length} candidate pairs to ${opts.out}`);
  console.log(
    `   ${byTier('exact')} exact, ${byTier('variant')} variant, ${byTier('near')} near, ${byTier('contains')} contained`
  );
  console.log('\nReview the file, put "merge" in the decision column, then run:');
  console.log(`   pnpm cli dedup-places --apply --file ${opts.out} --dry-run`);
}

export async function applyDuplicatePlaceMerges(opts: {
  file: string;
  dryRun?: boolean;
}): Promise<void> {
  const { file, dryRun = false } = opts;
  const Venue = await import('@rasika/core/domain/venue');
  const Organiser = await import('@rasika/core/domain/organiser');

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  const decisionAt = col('decision');
  const domainAt = col('domain');
  const canonicalAt = col('canonical_id');
  const loserAt = col('loser_id');
  if (decisionAt < 0 || domainAt < 0 || canonicalAt < 0 || loserAt < 0) {
    throw new Error(`${file} is missing decision/domain/canonical_id/loser_id columns`);
  }

  const approved = rows.filter(r => (r[decisionAt] ?? '').trim().toLowerCase() === 'merge');
  console.log(`📋 ${rows.length} rows, ${approved.length} marked merge`);

  if (approved.length === 0) {
    console.log('Nothing marked. Put "merge" in the decision column first.');
    return;
  }

  // A row whose canonical is itself merged away in an earlier row would strand the loser
  // behind two redirects, so a canonical that has already lost is followed to its winner.
  const mergedInto = new Map<string, string>();
  const resolveCanonical = (id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (mergedInto.has(current) && !seen.has(current)) {
      seen.add(current);
      current = mergedInto.get(current) as string;
    }
    return current;
  };

  let merged = 0;
  let skipped = 0;
  for (const row of approved) {
    const domain = (row[domainAt] ?? '').trim().toLowerCase();
    const loserId = (row[loserAt] ?? '').trim();
    const canonicalId = resolveCanonical((row[canonicalAt] ?? '').trim());
    const label = `[${domain}] ${row[col('loser_name')] ?? loserId} → ${row[col('canonical_name')] ?? canonicalId}`;

    if (domain !== 'venue' && domain !== 'organiser') {
      console.log(`⚠️  skipped ${label}: domain must be venue or organiser`);
      skipped++;
      continue;
    }
    if (!canonicalId || !loserId || canonicalId === loserId) {
      console.log(`⚠️  skipped ${label}: needs two different ids`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would merge ${label}`);
      mergedInto.set(loserId, canonicalId);
      merged++;
      continue;
    }
    try {
      if (domain === 'venue') await Venue.mergeVenue(loserId, canonicalId);
      else await Organiser.mergeOrganiser(loserId, canonicalId);
      mergedInto.set(loserId, canonicalId);
      console.log(`🔗 merged ${label}`);
      merged++;
    } catch (error) {
      console.error(`❌ failed ${label}: ${(error as Error).message}`);
      skipped++;
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}🎉 ${merged} merged, ${skipped} skipped`);
  if (!dryRun && merged > 0) {
    console.log('Merged rows redirect to their canonical URL. Reindex search next.');
  }
}

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

function sameEnrichment(a: RagaItem, b: RagaItem): boolean {
  return (
    (a.description ?? null) === (b.description ?? null) &&
    (a.tradition ?? null) === (b.tradition ?? null) &&
    (a.arohanam ?? null) === (b.arohanam ?? null) &&
    (a.avarohanam ?? null) === (b.avarohanam ?? null) &&
    (a.rasa ?? null) === (b.rasa ?? null) &&
    (a.timeOfDay ?? null) === (b.timeOfDay ?? null) &&
    (a.season ?? null) === (b.season ?? null) &&
    (a.melaNumber ?? null) === (b.melaNumber ?? null) &&
    JSON.stringify(a.parentRaga ?? null) === JSON.stringify(b.parentRaga ?? null) &&
    JSON.stringify((a.alternateScales ?? []).slice().sort()) ===
      JSON.stringify((b.alternateScales ?? []).slice().sort())
  );
}

export async function dedupRagas(opts: { dryRun?: boolean } = {}) {
  const { dryRun = false } = opts;
  const Raga = await import('@rasika/core/domain/raga');

  console.log('📖 Loading all ragas from database...');
  const allRagas: RagaItem[] = [];
  let nextToken: string | undefined;
  do {
    const page = await Raga.listRagas({ limit: 200, nextToken });
    allRagas.push(...(page.items as RagaItem[]));
    nextToken = page.nextToken;
  } while (nextToken);
  console.log(`📋 Loaded ${allRagas.length} ragas`);

  // Group by name (case-insensitive)
  const byName = new Map<string, RagaItem[]>();
  for (const raga of allRagas) {
    const key = raga.name.toLowerCase();
    const group = byName.get(key) ?? [];
    group.push(raga);
    byName.set(key, group);
  }

  const duplicateGroups = [...byName.values()].filter(g => g.length > 1);
  console.log(`\n🔍 Found ${duplicateGroups.length} names with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  const toDelete: RagaItem[] = [];
  const needsReview: Array<{ canonical: RagaItem; duplicate: RagaItem }> = [];

  for (const group of duplicateGroups) {
    // Oldest first
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const canonical = group[0];
    const dupes = group.slice(1);

    for (const dup of dupes) {
      toDelete.push(dup);
      if (!sameEnrichment(canonical, dup)) {
        needsReview.push({ canonical, duplicate: dup });
      }
    }
  }

  if (toDelete.length > 0) {
    console.log(`🗑️  ${toDelete.length} to delete (keeping older):`);
    for (const r of toDelete) {
      const flag = needsReview.some(nr => nr.duplicate.id === r.id) ? ' ⚠️  different data' : '';
      console.log(`  ${r.name}  ${r.id} (${r.createdAt})${flag}`);
    }
  }

  if (dryRun) {
    console.log('\n[dry-run] No changes written.');
    return;
  }

  if (toDelete.length > 0) {
    console.log('\n⏳ Deleting duplicates...');
    for (const r of toDelete) {
      await Raga.deleteRaga(r.id);
      console.log(`🗑️  Deleted: "${r.name}" (${r.id})`);
    }
  }

  console.log('\n🎉 Dedup complete!');
  console.log(`🗑️  Deleted: ${toDelete.length}`);
}

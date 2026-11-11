import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, toCsv } from '@rasika/core/admin/csv';

/**
 * Duplicate upcoming events and festivals, in two steps: report, then apply a reviewed file.
 * Same shape and rules as `dedup-ragas` and `dedup-places`: merge never delete, nothing merges
 * without a person writing `merge` in `decision`, matching lives in the domain (here
 * `findLikelyDuplicates` and `findSimilarFestivals`, both tested), and the report is read-only.
 *
 * Born of one festival entered twice from two posters (Chowdiah Utsava, 2026-11): every concert
 * in it was listed twice. `mergeEvent` and `mergeFestival` re-point the junctions, fill the
 * keeper's blanks, and soft-delete the loser with `mergedIntoId`, which the event and festival
 * routes turn into a 301.
 */

const CSV_HEADER = [
  'decision',
  'kind',
  'group',
  'keeper_id',
  'keeper_title',
  'keeper_detail',
  'loser_id',
  'loser_title',
  'loser_detail',
  'start',
  'venue',
];

type EventRow = {
  id: string;
  title: string;
  startDateTime: string;
  venueId?: string | null;
  venueName?: string | null;
  status?: string | null;
  posterUrl?: string | null;
  createdAt?: string;
  artists?: Array<{ id?: string | null; name: string }> | null;
  festivalName?: string | null;
};

const eventDetail = (e: EventRow) =>
  [
    `${e.artists?.length ?? 0} artists`,
    e.posterUrl ? 'poster' : 'no poster',
    e.status,
    e.festivalName,
    e.createdAt?.slice(0, 10),
  ]
    .filter(Boolean)
    .join(' · ');

export async function reportDuplicateEvents(opts: { out: string; from?: string }): Promise<void> {
  const Event = await import('@rasika/core/domain/event');
  const Festival = await import('@rasika/core/domain/festival');
  const { groupLikelyDuplicateEvents, groupSimilarFestivals } = await import(
    '@rasika/core/domain/event/sweep'
  );

  const from = opts.from ? new Date(`${opts.from}T00:00:00+05:30`) : new Date();
  if (Number.isNaN(from.getTime())) throw new Error(`--from ${opts.from} is not a date`);
  const fromDate = from.toISOString().slice(0, 10);

  console.log(`📖 Loading upcoming events from ${fromDate}...`);
  const events = (await Event.listUpcomingForDuplicateSweep(from)) as unknown as EventRow[];
  console.log(`📋 ${events.length} approved or submitted events`);

  const rows: string[][] = [];
  const eventPairs = groupLikelyDuplicateEvents(events as never[]) as unknown as Array<{
    keeper: EventRow;
    loser: EventRow;
    group: number;
  }>;
  for (const { keeper, loser, group } of eventPairs) {
    rows.push([
      '',
      'event',
      String(group),
      keeper.id,
      keeper.title,
      eventDetail(keeper),
      loser.id,
      loser.title,
      eventDetail(loser),
      loser.startDateTime,
      loser.venueName ?? '',
    ]);
  }

  console.log('📖 Loading festivals...');
  const festivals = await Festival.listFestivalsForDuplicateSweep(fromDate);
  const counted = await Promise.all(
    festivals.map(async f => ({
      ...f,
      eventCount: (await Event.listEventsByFestival(f.id, { limit: 200 })).items.length,
    }))
  );
  const festivalPairs = groupSimilarFestivals(counted);
  const offset = eventPairs.reduce((max, p) => Math.max(max, p.group), 0);
  for (const { keeper, loser, group } of festivalPairs) {
    const detail = (f: (typeof counted)[number]) =>
      `${f.eventCount} events · ${f.status} · ${f.createdAt?.slice(0, 10) ?? ''}`;
    rows.push([
      '',
      'festival',
      String(offset + group),
      keeper.id,
      keeper.name,
      detail(keeper),
      loser.id,
      loser.name,
      detail(loser),
      `${loser.startDate.slice(0, 10)} to ${loser.endDate.slice(0, 10)}`,
      '',
    ]);
  }

  writeFileSync(opts.out, toCsv([CSV_HEADER, ...rows]), 'utf-8');
  console.log(
    `\n✅ Wrote ${rows.length} candidate pairs to ${opts.out} (${eventPairs.length} events, ${festivalPairs.length} festivals)`
  );
  console.log('\nReview the file, put "merge" in the decision column, then run:');
  console.log(`   pnpm prod-cli event-duplicates --apply --file ${opts.out} --dry-run`);
  console.log('   (`pnpm cli` runs against your personal stage, not production.)');
}

export async function applyDuplicateEventMerges(opts: {
  file: string;
  dryRun?: boolean;
}): Promise<void> {
  const { file, dryRun = false } = opts;
  const Event = await import('@rasika/core/domain/event');
  const Festival = await import('@rasika/core/domain/festival');

  const [header, ...rows] = parseCsv(readFileSync(file, 'utf-8'));
  const col = (name: string) => header.indexOf(name);
  const decisionAt = col('decision');
  const kindAt = col('kind');
  const keeperAt = col('keeper_id');
  const loserAt = col('loser_id');
  if (decisionAt < 0 || kindAt < 0 || keeperAt < 0 || loserAt < 0) {
    throw new Error(`${file} is missing decision/kind/keeper_id/loser_id columns`);
  }

  const approved = rows.filter(r => (r[decisionAt] ?? '').trim().toLowerCase() === 'merge');
  console.log(`📋 ${rows.length} rows, ${approved.length} marked merge`);
  if (approved.length === 0) {
    console.log('Nothing marked. Put "merge" in the decision column first.');
    return;
  }

  // The applied manifest, written after every merge so a run that dies midway still leaves the
  // record of what it did. Festival merges come first: they move events, and an event merge
  // after them still finds its rows.
  const log: unknown[] = [];
  const logFile = `${file}.${dryRun ? 'dry-run' : 'applied'}.json`;
  const saveLog = () => writeFileSync(logFile, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');

  const ordered = [...approved].sort(
    (a, b) => Number(a[kindAt] !== 'festival') - Number(b[kindAt] !== 'festival')
  );
  // A keeper that lost an earlier row is followed to its winner, as in dedup-places.
  const mergedInto = new Map<string, string>();
  const resolve = (id: string) => {
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
  for (const row of ordered) {
    const kind = (row[kindAt] ?? '').trim().toLowerCase();
    const loserId = (row[loserAt] ?? '').trim();
    const keeperId = resolve((row[keeperAt] ?? '').trim());
    const label = `[${kind}] ${row[col('loser_title')] ?? loserId} → ${row[col('keeper_title')] ?? keeperId}`;

    if (kind !== 'event' && kind !== 'festival') {
      console.log(`⚠️  skipped ${label}: kind must be event or festival`);
      skipped++;
      continue;
    }
    if (!keeperId || !loserId || keeperId === loserId) {
      console.log(`⚠️  skipped ${label}: needs two different ids`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would merge ${label}`);
      log.push({ kind, loserId, keeperId, dryRun: true });
      mergedInto.set(loserId, keeperId);
      merged++;
      continue;
    }
    try {
      let moved: number | undefined;
      if (kind === 'event') await Event.mergeEvent(loserId, keeperId);
      else moved = await Festival.mergeFestival(loserId, keeperId);
      mergedInto.set(loserId, keeperId);
      log.push({ kind, loserId, keeperId, eventsMoved: moved, at: new Date().toISOString() });
      saveLog();
      console.log(`🔗 merged ${label}`);
      merged++;
    } catch (error) {
      console.error(`❌ failed ${label}: ${(error as Error).message}`);
      skipped++;
    }
  }

  saveLog();
  console.log(`\n${dryRun ? '[dry-run] ' : ''}🎉 ${merged} merged, ${skipped} skipped`);
  console.log(`Manifest: ${logFile}`);
  if (!dryRun && merged > 0) {
    console.log('Merged pages redirect to the keeper. Reindex search next: pnpm prod-cli reindex');
  }
}

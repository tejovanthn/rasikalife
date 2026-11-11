import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  type CrawlPlanEntry,
  type CrawlStoredData,
  type CrawledEvent,
  type StoredEventLite,
  coverageReport,
  mdndHint,
  mergeCrawled,
  planCrawl,
  renderReviewSheet,
  summarizeCrawl,
} from '@rasika/core/domain/event/crawl';
import { CrawlBlockedError, MIN_INTERVAL_MS, createFetcher } from './crawl/fetcher.js';
import { CRAWL_ADAPTERS, getCrawlAdapter } from './crawl/index.js';

/**
 * Crawling event listing sites for posters and event data: fetch, match (a dry-run manifest),
 * apply (after review), undo. Same shape as `ssp-match` / `ssp-apply`. The decisions are in
 * `@rasika/core/domain/event/crawl`, where they are tested; the sites are in `./crawl/`.
 *
 * `crawl-fetch` and `crawl-match` write nothing to the database or a bucket (match only reads).
 * Downloads are untrusted data: they are saved under `--dir` and parsed, never run.
 */

export const DEFAULT_CRAWL_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../../data/crawl'
);

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function crawlFetch(opts: {
  sources?: string[];
  dir?: string;
  year?: number;
  noPosters?: boolean;
  from?: string;
  through?: string;
}): Promise<void> {
  const base = opts.dir ?? DEFAULT_CRAWL_DIR;
  const names = opts.sources?.length ? opts.sources : Object.keys(CRAWL_ADAPTERS);
  const report: Record<string, unknown> = {};
  for (const name of names) {
    const adapter = getCrawlAdapter(name);
    const dir = path.join(base, name);
    mkdirSync(dir, { recursive: true });
    const fetcher = createFetcher(dir, MIN_INTERVAL_MS);
    console.log(`🌐 ${name}`);
    try {
      await adapter.fetch(dir, fetcher, {
        year: opts.year,
        noPosters: opts.noPosters,
        from: opts.from,
        through: opts.through,
      });
      const events = adapter.load(dir);
      console.log(`  ✅ ${events.length} events, ${fetcher.requests} request(s)`);
      report[name] = { status: 'ok', events: events.length, robots: fetcher.robots };
    } catch (error) {
      if (error instanceof CrawlBlockedError) {
        console.log(`  ⛔ ${error.message}`);
        report[name] = { status: 'blocked', reason: error.message, robots: fetcher.robots };
        continue;
      }
      throw error;
    }
  }
  writeFileSync(path.join(base, 'fetch-report.json'), JSON.stringify(report, null, 2));
}

export function loadCrawled(base: string, sources?: string[]): CrawledEvent[] {
  const names = sources?.length ? sources : Object.keys(CRAWL_ADAPTERS);
  const bySource = new Map<string, CrawledEvent[]>();
  for (const name of names) {
    const dir = path.join(base, name);
    if (!existsSync(dir)) continue;
    bySource.set(name, getCrawlAdapter(name).load(dir));
  }
  return mergeCrawled(bySource.get('apps4u') ?? [], bySource.get('mdnd') ?? []);
}

function loadBySource(base: string): { apps4u: CrawledEvent[]; mdnd: CrawledEvent[] } {
  const read = (name: string) =>
    existsSync(path.join(base, name)) ? getCrawlAdapter(name).load(path.join(base, name)) : [];
  return { apps4u: read('apps4u'), mdnd: read('mdnd') };
}

/** How much of the season mdnd holds and which apps4u rows it lacks. Reads the folder only. */
export function crawlCoverage(opts: { dir?: string; json?: boolean }): void {
  const { apps4u, mdnd } = loadBySource(opts.dir ?? DEFAULT_CRAWL_DIR);
  const report = coverageReport(apps4u, mdnd);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`mdnd: ${report.mdnd.total} events, ${report.mdnd.withPoster} with a poster`);
  for (const [month, m] of Object.entries(report.mdnd.byMonth).sort()) {
    console.log(`  ${month}: ${m.events} events, ${m.posters} posters`);
  }
  console.log(
    `apps4u: ${report.apps4u.total} rows, ${report.apps4u.covered} also on mdnd, ${report.apps4u.gaps} not on mdnd`
  );
  for (const [month, n] of Object.entries(report.apps4u.gapsByMonth).sort()) {
    console.log(`  ${month}: ${n} gaps`);
  }
}

/**
 * Runs the repo's poster extractor (`extractFromPoster`, the Gemini step behind "Upload poster"
 * in the web app) over each mdnd poster and saves the result under `mdnd/extractions/`. It is
 * the first half of `event.extractAndCreateDrafts` without the database half: no draft, no S3
 * upload, no artist or venue lookup. Needs GEMINI_API_KEY and sends the poster URL (a public
 * mdnd image) and a short listing hint to Google's API, so the owner runs it. Results are
 * cached; a rerun skips events already read.
 */
export async function crawlExtract(opts: {
  dir?: string;
  limit?: number;
  only?: string[];
  dryRun?: boolean;
}): Promise<void> {
  const base = opts.dir ?? DEFAULT_CRAWL_DIR;
  const dir = path.join(base, 'mdnd');
  const out = path.join(dir, 'extractions');
  const events = getCrawlAdapter('mdnd')
    .load(dir)
    .filter(e => e.posterUrl && (!opts.only || opts.only.includes(e.sourceId)));
  const todo = events.filter(e => !existsSync(path.join(out, `${e.sourceId}.json`)));
  const batch = opts.limit ? todo.slice(0, opts.limit) : todo;
  console.log(
    `${events.length} mdnd events with a poster; ${events.length - todo.length} already read; ${batch.length} to read`
  );
  if (opts.dryRun) {
    for (const e of batch) console.log(`  would read ${e.sourceId} ${e.posterUrl}`);
    return;
  }
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const { extractFromPoster } = await import('@rasika/core/domain/event/gemini');
  mkdirSync(out, { recursive: true });
  for (const e of batch) {
    try {
      const result = await extractFromPoster(
        e.posterUrl as string,
        mdndHint(e),
        'event listing from mdnd.in: title, date, time and venue as listed; the poster is the source for performers'
      );
      writeFileSync(path.join(out, `${e.sourceId}.json`), JSON.stringify(result, null, 2));
      console.log(
        `  ✅ ${e.sourceId} ${result.events.length} event(s), confidence ${result.confidence}`
      );
    } catch (error) {
      console.log(`  ❌ ${e.sourceId}: ${(error as Error).message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

type Core = typeof import('@rasika/core');

async function readStored(core: Core, from: Date): Promise<CrawlStoredData & { raw: unknown }> {
  const artists = await core.Artist.listAllArtistsForMatching();
  const venues: Array<{ id: string; name: string }> = [];
  let token: string | undefined;
  do {
    const page = await core.Venue.listVenues({ limit: 200, nextToken: token });
    venues.push(...page.items.map(v => ({ id: v.id, name: v.name })));
    token = page.nextToken;
  } while (token);
  const organisers: Array<{ id: string; name: string }> = [];
  token = undefined;
  do {
    const page = await core.Organiser.listOrganisers({ limit: 200, nextToken: token });
    organisers.push(...page.items.map(o => ({ id: o.id, name: o.name })));
    token = page.nextToken;
  } while (token);

  const events: StoredEventLite[] = (await core.Event.listAllUpcomingEvents(from)).map(e => ({
    id: e.id,
    title: e.title,
    startDateTime: e.startDateTime,
    venueId: e.venueId,
    venueName: e.venueName,
    status: 'approved',
  }));
  token = undefined;
  do {
    const page = await core.Event.listSubmittedEvents({ limit: 100, nextToken: token });
    for (const e of page.items) {
      events.push({
        id: e.id,
        title: e.title,
        startDateTime: e.startDateTime,
        venueId: e.venueId,
        venueName: e.venueName,
        status: 'submitted',
      });
    }
    token = page.nextToken;
  } while (token);

  return {
    artists: artists.map(a => ({ id: a.id, name: a.name, alternateNames: a.alternateNames })),
    venues,
    organisers,
    events,
    raw: null,
  };
}

export async function crawlMatch(opts: {
  dir?: string;
  sources?: string[];
  out?: string;
  /** Do not read the database. Every row is then "new" and held, and the manifest says so. */
  offline?: boolean;
}): Promise<void> {
  const base = opts.dir ?? DEFAULT_CRAWL_DIR;
  const events = loadCrawled(base, opts.sources);
  if (!events.length) throw new Error(`nothing to match in ${base}; run crawl-fetch first`);
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  let stored: CrawlStoredData = { artists: [], venues: [], organisers: [], events: [] };
  if (!opts.offline) {
    const core = await import('@rasika/core');
    console.log('📖 Reading stored artists, venues, organisers and events (read only)...');
    stored = await readStored(core, new Date(`${today}T00:00:00+05:30`));
    console.log(
      `📋 ${stored.artists.length} artists, ${stored.venues.length} venues, ${stored.organisers.length} organisers, ${stored.events.length} upcoming events`
    );
  }
  const entries = planCrawl(events, stored, today);
  if (opts.offline) {
    for (const e of entries) {
      e.decision = 'skip';
      e.skipReasons.unshift('not matched against the database (offline run); rerun crawl-match');
    }
  }
  const summary = summarizeCrawl(entries);
  const out = opts.out ?? path.join(base, 'crawl-manifest.json');
  const generatedAt = new Date().toISOString();
  const sources = [...new Set(events.map(e => e.source))];
  writeFileSync(
    out,
    JSON.stringify(
      {
        generatedAt,
        dryRun: true,
        matchedAgainstDatabase: !opts.offline,
        sources,
        summary,
        entries,
      },
      null,
      2
    )
  );
  const sheet = `${out.replace(/\.json$/, '')}.review.md`;
  writeFileSync(
    sheet,
    renderReviewSheet(entries, summary, { generatedAt, sources, offline: opts.offline })
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`✅ manifest ${out}\n✅ review sheet ${sheet}`);
}

interface AppliedEntry {
  key: string;
  eventId: string;
  createdVenueId?: string;
  createdOrganiserId?: string;
  createdArtistIds: string[];
  posterUrl?: string;
}

function previouslyApplied(manifest: string): Set<string> {
  const dir = path.dirname(manifest);
  const prefix = `${path.basename(manifest)}.applied-`;
  const keys = new Set<string>();
  for (const f of readdirSync(dir).filter(n => n.startsWith(prefix))) {
    const run = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    for (const e of run.applied ?? []) keys.add(e.key);
  }
  return keys;
}

export async function crawlApply(opts: {
  manifest: string;
  userId: string;
  dryRun?: boolean;
  only?: string[];
}): Promise<void> {
  const manifest = JSON.parse(readFileSync(opts.manifest, 'utf8')) as { entries: CrawlPlanEntry[] };
  const done = previouslyApplied(opts.manifest);
  const todo = manifest.entries.filter(
    e => e.decision === 'create' && !done.has(e.key) && (!opts.only || opts.only.includes(e.key))
  );
  console.log(`${todo.length} event(s) marked create; ${done.size} applied before`);
  if (opts.dryRun) {
    for (const e of todo) console.log(`  would create ${e.key} ${e.event.date} ${e.event.title}`);
    return;
  }

  const core = await import('@rasika/core');
  const { uploadPosterFromBuffer } = await import('@rasika/core/domain/event/s3');
  const candidates = await core.Artist.listAllArtistsForMatching();
  const applied: AppliedEntry[] = [];
  const failed: Array<{ key: string; error: string }> = [];
  const file = `${opts.manifest}.applied-${stamp()}.json`;
  const save = () => writeFileSync(file, JSON.stringify({ applied, failed }, null, 2));

  for (const entry of todo) {
    const e = entry.event;
    try {
      // Read again: the stored records may have changed since the dry run.
      let createdVenueId: string | undefined;
      let venue = await core.Venue.getVenueByName(e.venueName);
      if (!venue) {
        venue = await core.Venue.createVenue({ name: e.venueName, city: e.city } as never);
        createdVenueId = venue.id;
      }
      if (e.startDateTime) {
        const dup = await core.Event.findNearDuplicateEvents({
          venueId: venue.id,
          startDateTime: e.startDateTime,
        });
        if (dup.length) {
          failed.push({ key: entry.key, error: `duplicate appeared: ${dup[0].id}` });
          continue;
        }
      }
      let createdOrganiserId: string | undefined;
      let organiserId: string | undefined;
      if (e.organiser) {
        let organiser = await core.Organiser.getOrganiserByName(e.organiser);
        if (!organiser) {
          organiser = await core.Organiser.createOrganiser({ name: e.organiser } as never);
          createdOrganiserId = organiser.id;
        }
        organiserId = organiser.id;
      }
      const createdArtistIds: string[] = [];
      const artists = [];
      for (const p of entry.performers) {
        // A stored artist the dry run matched exactly is used by id. The repo's own finder
        // rejects spellings the crawl's name key accepts ("Delhi P. Sunder Rajan").
        const matched =
          p.match?.tier === 'exact' && p.match.id ? await core.Artist.getArtist(p.match.id) : null;
        const { artist, created } = matched
          ? { artist: matched, created: false }
          : await core.Artist.findOrCreateArtist(p.name, { candidates });
        if (created) {
          createdArtistIds.push(artist.id);
          candidates.push(artist);
        }
        artists.push({ id: artist.id, name: artist.name, role: p.role ?? p.kind });
      }
      let poster: { posterUrl: string; posterOgUrl: string; uploadId: string } | undefined;
      if (e.posterFile) {
        const buf = readFileSync(e.posterFile);
        const type = e.posterFile.endsWith('.png')
          ? 'image/png'
          : e.posterFile.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
        poster = await uploadPosterFromBuffer(buf, type);
      }
      const created = await core.Event.createEvent(
        {
          title: e.title,
          description: e.description,
          startDateTime: e.startDateTime as string,
          venueId: venue.id,
          venueName: venue.name,
          venueCity: e.city,
          ...(organiserId ? { organiserId, organiserName: e.organiser } : {}),
          artists,
          tags: [],
          entryType: e.entryType === 'free' ? 'free' : 'ticketed',
          ticketing: e.ticketUrl ? { url: e.ticketUrl } : undefined,
          ...(poster
            ? {
                posterUrl: poster.posterUrl,
                posterOgUrl: poster.posterOgUrl,
                posterUploadId: poster.uploadId,
              }
            : {}),
        } as never,
        opts.userId,
        { status: 'submitted' }
      );
      applied.push({
        key: entry.key,
        eventId: created.id,
        createdVenueId,
        createdOrganiserId,
        createdArtistIds,
        posterUrl: poster?.posterUrl,
      });
      console.log(`  ✅ ${entry.key} -> ${created.id}`);
    } catch (error) {
      failed.push({ key: entry.key, error: (error as Error).message });
      console.log(`  ❌ ${entry.key}: ${(error as Error).message}`);
    }
    save();
  }
  save();
  console.log(
    `done: ${applied.length} created (status submitted, for moderator approval), ${failed.length} failed\n${file}`
  );
}

export async function crawlUndo(opts: { manifest: string; dryRun?: boolean }): Promise<void> {
  const run = JSON.parse(readFileSync(opts.manifest, 'utf8')) as { applied: AppliedEntry[] };
  const core = await import('@rasika/core');
  for (const a of run.applied) {
    console.log(
      `${opts.dryRun ? 'would soft-delete' : 'soft-deleting'} event ${a.eventId} (${a.key})`
    );
    if (!opts.dryRun) await core.Event.softDeleteEvent(a.eventId);
  }
  const made = run.applied.flatMap(a => [
    ...(a.createdVenueId ? [`venue ${a.createdVenueId}`] : []),
    ...(a.createdOrganiserId ? [`organiser ${a.createdOrganiserId}`] : []),
    ...a.createdArtistIds.map(id => `artist ${id}`),
  ]);
  if (made.length)
    console.log(`Not removed (check by hand, merge or delete):\n  ${made.join('\n  ')}`);
}

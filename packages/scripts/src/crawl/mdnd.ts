import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  type CrawledEvent,
  type MdndEvent,
  type MdndListRow,
  type PosterExtractionLike,
  applyPosterExtraction,
  mdndMonthWindows,
  parseMdndEvents,
  parseMdndListRows,
  unionMdnd,
} from '@rasika/core/domain/event/crawl';
import { CrawlBlockedError, imageKind } from './fetcher.js';
import type { CrawlAdapter } from './types.js';

/**
 * mdnd.in event calendar for Chennai (city 3659, country 101). The page is a React app, so the
 * adapter reads the JSON its own front end loads from api.mdnd.in, the same public,
 * unauthenticated calls a browser makes (no login, token or captcha):
 *
 * - `events/get_todays_event`, flag 3: the next 30 days, full rows (artists, organiser).
 * - `events/get_events_by_filterdata`: one category and a date range, thin rows. It is paged
 *   month by month here, per category. A category is looked up once by asking for each id 1 to 30
 *   over the whole season; ids with no event are not paged.
 *
 * Posters are `api.mdnd.in/public/images/event_images/<name>`. `crawl-extract` saves what the
 * existing poster extractor read into `extractions/<sourceId>.json`; `load` applies it.
 */
const API = 'https://api.mdnd.in';
const CITY = { city_id: 3659, country_id: 101 };
const WINDOWS = [3];
const LISTING = (flag: number) => `listing-flag${flag}.json`;
const CATEGORY_IDS = Array.from({ length: 30 }, (_, i) => i + 1);
const DEFAULT_THROUGH = '2027-01-31';
const HEADERS = { 'x-client-type': '1' };

const todayIst = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

async function post(
  fetcher: Parameters<CrawlAdapter['fetch']>[1],
  route: string,
  json: unknown
): Promise<{ status: string; data?: unknown[]; message?: string }> {
  const body = await fetcher.get(`${API}/${route}`, { method: 'POST', json, headers: HEADERS });
  return JSON.parse(body.toString('utf8'));
}

export const mdnd: CrawlAdapter = {
  name: 'mdnd',
  async fetch(dir, fetcher, opts) {
    // The page itself first, so robots.txt for mdnd.in is checked before the API host.
    await fetcher.text('https://mdnd.in/events?ci=101&c=3659&te=&bw=Upcoming+Events&tab=calendar');
    for (const flag of WINDOWS) {
      const parsed = await post(fetcher, 'events/get_todays_event', { ...CITY, flag });
      if (parsed.status !== 'success') throw new Error(`mdnd flag ${flag}: ${parsed.message}`);
      writeFileSync(path.join(dir, LISTING(flag)), JSON.stringify(parsed));
    }

    const from = opts.from ?? todayIst();
    const through = opts.through ?? DEFAULT_THROUGH;
    const filter = (cat: number, a: string, b: string) =>
      post(fetcher, 'events/get_events_by_filterdata', {
        main_cat_id: cat,
        ...CITY,
        event_mode: 'All',
        from_date: a,
        to_date: b,
      });
    const live: number[] = [];
    for (const cat of CATEGORY_IDS) {
      const res = await filter(cat, from, through);
      if (res.status === 'success' && res.data?.length) live.push(cat);
    }
    console.log(`  mdnd categories with events: ${live.join(', ')}`);
    for (const w of mdndMonthWindows(from, through)) {
      let n = 0;
      for (const cat of live) {
        const res = await filter(cat, w.from, w.to);
        if (res.status !== 'success') throw new Error(`mdnd ${w.label} cat ${cat}: ${res.message}`);
        n += res.data?.length ?? 0;
        writeFileSync(path.join(dir, `month-${w.label}-cat${cat}.json`), JSON.stringify(res));
      }
      console.log(`  mdnd ${w.label}: ${n} rows`);
    }

    if (opts.noPosters) return;
    const postersDir = path.join(dir, 'posters');
    mkdirSync(postersDir, { recursive: true });
    for (const event of loadListing(dir)) {
      if (!event.posterUrl || event.posterFile) continue;
      try {
        const buf = await fetcher.get(event.posterUrl);
        const kind = imageKind(buf);
        if (!kind) {
          console.warn(`  ${event.sourceId}: not an image, skipped`);
          continue;
        }
        writeFileSync(path.join(postersDir, `${event.sourceId}.${kind}`), buf);
      } catch (error) {
        if (error instanceof CrawlBlockedError) throw error;
        console.warn(`  ${event.sourceId}: poster failed (${(error as Error).message})`);
      }
    }
  },
  load: loadListing,
};

function loadListing(dir: string): CrawledEvent[] {
  const full: CrawledEvent[] = [];
  for (const flag of WINDOWS) {
    const file = path.join(dir, LISTING(flag));
    if (!existsSync(file)) continue;
    full.push(...parseMdndEvents(JSON.parse(readFileSync(file, 'utf8')).data as MdndEvent[]));
  }
  const thin: CrawledEvent[] = [];
  for (const name of readdirSync(dir).sort()) {
    const m = /^month-\d{4}-\d{2}-cat(\d+)\.json$/.exec(name);
    if (!m) continue;
    const rows = JSON.parse(readFileSync(path.join(dir, name), 'utf8')).data as MdndListRow[];
    thin.push(...parseMdndListRows(rows ?? [], Number(m[1])));
  }
  if (!full.length && !thin.length)
    throw new Error(`no mdnd data in ${dir}; run crawl-fetch first`);
  const events = unionMdnd(full, thin);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    for (const ext of ['jpg', 'png', 'webp']) {
      const poster = path.join(dir, 'posters', `${e.sourceId}.${ext}`);
      if (existsSync(poster)) e.posterFile = poster;
    }
    const extracted = path.join(dir, 'extractions', `${e.sourceId}.json`);
    if (existsSync(extracted)) {
      events[i] = applyPosterExtraction(
        e,
        JSON.parse(readFileSync(extracted, 'utf8')) as PosterExtractionLike
      );
    }
  }
  return events;
}

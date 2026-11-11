import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  type CrawledEvent,
  type MdndEvent,
  parseMdndEvents,
} from '@rasika/core/domain/event/crawl';
import { CrawlBlockedError, imageKind } from './fetcher.js';
import type { CrawlAdapter } from './types.js';

/**
 * mdnd.in event calendar for Chennai (city 3659, country 101). The page is a React app, so the
 * adapter reads the JSON its own front end loads from api.mdnd.in (`get_todays_event`, the
 * "30 days" button: flag 3). That is the same public, unauthenticated call a browser makes; no
 * login, token or captcha is involved. The window is the next 30 days only. Posters are
 * `api.mdnd.in/public/images/event_images/<name>`.
 */
const API = 'https://api.mdnd.in';
const CITY = { city_id: 3659, country_id: 101 };
const WINDOWS = [3];
const LISTING = (flag: number) => `listing-flag${flag}.json`;

export const mdnd: CrawlAdapter = {
  name: 'mdnd',
  async fetch(dir, fetcher, opts) {
    // The page itself first, so robots.txt for mdnd.in is checked before the API host.
    await fetcher.text('https://mdnd.in/events?ci=101&c=3659&te=&bw=Upcoming+Events&tab=calendar');
    for (const flag of WINDOWS) {
      const body = await fetcher.get(`${API}/events/get_todays_event`, {
        method: 'POST',
        json: { ...CITY, flag },
        headers: { 'x-client-type': '1' },
      });
      const parsed = JSON.parse(body.toString('utf8'));
      if (parsed.status !== 'success') throw new Error(`mdnd flag ${flag}: ${parsed.message}`);
      writeFileSync(path.join(dir, LISTING(flag)), body);
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
  const byId = new Map<string, CrawledEvent>();
  for (const flag of WINDOWS) {
    const file = path.join(dir, LISTING(flag));
    if (!existsSync(file)) continue;
    const rows = JSON.parse(readFileSync(file, 'utf8')).data as MdndEvent[];
    for (const e of parseMdndEvents(rows)) byId.set(e.sourceId, e);
  }
  if (!byId.size) throw new Error(`no mdnd data in ${dir}; run crawl-fetch first`);
  for (const e of byId.values()) {
    for (const ext of ['jpg', 'png', 'webp']) {
      const poster = path.join(dir, 'posters', `${e.sourceId}.${ext}`);
      if (existsSync(poster)) e.posterFile = poster;
    }
  }
  return [...byId.values()];
}

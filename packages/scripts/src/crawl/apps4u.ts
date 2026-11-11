import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { type Apps4uRow, parseApps4uRows } from '@rasika/core/domain/event/crawl';
import type { CrawlAdapter } from './types.js';

/**
 * events.apps4u.net, "The Margazhi Guide": the Chennai season's concerts, one row each (date,
 * time, venue, type, artist, link). The page is empty HTML; it loads `<year>-data.json.gz`,
 * which is what this reads. Rows link to mdnd.in event pages, which the mdnd adapter joins.
 * There is no poster here.
 */
const ORIGIN = 'https://events.apps4u.net';

export const apps4u: CrawlAdapter = {
  name: 'apps4u',
  async fetch(dir, fetcher, opts) {
    const year = opts.year ?? 2026;
    // The home page is read first, as a person would arrive at it; it also proves the host is open.
    await fetcher.text(`${ORIGIN}/`);
    const gz = await fetcher.get(`${ORIGIN}/${year}-data.json.gz`);
    writeFileSync(path.join(dir, `${year}-data.json.gz`), gz);
  },
  load(dir) {
    const events = [];
    for (const year of [2026, 2027]) {
      const file = path.join(dir, `${year}-data.json.gz`);
      if (!existsSync(file)) continue;
      const rows = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as Apps4uRow[];
      events.push(...parseApps4uRows(rows));
    }
    if (!events.length) throw new Error(`no apps4u data in ${dir}; run crawl-fetch first`);
    return events;
  },
};

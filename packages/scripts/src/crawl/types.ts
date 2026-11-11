import type { CrawledEvent } from '@rasika/core/domain/event/crawl';
import type { Fetcher } from './fetcher.js';

/**
 * One event listing site. An adapter only knows how to fetch the site's pages, data and
 * posters (through the shared `Fetcher`, which owns robots.txt, pacing and the cache) and how
 * to read them into `CrawledEvent`s. Matching, review, apply and undo are shared
 * (`crawlEvents.ts`). To add a site, write an adapter and register it in `index.ts`.
 */
export interface CrawlAdapter {
  /** The `--source` value, and the folder name under the crawl directory. */
  name: string;
  /** Downloads into `dir` through `fetcher`. Posters go to `dir/posters/`. */
  fetch(dir: string, fetcher: Fetcher, opts: CrawlOptions): Promise<void>;
  /** Reads what `fetch` left in `dir`. No network. */
  load(dir: string): CrawledEvent[];
}

export interface CrawlOptions {
  /** apps4u publishes one file per season year. */
  year?: number;
  /** Skip poster downloads. */
  noPosters?: boolean;
}

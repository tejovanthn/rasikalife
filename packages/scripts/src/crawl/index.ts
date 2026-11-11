import { apps4u } from './apps4u.js';
import { mdnd } from './mdnd.js';
import type { CrawlAdapter } from './types.js';

export type { CrawlAdapter, CrawlOptions } from './types.js';

/** Every site the `crawl-*` commands know. Add an adapter here to crawl a new one. */
export const CRAWL_ADAPTERS: Record<string, CrawlAdapter> = {
  [apps4u.name]: apps4u,
  [mdnd.name]: mdnd,
};

export function getCrawlAdapter(name: string): CrawlAdapter {
  const adapter = CRAWL_ADAPTERS[name];
  if (!adapter) {
    throw new Error(`Unknown site "${name}". Known: ${Object.keys(CRAWL_ADAPTERS).join(', ')}`);
  }
  return adapter;
}

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseRobots,
  robotsAllows,
  robotsStatusVerdict,
} from '@rasika/core/domain/event/crawl-robots';
import type { RobotsRule } from '@rasika/core/domain/event/crawl-robots';

/**
 * The only way a crawl adapter touches the network. It checks robots.txt for each host before
 * the first request to it, waits at least `minIntervalMs` between network requests (cache hits
 * cost nothing), sends a generic User-Agent, and caches every response under `dir/_cache`.
 * What it saves is untrusted data: it is written to disk and parsed as text or JSON, never run.
 */

export const CRAWL_USER_AGENT = 'Mozilla/5.0 (compatible; EventResearchBot/1.0)';
export const MIN_INTERVAL_MS = 1100;
const MAX_BYTES = 12 * 1024 * 1024;

export class CrawlBlockedError extends Error {
  constructor(
    public readonly host: string,
    reason: string
  ) {
    super(`${host}: crawling not allowed (${reason}); stopped for this site`);
  }
}

export interface FetchOptions {
  method?: 'GET' | 'POST';
  /** JSON body for a POST. */
  json?: unknown;
  headers?: Record<string, string>;
}

export interface Fetcher {
  /** Bytes of the response, from the cache when it is there. Throws on a non-2xx status. */
  get(url: string, opts?: FetchOptions): Promise<Buffer>;
  text(url: string, opts?: FetchOptions): Promise<string>;
  /** Number of network requests made so far (cache hits excluded). */
  readonly requests: number;
  /** robots.txt status per host, for the report. */
  readonly robots: Record<string, string>;
}

export function createFetcher(dir: string, minIntervalMs = MIN_INTERVAL_MS): Fetcher {
  const cacheDir = path.join(dir, '_cache');
  mkdirSync(cacheDir, { recursive: true });
  const rules = new Map<string, RobotsRule[]>();
  const robots: Record<string, string> = {};
  let last = 0;
  let requests = 0;

  async function paced(url: string, init: RequestInit): Promise<Response> {
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    requests++;
    return fetch(url, {
      ...init,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': CRAWL_USER_AGENT, ...(init.headers as Record<string, string>) },
    });
  }

  async function checkRobots(target: URL): Promise<void> {
    if (!rules.has(target.host)) {
      const res = await paced(`${target.origin}/robots.txt`, {});
      const verdict = robotsStatusVerdict(res.status);
      if (verdict === 'stop') {
        robots[target.host] = `blocked: robots.txt returned ${res.status}`;
        throw new CrawlBlockedError(target.host, `robots.txt returned ${res.status}`);
      }
      const body = verdict === 'rules' ? (await res.text()).slice(0, 200_000) : '';
      if (verdict === 'rules') writeFileSync(path.join(dir, `robots-${target.host}.txt`), body);
      rules.set(target.host, parseRobots(body, CRAWL_USER_AGENT));
      robots[target.host] =
        verdict === 'rules'
          ? `robots.txt ${res.status}, ${rules.get(target.host)?.length ?? 0} rule(s)`
          : `robots.txt ${res.status} (none; nothing disallowed)`;
    }
    if (!robotsAllows(rules.get(target.host) ?? [], target.pathname + target.search)) {
      throw new CrawlBlockedError(target.host, `robots.txt disallows ${target.pathname}`);
    }
  }

  async function get(url: string, opts: FetchOptions = {}): Promise<Buffer> {
    const target = new URL(url);
    if (target.protocol !== 'https:') throw new Error(`only https is fetched: ${url}`);
    const key = createHash('sha256')
      .update(`${opts.method ?? 'GET'} ${url} ${JSON.stringify(opts.json ?? '')}`)
      .digest('hex')
      .slice(0, 32);
    const file = path.join(cacheDir, key);
    if (existsSync(file)) return readFileSync(file);

    await checkRobots(target);
    const res = await paced(url, {
      method: opts.method ?? 'GET',
      ...(opts.json !== undefined ? { body: JSON.stringify(opts.json) } : {}),
      headers: {
        ...(opts.json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
      },
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new CrawlBlockedError(target.host, `${res.status} on ${target.pathname}`);
    }
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error(`${url}: response over ${MAX_BYTES} bytes`);
    writeFileSync(file, buf);
    writeFileSync(
      `${file}.meta.json`,
      JSON.stringify({ url, status: res.status, type: res.headers.get('content-type') })
    );
    return buf;
  }

  return {
    get,
    text: async (url, opts) => (await get(url, opts)).toString('utf8'),
    get requests() {
      return requests;
    },
    get robots() {
      return robots;
    },
  };
}

/** Image kind from magic bytes. The server's content-type is not trusted. */
export function imageKind(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

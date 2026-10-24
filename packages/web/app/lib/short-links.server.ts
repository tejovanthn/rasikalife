import { client } from '~/api.server';

const ORIGIN = 'https://rasika.life';

/**
 * Short `rasika.life/l/<code>` links for full rasika.life URLs, keyed by the URL. The UTM tags
 * stay in the stored target, so the short link carries them. Any failure returns what it has,
 * possibly nothing: the text then prints the long links, which still work.
 */
export async function shortLinksFor(urls: string[]): Promise<Record<string, string>> {
  const paths = new Map<string, string>();
  for (const url of urls) {
    if (url.startsWith(`${ORIGIN}/`)) paths.set(url.slice(ORIGIN.length), url);
  }
  if (paths.size === 0) return {};
  try {
    const codes = await client.shortLink.ensure.mutate({ targets: [...paths.keys()] });
    const out: Record<string, string> = {};
    for (const [path, code] of Object.entries(codes)) {
      const url = paths.get(path);
      if (url) out[url] = `${ORIGIN}/l/${code}`;
    }
    return out;
  } catch (error) {
    console.error('Short links failed; printing full links', error);
    return {};
  }
}

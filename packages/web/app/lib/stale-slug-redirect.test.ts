import { describe, expect, it } from 'vitest';
import { slugKey, staleSlugRedirect } from './stale-slug-redirect';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateOrganiserUrl,
  generateRagaUrl,
  generateVenueUrl,
  parseSlug,
} from './url-slug';

const ID = '38avAHevxOrTy4Ne8Xn8VtlE1VK';
const ORIGIN = 'https://rasika.life';

function get(path: string, init?: RequestInit) {
  return new Request(`${ORIGIN}${path}`, init);
}

/** Follow redirects the way a client would; return the hops and the final path. */
function follow(path: string, canonicalPath: string, max = 5) {
  let current = path;
  const hops: string[] = [];
  for (let i = 0; i < max; i++) {
    const res = staleSlugRedirect(get(current), canonicalPath);
    if (!res) return { hops, final: current };
    expect(res.status).toBe(301);
    current = res.headers.get('Location') as string;
    hops.push(current);
  }
  throw new Error(`redirect loop from ${path}: ${hops.join(' -> ')}`);
}

describe('staleSlugRedirect', () => {
  const canonical = generateRagaUrl('kapi', ID);

  it('redirects an old Unicode slug to the canonical path', () => {
    const res = staleSlugRedirect(get(`/carnatic/ragas/k%C4%81pi-${ID}`), canonical);
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe(`/carnatic/ragas/kapi-${ID}`);
  });

  it('does not redirect the canonical path, however it is encoded or cased', () => {
    expect(staleSlugRedirect(get(canonical), canonical)).toBeNull();
    expect(staleSlugRedirect(get(`${canonical}/`), canonical)).toBeNull();
    const accented = generateRagaUrl('kāpi', ID);
    expect(staleSlugRedirect(get(accented.replace(/%C4%81/g, '%c4%81')), accented)).toBeNull();
    expect(staleSlugRedirect(get(`/carnatic/ragas/kāpi-${ID}`), accented)).toBeNull();
  });

  it('treats NFC and NFD spellings as one slug', () => {
    const nfd = generateRagaUrl('kāpi'.normalize('NFD'), ID);
    const nfc = generateRagaUrl('kāpi'.normalize('NFC'), ID);
    expect(nfd).not.toBe(nfc);
    expect(staleSlugRedirect(get(nfc), nfd)).toBeNull();
    expect(staleSlugRedirect(get(nfd), nfc)).toBeNull();
  });

  it('keeps the sub-path and the query string', () => {
    const res = staleSlugRedirect(
      get(`/carnatic/ragas/old-name-${ID}/compositions?nextToken=abc%3D&x=1`),
      canonical
    );
    expect(res?.headers.get('Location')).toBe(
      `/carnatic/ragas/kapi-${ID}/compositions?nextToken=abc%3D&x=1`
    );
  });

  it('drops only a trailing slash after the slug', () => {
    const res = staleSlugRedirect(get(`/carnatic/ragas/old-${ID}/`), canonical);
    expect(res?.headers.get('Location')).toBe(`/carnatic/ragas/kapi-${ID}`);
  });

  it('redirects an id-only URL', () => {
    const res = staleSlugRedirect(get(`/carnatic/ragas/${ID}`), canonical);
    expect(res?.headers.get('Location')).toBe(canonical);
  });

  it('never redirects a non-GET request', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(staleSlugRedirect(get(`/carnatic/ragas/old-${ID}`, { method }), canonical)).toBeNull();
    }
    expect(
      staleSlugRedirect(get(`/carnatic/ragas/old-${ID}`, { method: 'HEAD' }), canonical)
    ).not.toBeNull();
  });

  it('strips .data and _routes from a client data request', () => {
    const res = staleSlugRedirect(
      get(`/carnatic/ragas/old-${ID}.data?_routes=routes%2Fa%2Croutes%2Fb&q=1`),
      canonical
    );
    expect(res?.headers.get('Location')).toBe(`/carnatic/ragas/kapi-${ID}?q=1`);
    expect(staleSlugRedirect(get(`${canonical}.data?_routes=routes%2Fa`), canonical)).toBeNull();
  });

  it('returns null for a path outside the type, or a broken encoding', () => {
    expect(staleSlugRedirect(get(`/artists/old-${ID}`), canonical)).toBeNull();
    expect(staleSlugRedirect(get(`/carnatic/ragas/%E0%A4%A-${ID}`), canonical)).toBeNull();
  });

  it('asks caches to revalidate, so an undone rename cannot loop in a browser', () => {
    const res = staleSlugRedirect(get(`/carnatic/ragas/old-${ID}`), canonical);
    expect(res?.headers.get('Cache-Control')).toContain('max-age=0');
  });
});

describe('redirect target is a fixed point', () => {
  const names = [
    'kapi',
    'Kāpi',
    'kalyāṇi',
    'kāpi',
    'naada vindu kalaadi - click to listen (m s subbulakshmi)!',
    'A. D. A. Ranga Mandira',
    'M. A. Narasimhachar Music Foundation (R)',
    "o'brien ~ tilde, comma. dot",
    'star * plus + hash # query ? percent % amp & eq =',
    'slash / back\\slash',
    'İstanbul ǅ ß',
    '  spaced   out  ',
    'ends with data.data',
    '日本語 राग 🎵',
    '(((!!!)))',
    '',
  ];
  const builders = [
    generateRagaUrl,
    generateCompositionUrl,
    generateArtistUrl,
    generateOrganiserUrl,
    generateVenueUrl,
  ];

  for (const build of builders) {
    for (const name of names) {
      it(`${build.name}(${JSON.stringify(name)})`, () => {
        const canonicalPath = build(name, ID);
        // The canonical must parse back to the same id, or the route could not load it.
        expect(parseSlug(canonicalPath.split('/').pop() as string)?.id).toBe(ID);
        // Every way the same entity can be asked for.
        const prefix = canonicalPath.slice(0, canonicalPath.lastIndexOf('/') + 1);
        const asked = [
          `${prefix}${ID}`,
          `${prefix}other-name-${ID}`,
          `${prefix}${encodeURIComponent('Kāpi')}-${ID}`,
          `${prefix}${encodeURIComponent(name)}-${ID}`,
          `${prefix}${name.replace(/[ /\\?#%]/g, '-')}-${ID}`,
          `${canonicalPath}/compositions`,
          `${prefix}stale-${ID}/events?x=1`,
        ];
        for (const path of asked) {
          const { hops, final } = follow(path, canonicalPath);
          expect(hops.length).toBeLessThanOrEqual(1);
          // The final URL, decoded and in NFC, is the canonical (plus any sub-path).
          const finalSegment = final.slice(prefix.length).split(/[/?]/)[0];
          expect(slugKey(finalSegment)).toBe(slugKey(canonicalPath.slice(prefix.length)));
          // And the canonical path itself is a fixed point.
          expect(staleSlugRedirect(get(canonicalPath), canonicalPath)).toBeNull();
        }
      });
    }
  }
});

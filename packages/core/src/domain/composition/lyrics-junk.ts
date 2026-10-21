/**
 * Text inside the lyrics that is not part of the song, removed by rule.
 *
 * Readers may respell a word but never remove one (`checkRespelling`), so what the scrapers
 * left in the lyrics has to go by rule. Three kinds, each narrow on purpose:
 *
 * - **Site navigation** from carnatic-circle.com: "Go back to Pujopacharam", "click here for
 *   other purandara dasa songs", "Next song – …", a pointer to a YouTube video.
 * - **An ashtapadi index**: the site printed the list of all 24 ashtapadis under some of them.
 *   One `aShTapadI 7 - …` line can be a heading, so only a record holding five or more is an
 *   index.
 * - **A scraped page header**: karnatik.com pages open with `title.  rAgA: X.  Y tALA.`, and the
 *   import kept it as the first lyric line, sometimes with the pallavi run on after it. The
 *   header goes and the pallavi stays. A record holding **more than one** header is several
 *   songs in one record, where the headers are the only thing marking where each starts, so it
 *   is left alone and reported. So is a header naming a song other than the record's title:
 *   it is the only sign that the lyrics stored there are a different song. A standalone
 *   `(rAgA: kAmbhOji)` is not a header: in a ragamalika it says which raga a section is in,
 *   and it stays.
 */

export interface JunkRemoval {
  order: number;
  line: string;
  reason: 'navigation' | 'index' | 'header';
  /** What stays of the line, when the pallavi ran on after a header. */
  kept?: string;
}

const NAVIGATION = [
  /\bclick\s+here\b/i,
  /^\s*go\s+back\s+to\b/i,
  /^\s*next\s+song\b/i,
  // Only the pointer. "Some variations to the above song (YouTube song below)" heads a second
  // song in the same record, and removing it would join the two.
  /^\s*please\s+s(?:ee|i)\b.*\byoutube\b/i,
];

export function isNavigationLine(line: string): boolean {
  // Lines that came through the respelling rules carry `sO~Ng` and capitals; compare plainly.
  const plain = line.replace(/~N/g, 'n');
  return NAVIGATION.some(re => re.test(plain));
}

// `aShTapadI 7 -`, `Ashtapadhi 7-`, `ashtapadhi 7 -`: the site typed it several ways.
const INDEX_LINE = /^\s*ash?tapadh?i\s*\d+\s*-/i;
const INDEX_MIN = 5;

/** `Ashtapadi -24 (anyOnya anurraga sUchaka ala~Nkaaram) Shurutti / BEhag / Adi` */
const ASHTAPADI_HEADER = /^\s*ashtapadi\s*-\s*\d+\s*\(/i;

const RAGA_CLAUSE =
  /^(?:r[aA]g[aA]m?\s*:\s*[^.]*|r[aA]g[aA]?m[aA]l[iI]?k[aA]?|no\b[^.]*|[^.]*\bgiven\b[^.]*)\.\s*/i;
const TALA_CLAUSE =
  /^(?:t[aA]L[aA]m?\s*:\s*\S+(?: \S+)?(?=\s{2,}|\.|$)|[^.]{0,30}?\bt[aA]L[aA]m?)\.?\s*/;

/**
 * Splits a scraped karnatik.com header off a line. Returns `undefined` when the line is not one.
 * `rest` is whatever followed the header on the same line, already trimmed; `composer`, when it
 * matches a trailing name, is dropped from it.
 */
export function splitScrapedHeader(
  line: string,
  composer?: string
): { header: string; rest: string; name?: string } | undefined {
  if (ASHTAPADI_HEADER.test(line)) return { header: line.trim(), rest: '' };

  const name = /^([^.]{1,80}?)\.\s+(.*)$/.exec(line);
  if (!name?.[2]) return undefined;
  const afterName = name[2];
  const raga = RAGA_CLAUSE.exec(afterName);
  if (!raga) return undefined;
  let rest = afterName.slice(raga[0].length);
  // "no given rAgA or tALA" says both at once.
  if (!/t[aA]L[aA]/.test(raga[0])) {
    const tala = TALA_CLAUSE.exec(rest);
    if (!tala) return undefined;
    rest = rest.slice(tala[0].length);
  }
  rest = rest.trim();
  if (isAttribution(rest) || (composer && sameName(rest.replace(/\.$/, ''), composer))) rest = '';
  return { header: line.slice(0, line.length - rest.length).trim(), rest, name: name[1] };
}

/** `Papan2asham Shivan2.` — a short name closed by a full stop. A run-on pallavi has none. */
function isAttribution(rest: string): boolean {
  return /^[^.]{2,40}\.$/.test(rest) && rest.split(/\s+/).length <= 3;
}

/** Whether a header names this song: one title holds the other once spelling is ignored. */
export function headerNamesTitle(name: string, title: string): boolean {
  const strip = (s: string) => nameKey(s.replace(/\(.*?\)/g, ''));
  return sameName(strip(name), strip(title));
}

function nameKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/2/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/h/g, '');
}

function sameName(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  return ka.length > 0 && kb.length > 0 && (ka === kb || ka.includes(kb) || kb.includes(ka));
}

export interface JunkSection {
  order: number;
  text: string;
}

/**
 * The lyrics with junk removed, and a list of what went. A section left empty is dropped.
 * `headers` reports a record left alone because it holds several headers.
 */
export function removeLyricsJunk<T extends JunkSection>(
  lyrics: T[],
  opts: { composer?: string; title?: string } = {}
): { lyrics: T[]; removed: JunkRemoval[]; headers: number; otherSong?: string } {
  const removed: JunkRemoval[] = [];
  const lines = lyrics.flatMap(s => s.text.split('\n'));
  const isIndex = lines.filter(l => INDEX_LINE.test(l)).length >= INDEX_MIN;
  const found = lines.flatMap(l => splitScrapedHeader(l, opts.composer) ?? []);
  const headers = found.length;
  const named = found[0]?.name;
  const otherSong =
    headers === 1 && named && opts.title && !headerNamesTitle(named, opts.title)
      ? named
      : undefined;
  const stripHeader = headers === 1 && !otherSong;

  const out = lyrics
    .map(section => {
      const kept: string[] = [];
      for (const line of section.text.split('\n')) {
        if (isNavigationLine(line)) {
          removed.push({ order: section.order, line, reason: 'navigation' });
          continue;
        }
        if (isIndex && INDEX_LINE.test(line)) {
          removed.push({ order: section.order, line, reason: 'index' });
          continue;
        }
        const header = stripHeader ? splitScrapedHeader(line, opts.composer) : undefined;
        if (header) {
          removed.push({
            order: section.order,
            line,
            reason: 'header',
            ...(header.rest ? { kept: header.rest } : {}),
          });
          if (header.rest) kept.push(header.rest);
          continue;
        }
        kept.push(line);
      }
      return { ...section, text: kept.join('\n').trim() };
    })
    .filter(section => section.text.length > 0);

  return { lyrics: out, removed, headers, ...(otherSong ? { otherSong } : {}) };
}

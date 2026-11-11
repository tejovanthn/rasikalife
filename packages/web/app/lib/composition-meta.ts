/**
 * Title and meta description for a composition page, and for an artist's events page.
 *
 * Search Console (14 Oct to 11 Nov 2026): composition pages sit at positions 5 to 8 for
 * "<name> lyrics" with about 1.5% CTR, and searchers often add "in tamil" or "in telugu".
 * Lyrics are stored once, in ITRANS, and the page shows them in the viewer's chosen script
 * (see `DISPLAY_SCRIPTS`), so the description may name those scripts. It names "meaning"
 * only when the record holds one. Same rule as the other meta builders: claim only what
 * the page shows.
 */

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const BRAND = ' | Rasika.life';

/** Scripts the lyrics can be shown in. Kept in step with `DisplayScript`. */
const LYRICS_SCRIPTS = ['Roman', 'Devanagari', 'Tamil', 'Telugu', 'Kannada'];

function clamp(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[ ,;:.-]+$/, '')}…`;
}

export function compositionMeta(c: {
  title: string;
  composer: string;
  raga?: string | null;
  tala?: string | null;
  /** The language the composition is in, e.g. "Telugu". */
  language?: string | null;
  hasLyrics: boolean;
  hasMeaning?: boolean;
}): { title: string; description: string } {
  const head = `${c.title}${c.hasLyrics ? ' Lyrics' : ''} – ${c.composer}`;
  const ragaTail = c.raga ? `${c.raga} Raga` : 'Carnatic Composition';
  const talaTail = c.raga && c.tala ? `${c.raga} Raga, ${c.tala} Tala` : null;
  // Most detailed first. The first that fits wins; the composer is never dropped.
  const candidates = [
    talaTail && `${head} | ${talaTail}`,
    `${head} | ${ragaTail}`,
    `${head}${BRAND}`,
    head,
  ].filter((t): t is string => !!t);
  let title = candidates.find(t => t.length <= TITLE_MAX);
  if (!title) {
    // Even the bare head is too long: shorten the song title, never the composer.
    const tail = `${c.hasLyrics ? ' Lyrics' : ''} – ${c.composer}`;
    const room = Math.max(TITLE_MAX - tail.length, 8);
    title = `${clamp(c.title, room)}${tail}`;
  }

  const by = [`"${c.title}" by ${c.composer}`];
  if (c.raga) by.push(`in ${c.raga} raga`);
  if (c.tala) by.push(`${c.tala} tala`);
  const sentences = [`${by.join(', ')}.`];
  const lang = c.language ? `${c.language} ` : '';
  if (c.hasLyrics) {
    sentences.push(
      `${lang}lyrics in ${LYRICS_SCRIPTS.slice(0, -1).join(', ')} or ${LYRICS_SCRIPTS[LYRICS_SCRIPTS.length - 1]} script${c.hasMeaning ? ', with meaning' : ''}.`.replace(
        /^./,
        ch => ch.toUpperCase()
      )
    );
  } else if (c.language) {
    sentences.push(`${c.language} Carnatic composition.`);
  }
  let description = sentences[0];
  for (const s of sentences.slice(1)) {
    if (`${description} ${s}`.length > DESCRIPTION_MAX) break;
    description = `${description} ${s}`;
  }
  return { title, description: clamp(description) };
}

/**
 * Meta for `/artists/<slug>/events`. "Upcoming Concerts <year>" is claimed only when the
 * page lists upcoming events, and the year comes from the first of them, not the clock.
 */
export function artistEventsMeta(a: {
  name: string;
  /** Start date-times of upcoming events, any order. */
  upcomingDates: string[];
}): { title: string; description: string } {
  const dates = a.upcomingDates.filter(Boolean).sort();
  if (dates.length === 0) {
    return {
      title: `${a.name} Concerts and Events${BRAND}`,
      description: clamp(
        `Past concerts and events featuring ${a.name} in Indian classical music, with dates and venues.`
      ),
    };
  }
  const year = dates[0].slice(0, 4);
  const full = `${a.name} Upcoming Concerts ${year}${BRAND}`;
  const title = full.length <= TITLE_MAX ? full : `${a.name} Upcoming Concerts ${year}`;
  const n = dates.length;
  return {
    title: clamp(title, TITLE_MAX),
    description: clamp(
      `${n} upcoming ${n === 1 ? 'concert' : 'concerts'} featuring ${a.name} in ${year}, with dates and venues. Past concerts are listed too.`
    ),
  };
}

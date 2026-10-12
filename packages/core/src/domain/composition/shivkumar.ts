// Pure parsing for the shivkumar.org Carnatic lesson archive (Shivkumar Kalyanaraman):
// the krithi index (music/index.html), the varnam and geetham index
// (music/varnams/index.html), and the text of one lesson. No I/O here; the
// `shivkumar-*` CLI commands fetch and write. Kept in core so it can be tested.

export const SHIVKUMAR_INDEX_URLS = [
  'https://www.shivkumar.org/music/index.html',
  'https://www.shivkumar.org/music/varnams/index.html',
] as const;

export interface ShivkumarEntry {
  /** As printed on the index, e.g. "Abhayambikaya". */
  title: string;
  /** From a "(VARNAM)"-style tag: kriti unless the index says otherwise. */
  compositionType: 'kriti' | 'varnam' | 'other';
  raga?: string;
  tala?: string;
  composer?: string;
  /** Absolute URLs. */
  htmlUrl?: string;
  pdfUrl?: string;
  audioUrls: string[];
  videoUrls: string[];
}

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

const stripTags = (html: string): string =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

function resolveUrl(href: string, base: string): string | undefined {
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return undefined;
  }
}

/** Index lines that are about something other than one composition. */
const NOT_A_COMPOSITION =
  /different pitches|in mp3 format|varisai|alankar|practice lesson|gentle introduction|obituary|archive|blogs|vlogs|podcast|lessons on|site|page|links/i;

const TYPE_TAG = /\(([^)]*(?:varnam|geetham|swarajati)[^)]*)\)/i;

/**
 * Reads one index page into entries. An entry is an `<li>` whose bold heading reads
 * "Title: Raga; Tala; Composer; …" and which links a notation page or PDF on the site.
 * Drills (sarali, janta, alankaram) and links to other sites are skipped.
 */
export function parseShivkumarIndex(html: string, pageUrl: string): ShivkumarEntry[] {
  // The varnam page tags its geethams and swarajatis but not every varnam.
  const pageType = /varnams\//.test(pageUrl) ? 'varnam' : 'kriti';
  const entries: ShivkumarEntry[] = [];
  const seen = new Set<string>();
  const items = html.split(/<li[\s>]/i).slice(1);

  for (const raw of items) {
    const item = raw.split(/<\/ul>/i)[0] ?? '';
    const links = [...item.matchAll(/href\s*=\s*"([^"]+)"/gi)]
      .map(m => resolveUrl(m[1] ?? '', pageUrl))
      .filter((url): url is string => Boolean(url));
    const onSite = (url: string) => /^https?:\/\/(www\.)?shivkumar\.org\//i.test(url);
    const htmlUrl = links.find(
      url => onSite(url) && /\.html?$/i.test(url) && !/index\.html$|#/i.test(url)
    );
    const pdfUrl = links.find(url => onSite(url) && /\.pdf$/i.test(url));
    if (!htmlUrl && !pdfUrl) continue;

    const heading = headingOf(item);
    if (!heading || NOT_A_COMPOSITION.test(heading.split(':')[0] ?? '')) continue;
    const parsed = parseHeading(heading, pageType);
    if (!parsed) continue;

    // The index lists a few lessons twice, under two headings.
    const key = pdfUrl ?? htmlUrl ?? '';
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      ...parsed,
      htmlUrl,
      pdfUrl,
      audioUrls: unique(links.filter(url => onSite(url) && /\.(mp3|mp4|m4a)$/i.test(url))),
      videoUrls: unique(links.filter(url => /youtube\.com|youtu\.be/i.test(url))),
    });
  }
  return entries;
}

const isTala = (field?: string): boolean =>
  Boolean(
    field &&
      /\b(adi|ata|chapu|rupak\w*|triputa|jhampa|ekam|dhruva|matya|desadi|madhyadi)\b/i.test(field)
  );

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

/** The text of the entry up to its first notation link: the bold heading, in practice. */
function headingOf(item: string): string {
  const bold = stripTags(item.match(/<b>([\s\S]*?)<\/b>/i)?.[1] ?? '');
  const beforeNotation = stripTags(item.split(/Notation|\(HTML|\{\s*\(HTML/i)[0] ?? '');
  // On the varnam page the bold text is often the class link, not the heading.
  const usable = (text: string) => /[:;]/.test(text) && !/class|lesson|real audio/i.test(text);
  const text = usable(bold) ? bold : beforeNotation;
  return text.replace(/\s*Notation.*$/i, '').trim();
}

/**
 * "Abhayambikaya: Kedaragowla ; Khanda Chapu; Dikshitar ; Learnt From …"
 * "Chalamela (ATA TALA VARNAM) : Shankarabharanam ; Ata Talam: Swati Tirunal; (Notation …"
 * "Tharuni Ninnu Kambodhi ; Adi Talam: Violin Ponnuswamy; …" (no colon after the title)
 */
export function parseHeading(
  heading: string,
  pageType: 'kriti' | 'varnam' = 'kriti'
): Pick<ShivkumarEntry, 'title' | 'compositionType' | 'raga' | 'tala' | 'composer'> | null {
  const typeTag = heading.match(TYPE_TAG)?.[1]?.toLowerCase() ?? '';
  const compositionType: ShivkumarEntry['compositionType'] = typeTag.includes('varnam')
    ? 'varnam'
    : typeTag
      ? 'other'
      : pageType;
  // Asides in brackets ("(Notation courtesy: …)") hold colons of their own, and some
  // are never closed.
  const text = heading
    .replace(TYPE_TAG, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\(.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const colon = text.indexOf(':');
  const semi = text.indexOf(';');
  let title: string;
  let rest: string;
  if (colon !== -1 && (semi === -1 || colon < semi)) {
    title = text.slice(0, colon);
    rest = text.slice(colon + 1);
  } else if (semi !== -1) {
    // No colon after the title. Either `;` stands in for it ("Meru Samaana; Mayamalavagowlai
    // ; Adi") or the raga is the title's last word ("Tharuni Ninnu Kambodhi ; Adi Talam").
    const fields = text.split(';').map(field => field.trim());
    const head = fields[0] ?? '';
    if (isTala(fields[2])) {
      title = head;
      rest = fields.slice(1).join(';');
    } else if (isTala(fields[1]) && head.includes(' ')) {
      title = head.slice(0, head.lastIndexOf(' '));
      rest = `${head.slice(head.lastIndexOf(' ') + 1)};${fields.slice(1).join(';')}`;
    } else {
      return null;
    }
  } else {
    return null;
  }

  const parts = rest
    .split(/[;:]/)
    .map(part =>
      part
        .replace(/\.?\s*learnt\s+from.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .filter(part => !/^(learnt|notation|original|version|mp3|class|lesson)/i.test(part));

  title = title.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const [raga, tala, composer] = parts;
  return {
    title,
    compositionType,
    raga,
    tala: tala?.replace(/\s+tala(m)?$/i, '').trim() || undefined,
    composer: composer && !/^\d|^http/i.test(composer) ? composer : undefined,
  };
}

// ---------------------------------------------------------------------------
// One lesson

export interface ShivkumarLesson {
  /** Header fields as written: Ragam, Talam, Composer, Version and the rest. */
  header: Record<string, string>;
  /** URLs named in credit, detail and class lines of the header. */
  creditUrls: string[];
  /** The first block of Pallavi / Anupallavi / Charanam text, before any meaning. */
  lyrics: Array<{ type: string; order: number; text: string }>;
  /** Everything from the first section heading on: lyrics, meanings and the swaras. */
  body: string;
}

// Headings as the lessons write them: "Pallavi:", "caraNam 2", "Charanams", "svara-sAhitya".
const HEADING =
  '(pallavi|anu\\s*pallavi|c(?:h)?ara[nN]am(?:s)?|samashti\\s+c(?:h)?ara[nN]am|chitta\\s*swaram|cittasvaram|muktayi\\s+swaram|ettugada\\s+swarams?|madhyama\\s+kalam|s[vw]ara[\\s-]*s[aA]hith?y(?:a|am|as)?)';
const SECTION = new RegExp(`^\\s*${HEADING}\\s*\\d*\\s*[:.-]?\\s*$`, 'i');
const SECTION_WITH_TEXT = new RegExp(`^\\s*${HEADING}\\s*\\d*\\s*:\\s*(\\S.*)$`, 'i');
// A geetham's "Sahityam:" and a pasuram's "Paasuram (Stanza)" open a verse, but only alone on
// their line: in a krithi's notation, "Sahithya: <words>" captions a swara passage.
const VERSE_HEADING = /^\s*(sahith?yam?|pa+suram(\s*\(stanza\))?)\s*:?\s*$/i;
const END_OF_LYRICS = /^\s*(meaning|meanings|notes?|sahith?yam?|sahitya|word\s+meaning|gist)\b/i;
const CREDIT_KEY = /courtesy|details|class|lesson|mp3|source|notation|lyrics/i;

/**
 * Splits a lesson's text (from `pdftotext -layout`, or the HTML page with tags removed)
 * into its header, its lyrics and its body. Lines keep their spacing: in the swara
 * lines, the columns are what lines a note up under its syllable.
 */
export function parseShivkumarLesson(text: string): ShivkumarLesson {
  const lines = text
    .replace(/\f/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+$/, ''));

  const heading = lines.findIndex(
    line => SECTION.test(line) || SECTION_WITH_TEXT.test(line) || VERSE_HEADING.test(line)
  );
  // Pasurams and geethams have no Pallavi heading: their verse follows the header block.
  const first = heading !== -1 ? heading : headerEnd(lines);
  const headerLines = lines.slice(0, first);
  const bodyLines = lines.slice(first);

  const header: Record<string, string> = {};
  const creditUrls: string[] = [];
  for (const line of headerLines) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9 /]{1,40}?)\s*:\s*(.+)$/);
    if (!match?.[1] || !match[2]) continue;
    const key = match[1].trim();
    if (!(key in header)) header[key] = match[2].trim();
    if (CREDIT_KEY.test(key)) creditUrls.push(...urlsIn(match[2]));
  }

  return {
    header,
    creditUrls: unique(creditUrls),
    lyrics: heading !== -1 ? firstLyrics(bodyLines) : verseLyrics(bodyLines),
    body: tidyBody(bodyLines),
  };
}

const HEADER_KEY =
  /^\s*(ragam?|aro|ava|arohana|arohanam|avarohana|avarohanam|talam?|composer|version|details|.*courtesy|youtube.*|mp3.*|hindustani.*|https?)\s*:/i;

/** The line after the header block, which ends at the last header line near the top. */
function headerEnd(lines: string[]): number {
  let end = 0;
  for (const [i, line] of lines.slice(0, 40).entries()) {
    if (HEADER_KEY.test(line)) end = i + 1;
  }
  return end;
}

/** A heading-less verse, up to its meaning or its first swara line. */
function verseLyrics(lines: string[]): ShivkumarLesson['lyrics'] {
  const verse: string[] = [];
  for (const line of lines) {
    if (END_OF_LYRICS.test(line) || looksLikeSwaras(line)) break;
    verse.push(line.trim());
  }
  const text = verse
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text ? [{ type: 'lyrics', order: 1, text }] : [];
}

function urlsIn(text: string): string[] {
  const urls: string[] = [];
  for (const token of text.split(/[\s,()]+/)) {
    const clean = token.replace(/[.;]+$/, '');
    if (/^https?:\/\//i.test(clean)) urls.push(clean);
    else if (/^www\.[a-z0-9-]+\.[a-z]{2,}/i.test(clean)) urls.push(`https://${clean}`);
  }
  return urls;
}

function firstLyrics(lines: string[]): ShivkumarLesson['lyrics'] {
  const sections: ShivkumarLesson['lyrics'] = [];
  const seen = new Set<string>();
  let current: { type: string; lines: string[] } | null = null;

  const close = () => {
    if (!current) return;
    const text = current.lines
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text) sections.push({ type: current.type, order: sections.length + 1, text });
    current = null;
  };

  for (const line of lines) {
    if (VERSE_HEADING.test(line) && !seen.has('verse')) {
      seen.add('verse');
      close();
      current = { type: 'lyrics', lines: [] };
      continue;
    }
    if (END_OF_LYRICS.test(line)) break;
    const bare = line.match(SECTION);
    const inline = line.match(SECTION_WITH_TEXT);
    const name = (bare?.[1] ?? inline?.[1])?.toLowerCase().replace(/\s+/g, ' ');
    if (name) {
      // A heading seen twice means the notation has begun again from the pallavi.
      const key = `${name}${line.match(/\d+/)?.[0] ?? ''}`;
      if (seen.has(key)) break;
      seen.add(key);
      close();
      current = { type: sectionType(name), lines: inline?.[2] ? [inline[2]] : [] };
      continue;
    }
    if (looksLikeSwaras(line)) break;
    current?.lines.push(line);
  }
  close();
  return sections;
}

function sectionType(raw: string): string {
  const name = raw.replace(/\s+/g, ' ');
  if (name.startsWith('anu')) return 'anupallavi';
  if (name.startsWith('pallavi')) return 'pallavi';
  if (name.includes('chitta') || name.includes('citta')) return 'chittaswaram';
  if (name.startsWith('samashti')) return 'samashti charanam';
  if (/^c(h)?aranam/.test(name)) return 'charanam';
  if (/^s[vw]ara/.test(name)) return 'swara sahityam';
  return name;
}

/** A line of notation: mostly swara letters, with a `||` or `|` bar. */
export function looksLikeSwaras(line: string): boolean {
  if (!/\|/.test(line)) return false;
  const words = line
    .replace(/[|,;\-–]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  const swara = words.filter(word => /^[srgmpdnSRGMPDN][srgmpdnSRGMPDN123]*$/.test(word));
  return swara.length / words.length >= 0.6;
}

function tidyBody(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * A lesson page as text, for the few with no PDF. Word's HTML export wraps lines at
 * random, so swara columns do not survive this; the PDF is always preferred.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|xml|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<\/(p|tr|div|h\d|li)>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The ARO line of a lesson header, as one string of swaras. */
export function lessonArohanam(lesson: ShivkumarLesson): string | undefined {
  const value = lesson.header.ARO ?? lesson.header.Arohanam ?? lesson.header.Aro;
  return value?.replace(/\|/g, '').trim() || undefined;
}

/** The AVA line of a lesson header. */
export function lessonAvarohanam(lesson: ShivkumarLesson): string | undefined {
  const value = lesson.header.AVA ?? lesson.header.Avarohanam ?? lesson.header.Ava;
  return value?.replace(/\|/g, '').trim() || undefined;
}

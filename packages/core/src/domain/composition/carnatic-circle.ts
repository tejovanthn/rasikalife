// Pure parsing for carnatic-circle.com, a Midlands (UK) bhajan and Carnatic music group.
// The site is WordPress, and its pages come whole from the REST API
// (`/wp-json/wp/v2/pages`). Each song is one page, typed in by hand: the raga, tala and
// composer may sit in the title, in a header line, in a sentence, or nowhere, and the
// spelling may be ITRANS, ISO/IAST or plain English. So every field here is a reading a
// person checks in the review CSV, never a fact on its own. No I/O here.

import Sanscript from '@indic-transliteration/sanscript';
import { isEnglishLine, isSwaraLine } from './lyrics-normalize';
import { canonicalTala } from './match';
import { htmlToText } from './shivkumar';

export const CARNATIC_CIRCLE_API = 'https://carnatic-circle.com/wp-json/wp/v2/pages';

/** A page as the REST API returns it, reduced to what is read here. */
export interface WpPage {
  id: number;
  parent: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
}

export interface CarnaticCircleSong {
  url: string;
  title: string;
  raga?: string;
  /** Set when the page names more than one raga: then `raga` is left blank. */
  ragaOptions?: string[];
  tala?: string;
  composer?: string;
  scale?: { arohanam?: string; avarohanam?: string };
  lyrics: Array<{ type: string; order: number; text: string }>;
  /** `itrans` when the page was ITRANS or was converted from ISO/IAST; `plain` otherwise. */
  romanisation: 'itrans' | 'plain';
  /** The page's place on the site, e.g. "Guru Dhyanam / Annamacharya". */
  collection: string;
  notes: string[];
}

// Parts of the site that are not songs: tabla, theory, drills, event write-ups.
const EXCLUDED_PATHS = [
  /^\/tabla-lessonsnotes\//,
  /^\/carnatic-lessonsnotes\/(music-theory|varisais|daily-shlokasprayers)\//,
  /sita-rama-or-radha-madhava-kalyanam-activities/,
];
const NOT_A_SONG_SLUG =
  /\d{4}|\d+(st|nd|rd|th)-|quiz|tabla|bol-|-gat-|classes|lessons|enroll|donations|gallery|blogs|musicians|^grid$|^aikya$|^temple$|elementor|google|significance|dushyanth|stokebhajan|mahotsav|introduction-to|^bhajan-|songs(-|$)|^\d+-\d+$/;
const NOT_A_SONG_TEXT = /^(this is a placeholder|below are the)/i;
const NOT_A_SONG_TITLE =
  /\bslok(a|am)s?\b|^weekly\b|^what is\b|uk-wide|mantra pushpam|namaskarams|ugabhogas/i;

const slugOf = (link: string) => new URL(link).pathname.replace(/\/$/, '').split('/').pop() ?? '';

/** Leaf pages that hold a song: index pages, tabla, theory and event write-ups are dropped. */
export function selectSongPages(pages: WpPage[]): WpPage[] {
  const parents = new Set(pages.map(page => page.parent));
  return pages.filter(page => {
    if (parents.has(page.id)) return false;
    const path = new URL(page.link).pathname;
    if (path === '/' || EXCLUDED_PATHS.some(rule => rule.test(path))) return false;
    if (NOT_A_SONG_SLUG.test(decodeURIComponent(slugOf(page.link)))) return false;
    if (NOT_A_SONG_TITLE.test(decode(page.title.rendered))) return false;
    const text = pageLines(page.content.rendered).join(' ');
    return text.length >= 60 && !NOT_A_SONG_TEXT.test(text);
  });
}

/**
 * Who composed a whole collection, where the collection is one composer's songs. Other
 * collections ("Guru Dhyanam / Bodhendra") are songs *about* a guru, and name nobody.
 * A composer the page itself names wins over this.
 */
const COLLECTION_COMPOSERS: Record<string, string> = {
  'narayana-theertha-tarangini': 'Narayana Tirtha',
  'purandaradasa-krithigalu': 'Purandara Dasa',
  'mahakavi-oothukadu-venkatasubbiar': 'Oottukkadu Venkata Kavi',
  'sri-bhadrachala-ramdas': 'Bhadrachala Ramadas',
  'thyagaraja-krithis': 'Tyagaraja',
  annamacharya: 'Annamacharya',
  'sadhashiva-brahmendra': 'Sadasiva Brahmendra',
  'gopalakrishna-bharathi': 'Gopalakrishna Bharathi',
  'jayadeva-ashtapadhi': 'Jayadeva',
};

const decode = (text: string) => htmlToText(text).replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** The page as lines, a blank line between paragraphs; the breadcrumb and audio links dropped. */
function pageLines(html: string): string[] {
  return htmlToText(html)
    .replace(/[​­]/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(
      line => !/^Home\s*>|^(link (to|for) (the )?audio|audio file|english|sanskrit)$/i.test(line)
    );
}

const COMBINING = /\p{M}/gu;
const stripMarks = (text: string) => text.normalize('NFKD').replace(COMBINING, '').normalize('NFC');

// "Ragam :", "raagam:", "rAgA :", "Raga –", "Raag", and in ISO "rāgam" once marks are gone.
const RAGA_KEY = /\b(?:ra+ga?m?|raag)\b/i;
// "Talam", "taaLam", "tALA", "Thalam", "Taal", "tāḷam".
const TALA_KEY = /\b(?:th?a+[lL]a?m?|ta+l)\b/i;
const SEPARATOR = /^\s*[:\-–]/;

/** One raga or several, and a tala, from a value such as "thodi / adi" or "Shakarabharanam, Jampa". */
function splitRagaValue(value: string): { ragas: string[]; tala?: string } {
  const parts = value
    .split(/[/,|]|\s+or\s+|\.\s/)
    .map(part => part.replace(/[.()]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const ragas: string[] = [];
  let tala: string | undefined;
  for (const part of parts) {
    if (canonicalTala(part) || /laghu/i.test(part)) {
      tala ||= part.replace(TALA_KEY, '').trim() || part;
    } else if (part.length >= 3 && !/^\d|janya|^in\b/i.test(part)) {
      ragas.push(part.replace(/\s+ragam?$/i, ''));
    }
  }
  return { ragas, tala };
}

interface Header {
  ragas: string[];
  tala?: string;
  composer?: string;
  arohanam?: string;
  avarohanam?: string;
}

/**
 * Reads one header line into `header`. Returns true when the line was header and not
 * lyrics. Mid-line keywords count only with a separator ("Paahi madana gopaala Ragam : thodi
 * / adi"), so a lyric that happens to hold the word "raga" stays a lyric.
 */
function readHeaderLine(raw: string, header: Header): boolean {
  const line = stripMarks(raw.replace(/l̤/g, 'L'));
  // "Raga: Yaman F || Tala: Ekam || Composer: Eknath Maharaj", "raag : Hamir Kalyan
  // Composer: Udhdhava Chithganar": several fields on one line are read one at a time.
  const fields = line.split(/\s*\|\|\s*|\s+(?=(?:composer|language)\s*:)/i);
  if (fields.length > 1 && fields.every(Boolean)) {
    const read = fields.map(field => readHeaderLine(field, header));
    return read.some(Boolean);
  }

  const scale = line.match(/^(aa|av|aro\w*|ava\w*)\s*:\s*(.+)$/i);
  if (scale?.[1] && scale[2]) {
    if (/^(aa|aro)/i.test(scale[1])) header.arohanam = scale[2].trim();
    else header.avarohanam = scale[2].trim();
    return true;
  }
  if (/^\d+\s+[\w ,.'-]+\bjanya$/i.test(line) || /^(language|version)\s*:/i.test(line)) return true;

  const composer = line.match(
    /^(?:composer|composed by|composition by|written by)\s*(?:[:\-–]\s*)?(?:by\s+|[-–]\s*)?(.+)$/i
  );
  if (composer?.[1]) {
    let name = composer[1];
    const inRaga = name.match(/^(.+?)\s+in\s+(.+?)(?:\s+ragam?\b.*)?$/i);
    if (inRaga?.[1] && inRaga[2]) {
      name = inRaga[1];
      if (header.ragas.length === 0) header.ragas = splitRagaValue(inRaga[2]).ragas;
    }
    const cut = name.split(RAGA_KEY)[0] ?? name;
    header.composer ||= cut.replace(/[.,:;]+\s*$/, '').trim();
    return true;
  }

  // "Hameer Kalyani ragam in Adi talam".
  const sentence = line.match(/^(.+?)\s+ra+ga?m?\s+in\s+(.+?)\s+ta+la?m?\.?$/i);
  if (sentence?.[1] && sentence[2]) {
    if (header.ragas.length === 0) header.ragas = [sentence[1].trim()];
    header.tala ||= sentence[2].trim();
    return true;
  }

  const ragaAt = line.search(RAGA_KEY);
  if (ragaAt !== -1) {
    const key = line.slice(ragaAt).match(RAGA_KEY)?.[0] ?? '';
    const after = line.slice(ragaAt + key.length);
    if (ragaAt === 0 || /^\(/.test(line.slice(ragaAt - 1)) || SEPARATOR.test(after)) {
      const rest = after.replace(SEPARATOR, '').trim();
      const talaAt = rest.search(TALA_KEY);
      const ragaPart = talaAt === -1 ? rest : rest.slice(0, talaAt);
      const split = splitRagaValue(ragaPart);
      if (split.ragas.length > 0 && header.ragas.length === 0) header.ragas = split.ragas;
      if (split.tala) header.tala ||= split.tala;
      if (talaAt !== -1) readTala(rest.slice(talaAt), header);
      return split.ragas.length > 0 || Boolean(header.tala);
    }
  }
  if (TALA_KEY.test(line) && /^\W*th?a+[lL]a?m?\b|^\W*ta+l\b/i.test(line)) {
    readTala(line, header);
    return true;
  }
  return false;
}

function readTala(text: string, header: Header) {
  const value = text
    .replace(TALA_KEY, '')
    .replace(SEPARATOR, '')
    .replace(/[)(]/g, '')
    .split(/[.,]/)[0]
    ?.trim();
  if (value && !header.tala) header.tala = value;
}

// Section headings: "Pallavi", "anupallavi:", "Charanam 2", and the short forms "P", "AP",
// "A", "C 1" that need a colon, a tab-like gap or a line of their own.
const SECTION = /^(pallavi|anu\s*pallavi|c(?:h)?ara[nN]am(?:s)?)\s*\d*\s*[:.\-–]?\s*(.*)$/i;
const SHORT_SECTION = /^(AP|P|A|C)\s*\d*\s*(?:[:.]\s*(.*)|$)/;
const SLOKA = /^(s|sh)lo(ka|kam)\b/i;

function sectionOf(line: string): { type: string; rest: string } | null {
  const long = line.match(SECTION);
  if (long?.[1]) return { type: sectionType(long[1]), rest: long[2] ?? '' };
  const short = line.match(SHORT_SECTION);
  if (short?.[1]) {
    const type = { P: 'pallavi', AP: 'anupallavi', A: 'anupallavi', C: 'charanam' }[short[1]];
    return type ? { type, rest: short[2] ?? '' } : null;
  }
  // "P\tmangaLAlaya …": the tab is a space by now, so a lone capital then a lyric.
  const spaced = line.match(/^(AP|P|C\s*\d*)\s+(\S.*)$/);
  if (spaced?.[1] && /^\S+\s/.test(spaced[2] ?? '')) {
    return {
      type: spaced[1].startsWith('C') ? 'charanam' : spaced[1] === 'AP' ? 'anupallavi' : 'pallavi',
      rest: spaced[2] ?? '',
    };
  }
  return null;
}

function sectionType(name: string): string {
  const lower = name.toLowerCase().replace(/\s+/g, '');
  if (lower.startsWith('anu')) return 'anupallavi';
  if (lower.startsWith('pallavi')) return 'pallavi';
  return 'charanam';
}

/** The song's title from the page title: entities decoded, "– raga – tala" taken off. */
export function parseTitle(rendered: string): { title: string; raga?: string; tala?: string } {
  const title = decode(rendered).replace(/\s+raga(m)?$/i, '');
  const parts = title.split(/\s+[–-]\s+/);
  if (parts.length === 3 && parts[0] && parts[1] && canonicalTala(parts[2])) {
    return { title: parts[0], raga: parts[1], tala: parts[2] };
  }
  return { title };
}

const ISO_LETTERS = /[āīūṛṝḷēōṅñṇṭḍśṣṁṃḥḻṟṉ]/i;

/**
 * How a text is spelled. ISO/IAST is converted to ITRANS (`ṉ` arrives as `n2`, our Tamil
 * convention). Capitals inside words (`mangaLAlaya`, `gOvinda`) mean ITRANS already. Anything
 * else is plain English romanisation, which the import lowercases for a new record.
 */
export function readRomanisation(text: string): 'iso' | 'itrans' | 'plain' {
  if (ISO_LETTERS.test(text.normalize('NFC'))) return 'iso';
  const inWordCapitals = text.match(/[a-z][A-Z]/g)?.length ?? 0;
  return inWordCapitals >= 3 ? 'itrans' : 'plain';
}

export function isoToItrans(text: string): string {
  // The pages mix IAST into ISO: IAST's ṛ and ṃ are ISO's r̥ and ṁ, and ISO's own ṛ is ड़.
  const iso = text
    .normalize('NFC')
    .replace(/l̤/g, 'L')
    .replace(/ṝ/g, 'r̥̄')
    .replace(/ṛ/g, 'r̥')
    .replace(/ṃ/g, 'ṁ')
    .normalize('NFC');
  return Sanscript.t(iso, 'iso', 'itrans_dravidian');
}

/** Reads one song page. Returns null when nothing on it reads as lyrics. */
export function parseSongPage(page: WpPage, ancestors: WpPage[]): CarnaticCircleSong | null {
  const fromTitle = parseTitle(page.title.rendered);
  const lines = pageLines(page.content.rendered);
  const header: Header = { ragas: fromTitle.raga ? [fromTitle.raga] : [] };
  if (fromTitle.tala) header.tala = fromTitle.tala;
  const notes: string[] = [];

  // Header lines, in the first stretch of the page. The lyrics begin after the last of
  // them, which drops a slokam or an introduction printed above the song's own header.
  const isHeader = new Set<number>();
  for (const [i, line] of lines.slice(0, 25).entries()) {
    if (readHeaderLine(line, header)) isHeader.add(i);
    // "sAvEri – aTa": a raga and a tala on a line of their own.
    const pair = stripMarks(line).match(/^([A-Za-z ]{3,25}?)\s*[–-]\s*([A-Za-z ]{2,15})$/);
    if (pair?.[1] && pair[2] && canonicalTala(pair[2]) && !SECTION.test(line)) {
      if (header.ragas.length === 0) header.ragas = [pair[1].trim()];
      header.tala ||= pair[2].trim();
      isHeader.add(i);
    }
  }
  const lastHeader = Math.max(-1, ...isHeader);
  const titleKey = fold(fromTitle.title);
  // A page often repeats its title as the first line; under a heading it is the lyric.
  const body = lines.slice(lastHeader + 1);
  const first = body.findIndex(line => line !== '');
  if (first !== -1 && fold(body[first] ?? '') === titleKey) body.splice(first, 1);

  const lyrics = readLyrics(body);
  if (lyrics.length === 0) return null;
  if (lines.some(line => /^song\s*\d/i.test(line))) notes.push('page holds more than one song');

  const collectionSlugs = ancestors.map(a => slugOf(a.link));
  const collectionComposer = collectionSlugs.map(slug => COLLECTION_COMPOSERS[slug]).find(Boolean);
  const ragas = [...new Set(header.ragas.map(r => stripMarks(r).trim()).filter(Boolean))];
  if (ragas.length > 1) notes.push(`ragas: ${ragas.join(' / ')}`);

  const text = lyrics.map(section => section.text).join('\n');
  const spelling = readRomanisation(`${fromTitle.title}\n${text}`);
  const toStored = (value: string) => (spelling === 'iso' ? isoToItrans(value) : value);

  return {
    url: page.link.replace(/^http:/, 'https:'),
    title: toStored(fromTitle.title),
    raga: ragas.length === 1 ? ragas[0] : undefined,
    ragaOptions: ragas.length > 1 ? ragas : undefined,
    tala: header.tala ? stripMarks(header.tala) : undefined,
    composer: header.composer ? stripMarks(header.composer) : collectionComposer,
    scale:
      header.arohanam || header.avarohanam
        ? { arohanam: header.arohanam, avarohanam: header.avarohanam }
        : undefined,
    lyrics: lyrics.map(section => ({ ...section, text: toStored(section.text) })),
    romanisation: spelling === 'plain' ? 'plain' : 'itrans',
    collection: ancestors.map(a => decode(a.title.rendered)).join(' / '),
    notes,
  };
}

const fold = (text: string) =>
  stripMarks(text)
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/**
 * The lyrics: split at section headings when the page has them, else one verse. English
 * lines (meanings, notes on the singing) and a slokam above the song are left out; the
 * page link carries them.
 */
function readLyrics(lines: string[]): CarnaticCircleSong['lyrics'] {
  const hasSections = lines.some(line => sectionOf(line));
  const sections: Array<{ type: string; lines: string[] }> = [];
  let current: { type: string; lines: string[] } | null = hasSections
    ? null
    : { type: 'lyrics', lines: [] };
  let inSloka = false;

  for (const line of lines) {
    if (/^(word\s+)?meanings?\s*:?$/i.test(line)) break;
    if (SLOKA.test(line)) {
      inSloka = true;
      continue;
    }
    const section = sectionOf(line);
    if (section) {
      inSloka = false;
      if (current) sections.push(current);
      current = { type: section.type, lines: section.rest ? [section.rest] : [] };
      continue;
    }
    if (inSloka) {
      if (line === '') inSloka = false;
      continue;
    }
    if (!current || isEnglishLine(line) || isSwaraLine(line) || /^(video|https?:)/i.test(line)) {
      continue;
    }
    current.lines.push(line);
  }
  if (current) sections.push(current);

  return sections
    .map(section => ({
      type: section.type,
      text: section.lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    }))
    .filter(section => section.text)
    .map((section, i) => ({ ...section, order: i + 1 }));
}

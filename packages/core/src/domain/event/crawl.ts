import { artistNameSimilarity, normalizeArtistName } from '../artist/dedup';
import {
  type NameComparison,
  clusterArtistNames,
  compareArtistNames,
  foldToken,
  pickDisplayName,
} from './crawl-names';
import { DUPLICATE_WINDOW_HOURS } from './duplicates';

/**
 * Event listing sites ("crawl" sources), read into one shape, matched to stored records and
 * written as a dry-run manifest. Pure and browser-safe: the adapters in
 * `packages/scripts/src/crawl/` only fetch and cache; every decision is here and is tested.
 *
 * A crawled event is never written on its own. The manifest is reviewed, and `crawl-apply`
 * creates only the rows whose `decision` is `create`.
 */

export const CRAWL_OFFSET = '+05:30';

export interface CrawledPerformer {
  /** As the person is named once the instrument and role are removed. */
  name: string;
  /** Instrument or role as the source writes it ("Violin", "Mridangam", "Speaker"). */
  role?: string;
  /** `main` for the billed artist, `accompanist` for the supporting players. */
  kind: 'main' | 'accompanist';
  /** Other spellings of this person seen in the crawl (another source, another event). */
  variants?: string[];
}

/** A listing from another source that is the same concert, folded into this row. */
export interface MergedListing {
  /** `source:sourceId`, as a manifest key. */
  key: string;
  source: string;
  url: string;
  title: string;
  /** `id` = the mdnd event id in the link; `slot` = same day, time, venue or artists. */
  by: 'id' | 'slot';
}

export interface CrawledEvent {
  /** The adapter that read it, and the id that source gives it. Unique as `source:sourceId`. */
  source: string;
  sourceId: string;
  /** The page a person opens to see the event. Also the ticket or registration link. */
  sourceUrl: string;
  /** Other sources that listed the same event (apps4u lists what mdnd sells). */
  alsoListedBy: string[];
  /** The other listings merged into this row. The manifest keeps their URLs. */
  mergedWith?: MergedListing[];
  title: string;
  /** `YYYY-MM-DD` and 24-hour `HH:mm`, as printed, in the event's own zone (IST). */
  date: string;
  time: string | null;
  startDateTime: string | null;
  venueName: string;
  venueRaw: string;
  city: string;
  performers: CrawledPerformer[];
  organiser?: string;
  ticketUrl?: string;
  entryType?: 'free' | 'ticketed';
  category?: string;
  description?: string;
  posterUrl?: string;
  /** Set by the adapter once the poster is on disk. */
  posterFile?: string;
}

// ---------------------------------------------------------------------------
// Reading dates, times and names

/** "6:15 pm", "4:30 PM", "10 AM" -> "18:15". Null when it is not a clock time. */
export function parseClock(raw: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*$/i.exec(raw ?? '');
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? '0');
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (m[3].toLowerCase() === 'p' && hour !== 12) hour += 12;
  if (m[3].toLowerCase() === 'a' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** apps4u prints "2026-12-25 Wed" and, once, "2027-1-1 Fri". */
export function parseApps4uDate(raw: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw.trim());
  if (!m) return null;
  return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** mdnd prints "25-12-2026". */
export function parseMdndDate(raw: string): string | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  return ymd(Number(m[3]), Number(m[2]), Number(m[1]));
}

function ymd(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Date and clock to an ISO instant in IST. These sites list Chennai events only. */
export function toStartDateTime(date: string, time: string | null): string | null {
  if (!time) return null;
  return `${date}T${time}:00${CRAWL_OFFSET}`;
}

const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

/** Visible text of the HTML an organiser typed into a rich-text box. Nothing is executed. */
export const htmlToText = stripTags;

const CITY_WORDS = new Set([
  'chennai',
  'madras',
  'tamil',
  'nadu',
  'india',
  'mylapore',
  'nagar',
  'royapettah',
  'adyar',
  'alwarpet',
  'nungambakkam',
  'vadapalani',
  'kodambakkam',
]);

/**
 * "Ragasudha Hall, Chennai" -> { name: "Ragasudha Hall", city: "Chennai" }. The name is what
 * comes before the first comma; the sources put the locality after it. A full street address
 * ("Vani Mahal, 103, Gopathy Narayana Rd, ...") also reduces to the first part. All the
 * sources here list Chennai, so the city is `fallbackCity` unless the text names another.
 */
export function splitVenue(
  raw: string,
  fallbackCity = 'Chennai'
): { name: string; city: string; raw: string } {
  const cleaned = raw.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
  const [first, ...rest] = cleaned.split(',').map(p => p.trim());
  let name = first ?? '';
  // "Name.( MINI HALL )  T.NAGAR.Chennai" style: drop a trailing locality run after a dot.
  name = name.replace(/\.\s*$/, '').trim();
  const city = /bengaluru|bangalore/i.test(cleaned)
    ? 'Bengaluru'
    : /chennai|madras/i.test(cleaned) || rest.length === 0
      ? fallbackCity
      : fallbackCity;
  return { name, city, raw: cleaned };
}

/** Comparison key for a venue or organiser: lowercase letters and digits, locality removed. */
export function placeKey(raw: string): string {
  const base = splitVenue(raw).name.toLowerCase().replace(/&/g, ' and ');
  return base
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !CITY_WORDS.has(t) && t !== 'the')
    .join(' ');
}

const VENUE_SUFFIX_WORDS = new Set([
  'hall',
  'auditorium',
  'main',
  'mandapam',
  'mandapa',
  'centre',
  'center',
  'trust',
  'foundation',
  'society',
  'association',
  'pvt',
  'ltd',
  'private',
  'limited',
  'sri',
  'shri',
  'sree',
  'of',
  'and',
]);

/** Known short names of one place, applied to the folded key (city words are already gone). */
const VENUE_ALIASES: Array<[string, string]> = [['af', 'alliance francaise']];

export interface VenueKey {
  tokens: string[];
  /** A mini hall is another room of the same sabha. It never agrees with the main hall. */
  mini: boolean;
}

/**
 * A looser key for a venue than `placeKey`: parentheses and text after " - " are kept as extra
 * words, "Hall"/"Auditorium"/"Main"/"Trust" and "Sri" are dropped, spellings are folded
 * (Bharathiya/Bharatiya), and known aliases applied. Used to join the same concert across
 * sources and to hold (never auto-accept) a stored venue it matches.
 */
export function venueKey(raw: string): VenueKey {
  const text = raw.toLowerCase();
  const mini = /\bmini\b/.test(text);
  const base = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !CITY_WORDS.has(t) && t !== 'the' && t !== 'mini')
    .map(foldToken)
    .filter(t => !VENUE_SUFFIX_WORDS.has(t));
  let joined = base.join(' ');
  for (const [from, to] of VENUE_ALIASES) {
    if (joined === from) joined = to;
  }
  return { tokens: joined.split(' ').filter(Boolean), mini };
}

/** Same place, by `venueKey`: equal words, or the shorter (two words or more) inside the longer. */
export function venuesAgree(a: string, b: string): boolean {
  const ka = venueKey(a);
  const kb = venueKey(b);
  if (!ka.tokens.length || !kb.tokens.length || ka.mini !== kb.mini) return false;
  const [small, large] = ka.tokens.length <= kb.tokens.length ? [ka, kb] : [kb, ka];
  const inside = small.tokens.every(t => large.tokens.includes(t));
  return inside && (small.tokens.length >= 2 || small.tokens.length === large.tokens.length);
}

const NOT_A_PERSON = /^(team|and team|party|group|ensemble|speaker|students?|others?)$/i;

/**
 * "Name - Instrument" lists, as the sources write them, into people. An entry may hold several
 * people joined by commas ("A - Violin, B - Mridangam") and a duet is written "A & B - Violin
 * Duet". A joint billing is split into its people, so each can be matched on their own.
 */
export function parsePerformers(
  entries: Array<string | null | undefined>,
  kind: CrawledPerformer['kind']
): CrawledPerformer[] {
  const out: CrawledPerformer[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    // "Name and Team; commentary by V. Sriram" keeps the first part only.
    const head = entry.split(';')[0];
    for (const piece of head.split(',')) {
      const text = piece
        .replace(/\(([^)]*)\)\s*$/, ' - $1')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const dash = text.lastIndexOf(' - ');
      const namePart = dash >= 0 ? text.slice(0, dash) : text;
      const role = dash >= 0 ? text.slice(dash + 3).trim() : undefined;
      const people = namePart
        .replace(/\s+(and|&)\s+team$/i, '')
        .split(/\s+&\s+|\s+and\s+/i)
        .map(n => n.replace(/[.]+$/, '').trim())
        .filter(n => n.length > 1 && !NOT_A_PERSON.test(n));
      for (const name of people) {
        out.push({ name, kind, ...(role ? { role } : {}) });
      }
    }
  }
  return dedupePerformers(out);
}

function dedupePerformers(list: CrawledPerformer[]): CrawledPerformer[] {
  const seen = new Set<string>();
  return list.filter(p => {
    const key = normalizeArtistName(p.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "Carnatic Vocal Concert by Sunil Gargyan" -> ["Sunil Gargyan"], when nothing else names them. */
export function performersFromTitle(title: string): CrawledPerformer[] {
  const m = /\bby\s+(.+)$/i.exec(title);
  if (!m) return [];
  return parsePerformers([m[1]], 'main');
}

// ---------------------------------------------------------------------------
// Source readers

export interface Apps4uRow {
  Date: string;
  Time: string;
  Location: string;
  Type: string;
  'Who?': string;
  Link: string;
}

/** The id inside an mdnd event link: `e=` is base64 of "eid10304". */
export function mdndEventId(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const raw = new URL(link).searchParams.get('e');
    if (!raw) return null;
    const m = /^eid(\d+)$/.exec(Buffer.from(raw, 'base64').toString('utf8'));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const OUT_OF_SCOPE_TYPES = /exhibition|homam|puja|yagnam|others?/i;

/** apps4u "The Margazhi Guide": one row per concert, no poster. */
export function parseApps4uRows(rows: Apps4uRow[]): CrawledEvent[] {
  const events: CrawledEvent[] = [];
  rows.forEach((row, index) => {
    const date = parseApps4uDate(row.Date ?? '');
    if (!date) return;
    const time = parseClock(row.Time);
    const venue = splitVenue(row.Location ?? '');
    const link = row.Link?.startsWith('http') ? row.Link : undefined;
    const mdndId = mdndEventId(link);
    const who = (row['Who?'] ?? '').replace(/^\.+/, '').trim();
    const type = (row.Type ?? '').replace(/^\.+/, '').trim();
    events.push({
      source: 'apps4u',
      sourceId: mdndId ? `mdnd-${mdndId}` : `${date}-${index}`,
      sourceUrl: link ?? 'https://events.apps4u.net/',
      alsoListedBy: [],
      title: type && who ? `${type}: ${who}` : who || type,
      date,
      time,
      startDateTime: toStartDateTime(date, time),
      venueName: venue.name,
      venueRaw: venue.raw,
      city: venue.city,
      performers: parsePerformers([who], 'main'),
      category: type || undefined,
      ...(link && !mdndId ? { ticketUrl: link } : {}),
    });
  });
  return events;
}

export interface MdndEvent {
  event_id: number;
  event_title: string;
  event_date: string;
  display_time?: string | null;
  venue_name?: string | null;
  event_image?: string | null;
  event_description?: string | null;
  ticketing_option?: string | null;
  main_cat_name?: string | null;
  sub_cat_name?: string | null;
  artist_details?: Array<{ artist_name?: string | null }>;
  organiser_details?: Array<{ organiser_name?: string | null }>;
  accompanist_details?: Array<{ accompanist_name?: string | null }>;
  quickadd_artists?: string | null;
  quickadd_accompanists?: string | null;
  quickadd_organisers?: string | null;
}

export const MDND_IMAGE_BASE = 'https://api.mdnd.in/public/images/event_images/';
export const MDND_EVENT_BASE = 'https://mdnd.in/event/';

function jsonList(raw: string | null | undefined): Array<string | null> {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(v => (typeof v === 'string' ? v : null)) : [];
  } catch {
    return [];
  }
}

/** The event page link mdnd's own site uses: title with underscores, id base64 as `eid<id>`. */
export function mdndEventUrl(id: number, title: string): string {
  const slug = title.trim().split(/\s+/).join('_');
  const e = Buffer.from(`eid${id}`).toString('base64');
  return `${MDND_EVENT_BASE}${encodeURIComponent(slug)}?ci=${Buffer.from('ci101').toString('base64')}&e=${e}`;
}

/** mdnd.in `get_todays_event` rows: full detail and a poster image. */
export function parseMdndEvents(rows: MdndEvent[], city = 'Chennai'): CrawledEvent[] {
  const events: CrawledEvent[] = [];
  for (const row of rows) {
    const date = parseMdndDate(row.event_date ?? '');
    if (!date || !row.event_title) continue;
    const time = parseClock(row.display_time);
    const venue = splitVenue(row.venue_name ?? '', city);
    const mainNames = [
      ...(row.artist_details ?? []).map(a => a.artist_name),
      ...jsonList(row.quickadd_artists),
    ];
    let performers = [
      ...parsePerformers(mainNames, 'main'),
      ...parsePerformers(
        [
          ...(row.accompanist_details ?? []).map(a => a.accompanist_name),
          ...jsonList(row.quickadd_accompanists),
        ],
        'accompanist'
      ),
    ];
    performers = dedupePerformers(performers);
    if (!performers.some(p => p.kind === 'main')) {
      performers = dedupePerformers([...performersFromTitle(row.event_title), ...performers]);
    }
    const organiser =
      (row.organiser_details ?? []).map(o => o.organiser_name?.trim()).find(Boolean) ||
      jsonList(row.quickadd_organisers)
        .map(o => o?.trim())
        .find(Boolean) ||
      undefined;
    const description = row.event_description ? htmlToText(row.event_description) : '';
    const url = mdndEventUrl(row.event_id, row.event_title);
    const image = row.event_image?.trim();
    events.push({
      source: 'mdnd',
      sourceId: `mdnd-${row.event_id}`,
      sourceUrl: url,
      alsoListedBy: [],
      title: row.event_title.replace(/\s+/g, ' ').trim(),
      date,
      time,
      startDateTime: toStartDateTime(date, time),
      venueName: venue.name,
      venueRaw: venue.raw,
      city: venue.city,
      performers,
      ...(organiser ? { organiser } : {}),
      ticketUrl: url,
      entryType: /^free$/i.test(row.ticketing_option ?? '') ? 'free' : 'ticketed',
      category: [row.main_cat_name, row.sub_cat_name].filter(Boolean).join(' / ') || undefined,
      ...(description ? { description } : {}),
      ...(image && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(image)
        ? { posterUrl: `${MDND_IMAGE_BASE}${image}` }
        : {}),
    });
  }
  return events;
}

export const SLOT_WINDOW_MINUTES = 30;

const minuteOf = (e: CrawledEvent) =>
  e.startDateTime ? Date.parse(e.startDateTime) / 60000 : Number.NaN;

const mainsOf = (e: CrawledEvent) => e.performers.filter(p => p.kind === 'main');

const listing = (e: CrawledEvent, by: MergedListing['by']): MergedListing => ({
  key: `${e.source}:${e.sourceId}`,
  source: e.source,
  url: e.sourceUrl,
  title: e.title,
  by,
});

const tierRank: Record<NameComparison['tier'], number> = { exact: 2, close: 1, none: 0 };

/**
 * Pairs the people of two listings of one concert. Where both name a person, the fuller
 * spelling is kept ("V. Deepika" over "Deepika") and the other is recorded as a variant.
 * A person only the other listing names is added.
 */
export function mergePerformers(
  base: CrawledPerformer[],
  other: CrawledPerformer[]
): CrawledPerformer[] {
  const used = new Set<number>();
  const out = base.map(p => {
    let bestIdx = -1;
    let bestRank = 0;
    other.forEach((o, i) => {
      if (used.has(i)) return;
      const rank = tierRank[compareArtistNames(p.name, o.name).tier];
      if (rank > bestRank) {
        bestRank = rank;
        bestIdx = i;
      }
    });
    if (bestIdx < 0) return { ...p };
    used.add(bestIdx);
    const o = other[bestIdx];
    const display = pickDisplayName([p.name, o.name]);
    const variants = [...new Set([...(p.variants ?? []), ...(o.variants ?? []), p.name, o.name])];
    return { ...p, name: display, variants: variants.filter(v => v !== display) };
  });
  other.forEach((o, i) => {
    if (!used.has(i)) out.push({ ...o });
  });
  return out;
}

/** Folds `other` into `base` (mdnd wins every field; only people and sources are combined). */
function absorb(base: CrawledEvent, other: CrawledEvent, by: MergedListing['by']): void {
  if (!base.alsoListedBy.includes(other.source)) base.alsoListedBy.push(other.source);
  base.mergedWith = [...(base.mergedWith ?? []), listing(other, by)];
  base.performers = mergePerformers(base.performers, other.performers);
  if (!base.category && other.category) base.category = other.category;
}

/**
 * Same concert on two sites without a shared id: the same day, a start within
 * `SLOT_WINDOW_MINUTES`, and the same venue (`venuesAgree`) with at least one artist in
 * common, or, at an unknown venue spelling, every billed artist matching. Where the venue
 * agrees but the billed artists disagree entirely, the rows stay apart (two halls of one sabha).
 * One apps4u row folds into at most one mdnd row; the best score goes first.
 */
export function mergeBySlot(base: CrawledEvent[], extras: CrawledEvent[]): CrawledEvent[] {
  const pairs: Array<{ m: number; a: number; score: number }> = [];
  extras.forEach((a, ai) => {
    const at = minuteOf(a);
    if (Number.isNaN(at)) return;
    base.forEach((m, mi) => {
      if (m.source === a.source || m.date !== a.date) return;
      const dt = Math.abs(minuteOf(m) - at);
      if (Number.isNaN(dt) || dt > SLOT_WINDOW_MINUTES) return;
      const ma = mainsOf(a);
      const mm = mainsOf(m);
      const names = m.performers;
      const ranks = ma.map(p =>
        Math.max(0, ...names.map(n => tierRank[compareArtistNames(p.name, n.name).tier]))
      );
      const matched = ranks.filter(r => r > 0).length;
      const exact = ranks.filter(r => r === 2).length;
      const venueOk = venuesAgree(a.venueName, m.venueName);
      const noArtists = ma.length === 0 || mm.length === 0;
      const ok = venueOk
        ? matched > 0 || noArtists
        : exact >= 1 && matched === ma.length && ma.length > 0;
      if (ok) pairs.push({ m: mi, a: ai, score: matched * 2 + (venueOk ? 2 : 0) - dt / 60 });
    });
  });
  pairs.sort((x, y) => y.score - x.score);
  const takenA = new Set<number>();
  const takenM = new Set<number>();
  for (const p of pairs) {
    if (takenA.has(p.a) || takenM.has(p.m)) continue;
    takenA.add(p.a);
    takenM.add(p.m);
    absorb(base[p.m], extras[p.a], 'slot');
  }
  return [...base, ...extras.filter((_, i) => !takenA.has(i))];
}

/**
 * apps4u lists what mdnd sells, usually with the mdnd link. Where both have the event, mdnd's
 * record wins (poster, title, time, link, organiser) and notes that apps4u listed it too. Rows
 * with no link are joined by day, time and venue (`mergeBySlot`). Names come from whichever
 * listing is fuller. Rows that only apps4u has stay, with the fields apps4u has.
 */
export function mergeCrawled(apps4u: CrawledEvent[], mdnd: CrawledEvent[]): CrawledEvent[] {
  const merged = mdnd.map(e => ({
    ...e,
    alsoListedBy: [...e.alsoListedBy],
    performers: e.performers.map(p => ({ ...p })),
    ...(e.mergedWith ? { mergedWith: [...e.mergedWith] } : {}),
  }));
  const mergedById = new Map(merged.map(e => [e.sourceId, e]));
  const rest: CrawledEvent[] = [];
  for (const event of apps4u) {
    const twin = mergedById.get(event.sourceId);
    if (twin && twin.source !== event.source) absorb(twin, event, 'id');
    else rest.push(event);
  }
  return mergeBySlot(merged, rest).sort((a, b) =>
    (a.startDateTime ?? a.date).localeCompare(b.startDateTime ?? b.date)
  );
}

// ---------------------------------------------------------------------------
// Scope

const OUT_OF_SCOPE_CATEGORY =
  /film|bollywood|pop|rock|hip ?hop|comedy|stand.?up|talk show|exhibition|homam|puja|yagnam|others?/i;

/** The site is about Indian classical arts. Everything else is listed but not pre-selected. */
export function crawlScope(event: CrawledEvent): { inScope: boolean; reason?: string } {
  const text = `${event.category ?? ''}`;
  if (OUT_OF_SCOPE_CATEGORY.test(text) || OUT_OF_SCOPE_TYPES.test(text)) {
    return { inScope: false, reason: `category "${text}" is not classical music or dance` };
  }
  return { inScope: true };
}

// ---------------------------------------------------------------------------
// Matching and the plan

export interface StoredName {
  id: string;
  name: string;
  alternateNames?: string[] | null;
}

export interface StoredEventLite {
  id: string;
  title: string;
  startDateTime: string;
  venueId?: string | null;
  venueName?: string | null;
  status?: string | null;
  mergedIntoId?: string | null;
  deletedAt?: string | null;
}

export type MatchTier = 'exact' | 'close' | 'none';

export interface NameMatch {
  tier: MatchTier;
  id?: string;
  name?: string;
  /** 0-1; only for `close`. */
  score?: number;
}

function tokenSet(key: string): Set<string> {
  return new Set(key.split(' ').filter(Boolean));
}

/**
 * Venue or organiser by name. `exact` is the same key after the locality and punctuation are
 * removed. `close` is a shared set of at least two words, or one name holding the other; it is
 * shown for review and never used on its own. A single shared word ("hall") never counts.
 */
export function matchPlace(raw: string, stored: StoredName[]): NameMatch {
  const key = placeKey(raw);
  if (!key) return { tier: 'none' };
  const mine = tokenSet(key);
  let best: NameMatch = { tier: 'none' };
  for (const candidate of stored) {
    for (const name of [candidate.name, ...(candidate.alternateNames ?? [])]) {
      const other = placeKey(name);
      if (!other) continue;
      if (other === key) return { tier: 'exact', id: candidate.id, name: candidate.name };
      const theirs = tokenSet(other);
      const shared = [...mine].filter(t => theirs.has(t)).length;
      const smaller = Math.min(mine.size, theirs.size);
      const score = shared / Math.max(mine.size, theirs.size);
      const contains = shared === smaller && smaller >= 2;
      if ((contains || (shared >= 2 && score >= 0.6)) && score > (best.score ?? 0)) {
        best = { tier: 'close', id: candidate.id, name: candidate.name, score };
      }
      // Same place under another suffix, spelling or alias ("Bharatiya Vidya Bhavan (Main
      // Auditorium)"): held for a person, never taken as exact.
      if (best.tier === 'none' && venuesAgree(raw, name)) {
        best = { tier: 'close', id: candidate.id, name: candidate.name, score: 0.7 };
      }
    }
  }
  return best;
}

export const ARTIST_EXACT_FLOOR = 0.95;
export const ARTIST_CLOSE_FLOOR = 0.85;

/**
 * Artist by name. Two scorers, the better tier wins: the repo's own (`artistNameSimilarity`,
 * initials and spelling) and the crawl's name key (`compareArtistNames`: titles, initials,
 * spacing, transliteration). `close` is for review and never taken automatically.
 */
export function matchArtist(
  raw: string,
  stored: Array<StoredName & { alternateNames?: string[] | null }>
): NameMatch {
  if (!normalizeArtistName(raw)) return { tier: 'none' };
  let best: NameMatch = { tier: 'none' };
  let bestRank = 0;
  let bestScore = 0;
  for (const candidate of stored) {
    for (const name of [candidate.name, ...(candidate.alternateNames ?? [])]) {
      const repo = artistNameSimilarity(raw, name);
      const mine = compareArtistNames(raw, name);
      const repoRank = repo >= ARTIST_EXACT_FLOOR ? 2 : repo >= ARTIST_CLOSE_FLOOR ? 1 : 0;
      const rank = Math.max(repoRank, tierRank[mine.tier]);
      const score = Math.max(repo, mine.score);
      if (rank > bestRank || (rank === bestRank && rank > 0 && score > bestScore)) {
        bestRank = rank;
        bestScore = score;
        best = {
          tier: rank === 2 ? 'exact' : 'close',
          id: candidate.id,
          name: candidate.name,
          score,
        };
      }
    }
  }
  return best;
}

export interface DuplicateHit {
  id: string;
  title: string;
  startDateTime: string;
  status?: string | null;
  reason: 'same-venue-within-window' | 'same-day-same-artist';
}

const LISTED = new Set(['approved', 'submitted']);

/**
 * Stored events this crawled event may already be. Two rules, both reviewed by a person:
 * the same venue within `DUPLICATE_WINDOW_HOURS` (the verify step's rule), or the same day with a
 * billed artist whose name is in the stored title.
 */
export function findCrawlDuplicates(
  event: { startDateTime: string | null; date: string; venueId?: string | null; artists: string[] },
  stored: StoredEventLite[]
): DuplicateHit[] {
  const at = event.startDateTime ? Date.parse(event.startDateTime) : Number.NaN;
  const windowMs = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
  const hits: DuplicateHit[] = [];
  for (const s of stored) {
    if (s.mergedIntoId || s.deletedAt || !LISTED.has(s.status ?? '')) continue;
    const sameVenue = !!event.venueId && s.venueId === event.venueId;
    if (sameVenue && !Number.isNaN(at) && Math.abs(Date.parse(s.startDateTime) - at) <= windowMs) {
      hits.push({ ...pick(s), reason: 'same-venue-within-window' });
      continue;
    }
    const sameDay = istDate(s.startDateTime) === event.date;
    if (sameDay) {
      const title = ` ${normalizeArtistName(s.title)} `;
      const named = event.artists.some(a => {
        const n = normalizeArtistName(a);
        return n.length > 3 && title.includes(` ${n} `);
      });
      if (named) hits.push({ ...pick(s), reason: 'same-day-same-artist' });
    }
  }
  return hits;
}

const pick = (s: StoredEventLite) => ({
  id: s.id,
  title: s.title,
  startDateTime: s.startDateTime,
  status: s.status,
});

/** The calendar day of a stored instant in IST, which is how the listing pages group days. */
function istDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return new Date(t + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export type CrawlDecision = 'create' | 'skip';

export interface PlannedPerformer extends CrawledPerformer {
  match: NameMatch;
}

/** One person who is spelled more than one way in the crawl. */
export interface ArtistCluster {
  display: string;
  variants: string[];
}

export interface CrawlPlanEntry {
  key: string;
  decision: CrawlDecision;
  /** Why `decision` is `skip` by default. Empty when it is `create`. */
  skipReasons: string[];
  event: CrawledEvent;
  venue: NameMatch & { willCreate: boolean };
  organiser?: NameMatch & { willCreate: boolean };
  performers: PlannedPerformer[];
  duplicates: DuplicateHit[];
}

export interface CrawlStoredData {
  artists: StoredName[];
  venues: StoredName[];
  organisers: StoredName[];
  events: StoredEventLite[];
}

/**
 * Plan every crawled event against what is stored. Default `create` needs: in scope, a start
 * time, a future day, no possible duplicate, an exact venue match or a venue name to create
 * (a `close` venue match is held, because two halls of one sabha are two venues), and at least
 * one billed artist. Anything else defaults to `skip`, with the reasons, for the owner to flip.
 */
export function planCrawl(
  events: CrawledEvent[],
  stored: CrawlStoredData,
  today: string
): CrawlPlanEntry[] {
  // One display name per person across the crawl, so a person spelled three ways becomes one new
  // artist. The apply step reads `name`, which is now the cluster's fullest spelling.
  const spellings = events.flatMap(e => e.performers.flatMap(p => [p.name, ...(p.variants ?? [])]));
  const { displayOf } = clusterArtistNames(spellings);
  const matchBest = (names: string[]): NameMatch => {
    let best: NameMatch = { tier: 'none' };
    for (const n of names) {
      const m = matchArtist(n, stored.artists);
      if (tierRank[m.tier] > tierRank[best.tier]) best = m;
      else if (m.tier === best.tier && (m.score ?? 0) > (best.score ?? 0)) best = m;
    }
    return best;
  };
  return events.map(event => {
    const venue = event.venueName
      ? matchPlace(event.venueName, stored.venues)
      : { tier: 'none' as const };
    const organiser = event.organiser ? matchPlace(event.organiser, stored.organisers) : undefined;
    const performers = event.performers.map(p => {
      const display = displayOf.get(p.name) ?? p.name;
      const all = [...new Set([p.name, ...(p.variants ?? [])])];
      const variants = all.filter(v => v !== display);
      const { variants: _old, ...rest } = p;
      return {
        ...rest,
        name: display,
        ...(variants.length ? { variants } : {}),
        match: matchBest([display, ...variants]),
      };
    });
    const duplicates = findCrawlDuplicates(
      {
        startDateTime: event.startDateTime,
        date: event.date,
        venueId: venue.tier === 'exact' ? venue.id : undefined,
        artists: event.performers.filter(p => p.kind === 'main').map(p => p.name),
      },
      stored.events
    );

    const skipReasons: string[] = [];
    const scope = crawlScope(event);
    if (!scope.inScope && scope.reason) skipReasons.push(scope.reason);
    if (!event.startDateTime) skipReasons.push('no start time');
    if (event.date < today) skipReasons.push('already past');
    if (duplicates.length)
      skipReasons.push(`possible duplicate of ${duplicates.length} stored event(s)`);
    if (!event.venueName) skipReasons.push('no venue');
    if (venue.tier === 'close') skipReasons.push(`venue close to "${venue.name}"; pick one`);
    if (!performers.some(p => p.kind === 'main')) skipReasons.push('no billed artist');

    return {
      key: `${event.source}:${event.sourceId}`,
      decision: skipReasons.length ? 'skip' : 'create',
      skipReasons,
      event,
      venue: { ...venue, willCreate: !!event.venueName && venue.tier === 'none' },
      ...(organiser ? { organiser: { ...organiser, willCreate: organiser.tier === 'none' } } : {}),
      performers,
      duplicates,
    };
  });
}

export interface CrawlSummary {
  total: number;
  chennai: number;
  december: number;
  withPoster: number;
  create: number;
  skip: number;
  duplicates: number;
  artists: { exact: number; close: number; new: number };
  venues: { exact: number; close: number; new: number };
  organisers: { exact: number; close: number; new: number };
  /** Listings folded into another row, by how they were joined. */
  merged: { byId: number; bySlot: number };
  /** Rows before the merge: `total` plus every folded listing. */
  eventsBeforeMerge: number;
  /** Spellings seen, people they came down to, and people with more than one spelling. */
  artistNames: { spellings: number; people: number; clustered: number };
}

const tally = (tiers: MatchTier[]) => ({
  exact: tiers.filter(t => t === 'exact').length,
  close: tiers.filter(t => t === 'close').length,
  new: tiers.filter(t => t === 'none').length,
});

/** Distinct names: one artist billed twice is counted once. */
export function summarizeCrawl(entries: CrawlPlanEntry[]): CrawlSummary {
  const distinct = (pairs: Array<[string, MatchTier]>) => {
    const map = new Map(pairs);
    return tally([...map.values()]);
  };
  const chosen = entries.filter(e => e.decision === 'create');
  return {
    total: entries.length,
    chennai: entries.filter(e => e.event.city === 'Chennai').length,
    december: entries.filter(e => e.event.date.startsWith(`${decemberYear(entries)}-12`)).length,
    withPoster: entries.filter(e => e.event.posterFile).length,
    create: chosen.length,
    skip: entries.length - chosen.length,
    duplicates: entries.filter(e => e.duplicates.length).length,
    artists: distinct(
      entries.flatMap(e =>
        e.performers.map(p => [normalizeArtistName(p.name), p.match.tier] as [string, MatchTier])
      )
    ),
    venues: distinct(
      entries
        .filter(e => e.event.venueName)
        .map(e => [placeKey(e.event.venueName), e.venue.tier] as [string, MatchTier])
    ),
    merged: {
      byId: entries.reduce(
        (n, e) => n + (e.event.mergedWith ?? []).filter(m => m.by === 'id').length,
        0
      ),
      bySlot: entries.reduce(
        (n, e) => n + (e.event.mergedWith ?? []).filter(m => m.by === 'slot').length,
        0
      ),
    },
    eventsBeforeMerge:
      entries.length + entries.reduce((n, e) => n + (e.event.mergedWith?.length ?? 0), 0),
    artistNames: artistNameCounts(entries),
    organisers: distinct(
      entries
        .filter(e => e.organiser)
        .map(
          e =>
            [placeKey(e.event.organiser ?? ''), e.organiser?.tier ?? 'none'] as [string, MatchTier]
        )
    ),
  };
}

/** Every person in the plan with the spellings the crawl used for them. */
export function artistClusters(entries: CrawlPlanEntry[]): ArtistCluster[] {
  const byName = new Map<string, Set<string>>();
  for (const e of entries) {
    for (const p of e.performers) {
      const set = byName.get(p.name) ?? new Set<string>([p.name]);
      for (const v of p.variants ?? []) set.add(v);
      byName.set(p.name, set);
    }
  }
  return [...byName.entries()].map(([display, set]) => ({
    display,
    variants: [display, ...[...set].filter(v => v !== display)],
  }));
}

function artistNameCounts(entries: CrawlPlanEntry[]) {
  const clusters = artistClusters(entries);
  const spellings = new Set(clusters.flatMap(c => c.variants.map(v => normalizeArtistName(v))));
  return {
    spellings: spellings.size,
    people: clusters.length,
    clustered: clusters.filter(c => c.variants.length > 1).length,
  };
}

/** The season's December: the year of the latest December in the data, else the first year. */
function decemberYear(entries: CrawlPlanEntry[]): string {
  const years = entries
    .map(e => e.event.date)
    .filter(d => d.slice(5, 7) === '12')
    .map(d => d.slice(0, 4))
    .sort();
  return years.at(-1) ?? entries[0]?.event.date.slice(0, 4) ?? '';
}

/** A short review sheet, like the SSP ones: what will be created, what is held and why. */
export function renderReviewSheet(
  entries: CrawlPlanEntry[],
  summary: CrawlSummary,
  meta: { generatedAt: string; sources: string[]; offline?: boolean }
): string {
  const lines: string[] = [];
  const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  lines.push(`# Poster crawl review (${meta.generatedAt.slice(0, 10)})`, '');
  lines.push(`Sources: ${meta.sources.join(', ')}. Dry run: nothing has been written.`, '');
  if (meta.offline) {
    lines.push(
      '**Offline run: the database was not read.** No artist, venue, organiser or duplicate match is real below; every row is held. Rerun `crawl-match` with database access before applying.',
      ''
    );
  }
  lines.push(
    `- Events: ${summary.total} (Chennai ${summary.chennai}, December ${summary.december}), posters ${summary.withPoster}`,
    `- Merged across sites: ${summary.merged.byId + summary.merged.bySlot} (${summary.merged.byId} by mdnd id, ${summary.merged.bySlot} by day, time and venue). Rows before merge ${summary.eventsBeforeMerge}, after ${summary.total}`,
    `- Artist spellings ${summary.artistNames.spellings}, people after clustering ${summary.artistNames.people} (${summary.artistNames.clustered} with more than one spelling)`,
    `- Would create: ${summary.create}. Held (skip): ${summary.skip}. Possible duplicates: ${summary.duplicates}`,
    `- Artists: ${summary.artists.exact} exact, ${summary.artists.close} close, ${summary.artists.new} new`,
    `- Venues: ${summary.venues.exact} exact, ${summary.venues.close} close, ${summary.venues.new} new`,
    `- Organisers: ${summary.organisers.exact} exact, ${summary.organisers.close} close, ${summary.organisers.new} new`,
    '',
    'To change a row, edit its `decision` in the manifest JSON (`create` or `skip`).',
    ''
  );

  const section = (heading: string, rows: CrawlPlanEntry[]) => {
    lines.push(`## ${heading} (${rows.length})`, '');
    if (!rows.length) {
      lines.push('None.', '');
      return;
    }
    lines.push(
      '| When | Title | Venue | Artists | Why | Key |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const e of rows) {
      const artists = e.performers
        .filter(p => p.kind === 'main')
        .map(
          p =>
            `${p.name}${p.match.tier === 'none' ? ' (new)' : p.match.tier === 'close' ? ' (close)' : ''}`
        )
        .join(', ');
      const venue = `${e.event.venueName}${e.venue.tier === 'none' ? ' (new)' : e.venue.tier === 'close' ? ` (close: ${e.venue.name})` : ''}`;
      const merged = (e.event.mergedWith ?? []).map(m => `merged with ${m.key}`);
      const why = [...merged, ...e.skipReasons].concat(
        e.duplicates.map(d => `dup: ${d.title} @ ${d.startDateTime.slice(0, 16)} [${d.id}]`)
      );
      lines.push(
        `| ${e.event.date} ${e.event.time ?? '?'} | ${cell(e.event.title)} | ${cell(venue)} | ${cell(artists)} | ${cell(why.join('; '))} | ${e.key} |`
      );
    }
    lines.push('');
  };

  section(
    'Would create',
    entries.filter(e => e.decision === 'create')
  );
  section(
    'Held: possible duplicates',
    entries.filter(e => e.decision === 'skip' && e.duplicates.length)
  );
  section(
    'Held: other reasons',
    entries.filter(e => e.decision === 'skip' && !e.duplicates.length)
  );

  const mergedRows = entries.filter(e => e.event.mergedWith?.length);
  lines.push(`## Merged listings (${mergedRows.length} rows)`, '');
  lines.push(
    'The mdnd row is kept (title, poster, time, link). The other listing is a secondary source.',
    ''
  );
  for (const e of mergedRows) {
    for (const m of e.event.mergedWith ?? []) {
      lines.push(
        `- ${e.key} "${cell(e.event.title)}" ${e.event.date} ${e.event.time ?? '?'} <- ${m.key} "${cell(m.title)}" (${m.by}) ${m.url}`
      );
    }
  }
  lines.push('');

  const clusters = artistClusters(entries).filter(c => c.variants.length > 1);
  lines.push(
    `## Artist clusters (${clusters.length})`,
    '',
    'One artist is made per line (display name first).',
    ''
  );
  for (const c of clusters.sort((a, b) => a.display.localeCompare(b.display))) {
    lines.push(`- ${cell(c.display)} <- ${c.variants.slice(1).map(cell).join(', ')}`);
  }
  lines.push('');

  const closeNames = clusterArtistNames(artistClusters(entries).map(c => c.display)).close;
  lines.push(
    `## Close artist names inside the crawl, not merged (${closeNames.length})`,
    '',
    'Possibly one person. Each is made a separate new artist unless you merge them later.',
    ''
  );
  for (const c of closeNames) lines.push(`- ${cell(c.a)} ~ ${cell(c.b)} (${c.reason})`);
  lines.push('');
  return lines.join('\n');
}

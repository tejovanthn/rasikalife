/**
 * People from the Sangita Sampradaya Pradarshini (SSP, English edition), joined across the five
 * volumes into one record per real person.
 *
 * Pure. The scripts layer reads the JSONL files and passes the rows in.
 *
 * Scope (owner, 2026-11-03): composers named in Vols 1–4, plus the subjects of the Vol 5
 * biographies. Not everyone SSP names. Rulers who composed nothing, deities, places and the
 * British royals are skipped, each with a reason.
 *
 * What is taken, and what never is. Only short facts that are our own values: a year, a place,
 * a mudra, a title, a name, a guru's name. Never an English sentence of the translators, never
 * caste or community, never a lyric. `works` keeps only things that read as titles. A relative
 * date ("within the last two hundred years") is dropped; only absolute years count.
 *
 * Joining. SSP gives every volume its own ids, spells one man several ways (Muttusvāmi in Vols
 * 1–4, Muddusvāmi in Vol 5; Vēṅkaṭamakhi and Vēṅkaṭamakhin), and uses one name for different
 * people (two Vēṅkaṭēśvara Eṭṭēndra, rulers of one house). So:
 * - a name with a bracketed qualifier ("Muddusvāmi (son of Subbarāma Dīkṣita)", "… (VC §68)") is
 *   a person of its own and joins nothing but a row with the same qualifier;
 * - rows join on an equal name key, on SSP's own `possible_same_person` review rows, and on a
 *   variant spelling that names exactly one other person;
 * - the Eṭṭēndra rulers join on an identical key only; and a named list of pairs stays apart.
 */

import { foldKey } from '../composition/match';
import { SSP_SOURCE_SLUG } from '../raga/ssp';

// ── input shapes ──────────────────────────────────────────────────────────────────────────

export interface SspArtistRow {
  merged_provisional_id: string;
  name_canonical: string;
  name_variants_seen?: string[] | null;
  merged_from_provisional_ids?: string[] | null;
  roles_seen?: string[] | null;
  attributes_consolidated?: Record<string, { values?: unknown[]; sections?: string[] }> | null;
  all_sources?: { page?: number; printed_page?: number | null }[] | null;
}

export interface SspRelationshipRow {
  from: string;
  to: string;
  type: string;
  supporting_pages?: number[] | null;
  verbatim_quotes?: { page?: number; quote?: string }[] | null;
}

export interface SspVolumeInput {
  volume: number;
  artists: SspArtistRow[];
  relationships: SspRelationshipRow[];
  /** `possible_same_person` rows from review.jsonl: `detail` is the pair of names. */
  reviews?: { kind?: string; detail?: unknown }[];
  /** The PDF page to its printed page, from `page-manifest.json`. */
  printedPages?: Record<string, number | null | { printed_page?: number | null }>;
}

// ── output shapes ─────────────────────────────────────────────────────────────────────────

export interface SspPersonCitation {
  field: string;
  sourceSlug: string;
  locator: string;
  /** Names the entry a citation marks: the guru, or the work. */
  note?: string;
}

export interface SspGuruEdge {
  /** The `key` of the guru when that person is in this import. */
  guruKey?: string;
  /** The guru's name as our records would spell it. */
  name: string;
  iastName: string;
  /** Mantra initiation or philosophy, not music. */
  spiritual: boolean;
}

export interface SspPersonFacts {
  birthYear?: number;
  deathYear?: number;
  birthPlace?: string;
  deathPlace?: string;
  mudra?: string;
  works: string[];
}

export interface SspPerson {
  key: string;
  /** Common searched spelling, for a new record. */
  name: string;
  iastName: string;
  qualifier?: string;
  /** IAST spellings seen, other than `name`. */
  alternateNames: string[];
  facts: SspPersonFacts;
  citations: SspPersonCitation[];
  gurus: SspGuruEdge[];
  /** Distinct compositions in Vols 1–4 that name this person as composer. */
  composedCount: number;
  volumes: number[];
  sspIds: string[];
  scope: 'composer' | 'biography' | 'both';
  /** Roles SSP gives, for the reviewer. */
  roles: string[];
  notes: string[];
}

export interface SspSkipped {
  name: string;
  volumes: number[];
  reason: string;
}

export interface SspPeopleResult {
  people: SspPerson[];
  skipped: SspSkipped[];
  stats: {
    rows: number;
    components: number;
    guruEdges: number;
    guruEdgesUnresolved: number;
    citationsDropped: number;
  };
}

// ── names ─────────────────────────────────────────────────────────────────────────────────

function ascii(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

/** "Name (qualifier)" to its two parts. A name with no brackets has no qualifier. */
export function splitQualifier(name: string): { base: string; qualifier?: string } {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return { base: name.trim() };
  return { base: m[1].trim(), qualifier: m[2].trim() };
}

const HONORIFIC_WORDS = new Set(['sri', 'shri', 'mr', 'dr', 'avargal', 'avargaḷ', 'garu', 'gaaru']);

/** Endings that carry no identity: Dīkṣitar/Dīkṣita, Vēṅkaṭamakhin/-khi, Śāstrigal/Śāstri. */
function wordKey(word: string): string {
  let key = foldKey(word);
  if (key.length > 5 && key.endsWith('gal')) key = key.slice(0, -3);
  key = key.replace(/ar$/, 'a').replace(/in$/, 'i');
  return key;
}

export interface SspNameWord {
  /** The lossy fold (`foldKey` and the endings). Spellings meet here. */
  fold: string;
  /** A light fold that keeps `y`, doubled consonants and the like. It tells `Nannayya` from `Nayana`. */
  light: string;
}

function lightKey(word: string): string {
  return word
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/ii+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/uu+/g, 'u')
    .replace(/h/g, '')
    .replace(/w/g, 'v')
    .replace(/c/g, 'k');
}

/** The words of a name, each folded, with honorifics and bracketed qualifiers removed. */
export function sspNameWords(name: string): SspNameWord[] {
  const base = splitQualifier(name).base;
  const plain = ascii(base)
    .replace(/[^a-z\s]/g, ' ')
    // The Vol 1 "muttu Vēṅkaṭamakhi" and every "Muttusvāmi" are the Muddu spelling of Vol 5.
    .replace(/\bmuttu(?=\s|s[vw])/g, 'muddu');
  return plain
    .split(/\s+/)
    .filter(w => w && !HONORIFIC_WORDS.has(w))
    .map(w => ({ fold: wordKey(w), light: lightKey(w) }));
}

/**
 * A key under which one person's spellings meet. Lossy on purpose: it finds, a person decides.
 * `Muttusvāmi`, `Muddusvāmi` and `Muttuswaamee` meet; `Dīkṣita` and `Dikshitar` meet.
 */
export function sspNameKey(name: string): string {
  return sspNameWords(name)
    .map(w => w.fold)
    .join(' ');
}

/**
 * Words that name a lineage, a title or a rank rather than a person. `Dīkṣita` is one: a
 * name that agrees only on it is not a match.
 */
export const GENERIC_NAME_WORDS: ReadonlySet<string> = new Set(
  [
    'dikshitar',
    'dikshita',
    'diksita',
    'diksitar',
    'sastri',
    'shastri',
    'sastrigal',
    'sastry',
    'ayya',
    'ayyar',
    'ayyangar',
    'iyer',
    'iyengar',
    'bhagavatar',
    'bhagavata',
    'bhavatar',
    'mudaliyar',
    'kavi',
    'dasa',
    'dasar',
    'nayaka',
    'raja',
    'maharaja',
    'rao',
    'yatindra',
    'pandita',
    'pillai',
    'naidu',
    'aiyyar',
    'aiyar',
    'aiyer',
    'aiyangar',
    'chetty',
    'chettiar',
    'reddy',
    'sarma',
    'sharma',
    'sarman',
    'svami',
    'swami',
    'swaami',
    'tanjavur',
    'tanjore',
    'tiruvarur',
    'madurai',
    'tirunelveli',
  ].map(wordKey)
);

const IAST_TO_PLAIN: Record<string, string> = {
  ś: 'sh',
  ṣ: 'sh',
  ṛ: 'ri',
  ṝ: 'ri',
  ṅ: 'n',
  ñ: 'n',
  ṇ: 'n',
  ṃ: 'm',
  ṁ: 'm',
  ḥ: 'h',
  ṭ: 't',
  ḍ: 'd',
  ḷ: 'l',
  ḻ: 'l',
  ṉ: 'n',
  ṟ: 'r',
};

/**
 * The way people type the name into a search box: `Subbarāma Dīkṣita` becomes `Subbarama
 * Dikshitar`, `Vēṅkaṭamakhin` becomes `Venkatamakhi`. A suggestion for a new record's `name`;
 * the review CSV lets a person correct it. The IAST goes to `alternateNames`.
 */
export function searchedSpelling(iast: string): string {
  const out = iast
    .normalize('NFC')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => {
      let w = '';
      for (const ch of word.normalize('NFC').replace(/śv/g, 'sw').replace(/Śv/g, 'Sw')) {
        const lower = ch.toLowerCase();
        w += IAST_TO_PLAIN[lower] ?? lower.normalize('NFD').replace(/\p{M}/gu, '');
      }
      w = w
        .replace(/c(?!h)/g, 'ch')
        .replace(/sv(?=[aeiou])/g, 'sw')
        .replace(/makhin$/, 'makhi')
        .replace(/^muddu(?=sw)/, 'muttu')
        .replace(/^dikshita$/, 'dikshitar')
        .replace(/[^a-z.'-]/g, '');
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .filter(Boolean);
  return out.join(' ');
}

function titleCase(text: string): string {
  return text.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());
}

/** A variant worth keeping as a spelling of the name, or null. */
function usableVariant(variant: string, canonicalBase: string): string | null {
  const v = splitQualifier(variant).base.replace(/\s+/g, ' ').trim();
  if (v.length < 3) return null;
  if (/^[a-zāīūṛēōśṣṭḍṇṅñḷḻṃ]/.test(v) && v[0] === v[0].toLowerCase() && /\s/.test(v) === false) {
    // A lone lowercase word is a heading fragment or a mudra, not a spelling of the name.
    return null;
  }
  if (v[0] === v[0].toLowerCase() && v[0] !== v[0].toUpperCase()) return null;
  if (/[(),‘’'"“”¯]/.test(v)) return null;
  if (/\b(avarga|gāru|garu|mr\.|rao bah|chennai|his highness|misprint|mudrā|the |this )/i.test(v))
    return null;
  const canonicalWords = canonicalBase.split(/\s+/).length;
  if (canonicalWords >= 2 && !/\s/.test(v)) return null;
  return v;
}

// ── dates and values ──────────────────────────────────────────────────────────────────────

const RELATIVE_WORDS =
  /relative to|ago|before|after|within|about|approximately|century|time of|reign|surmised|believed/i;

/**
 * An absolute year from a `birth_date` / `death_date` value, or undefined. Takes `{ad: 1775}`,
 * `"śaka 1739 (1817 A.D.), …"` and `1859`. A relative date has no year to take.
 */
export function parseSspYear(value: unknown): { year: number; saka?: number } | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 1000 && value <= 1920 ? { year: value } : undefined;
  }
  if (value && typeof value === 'object') {
    const o = value as { ad?: unknown; saka?: unknown };
    const ad = typeof o.ad === 'number' ? o.ad : Number.parseInt(String(o.ad ?? ''), 10);
    if (Number.isInteger(ad) && ad >= 1000 && ad <= 1920) {
      return { year: ad, saka: typeof o.saka === 'number' ? o.saka : undefined };
    }
    return undefined;
  }
  if (typeof value === 'string') {
    if (RELATIVE_WORDS.test(value)) return undefined;
    const m = value.match(/\(\s*(\d{4})\s*A\.?D\.?\s*\)/i) ?? value.match(/\b(\d{4})\s*A\.?D\.?/i);
    if (!m) return undefined;
    const year = Number.parseInt(m[1], 10);
    if (year < 1000 || year > 1920) return undefined;
    const saka = value.match(/[śs]aka\s+(\d{3,4})/i);
    return { year, saka: saka ? Number.parseInt(saka[1], 10) : undefined };
  }
  return undefined;
}

function valueText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { name?: unknown }).name === 'string'
  ) {
    return (value as { name: string }).name;
  }
  return undefined;
}

/** A place: the bracketed gloss and a trailing district dropped, and nothing that is a sentence. */
export function cleanPlace(raw: string): string | undefined {
  const place = raw
    .replace(/\s*\([^)]*\)/g, '')
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .trim();
  if (place.length < 2 || place.length > 60) return undefined;
  if (/\d/.test(place)) return undefined;
  if (place.split(/\s+/).length > 5) return undefined;
  if (/^(a|an|the|said|unknown|north|south)\b/i.test(place)) return undefined;
  return place;
}

/** A work's title, or undefined when the value is the translators' description of it. */
export function cleanWorkTitle(raw: string): string | undefined {
  const title = raw
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/,\s*(printed\s*)?(\d{4}|author.*|publisher.*)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.length < 3 || title.length > 80) return undefined;
  if (title.split(/\s+/).length > 6) return undefined;
  if (/^(a|an|the|his|her)\s/i.test(title)) return undefined;
  if (
    /\b(set in|dedicated|translation|commentary|kīrtanas|kirtanas|tamil|telugu|title|book|with)\b/i.test(
      title
    )
  ) {
    return undefined;
  }
  if (/[,;:]/.test(title)) return undefined;
  return title === title.toLowerCase() ? titleCase(title) : title;
}

function flatten(values: unknown[] | undefined): unknown[] {
  const out: unknown[] = [];
  for (const v of values ?? []) {
    if (Array.isArray(v)) out.push(...flatten(v));
    else out.push(v);
  }
  return out;
}

// ── locators ──────────────────────────────────────────────────────────────────────────────

/** `Vol. 5, p. 24`, `Vol. 5, pp. 24–25`, `Vol. 5, pp. 19, 24`, or `Vol. 5` when no page is known. */
export function sspPeopleLocator(volume: number, pages: readonly number[]): string {
  const nums = [...new Set(pages.filter(p => Number.isFinite(p)))].sort((a, b) => a - b);
  if (nums.length === 0) return `Vol. ${volume}`;
  if (nums.length === 1) return `Vol. ${volume}, p. ${nums[0]}`;
  const lo = nums[0];
  const hi = nums[nums.length - 1];
  if (hi - lo === nums.length - 1 || nums.length > 6) return `Vol. ${volume}, pp. ${lo}–${hi}`;
  return `Vol. ${volume}, pp. ${nums.join(', ')}`;
}

// ── scope ─────────────────────────────────────────────────────────────────────────────────

/** Vol 5 keys that mark a person as more than a name in a list: a musician with facts. */
const MUSICIAN_KEYS = [
  'birth_date',
  'death_date',
  'death_year_ce',
  'composition_forms',
  'composed_forms',
  'forms_composed',
  'composition_language',
  'language_of_compositions',
  'works',
];

const BIO_KEYS = [
  'vc_section',
  'section_number',
  'biography_section_number',
  'vaggeyakara_caritram_section',
  'vaggeyakara_caritram_entry_number',
];

const NOT_A_PERSON =
  /edward|victoria|anjaneya|kumbhakarna|asvatara|sankaracarya|alvar|sivaramapuram|purvika|pracina/;

const RULER_ROLE = /king|ruler|emperor|raja|mahārāja|maharaja|nāyaka|nayaka|zamindar|chief/i;

/** Rulers who composed or wrote; everyone else of that rank is a patron and is skipped. */
const COMPOSER_RULER_KEYS = new Set(['tulaja', 'sahaji', 'raghunatha nayaka'].map(sspNameKey));

/** Pairs SSP's review flagged that are different people. Neither side joins the other. */
const KEEP_APART_PAIRS: readonly [string, string][] = [
  ['Bālayya', 'Gōpālayya'],
  ['Ghanam Kṛṣṇayya', 'Ghanam Sīnayya'],
  ['S. Rādhākṛṣṇayya', 'S. Rāmakṛṣṇayya'],
];

/** Two names SSP uses for one man (Vol 4 calls Tyāgarāja "Tyāgarājasvāmi" in a heading). */
const SAME_PERSON_PAIRS: readonly [string, string][] = [['Tyāgarāja', 'Tyāgarājasvāmi']];

/** "VC §67" names a section of the biographies. It does not tell this man from another. */
function isSectionQualifier(qualifier: string): boolean {
  return /^VC\s*§/.test(qualifier);
}

/** The two Eṭṭēndra rulers share a name. They join on an identical key only. */
function isEttendra(key: string): boolean {
  return /\betendra\b/.test(key);
}

// ── build ─────────────────────────────────────────────────────────────────────────────────

interface Row {
  volume: number;
  row: SspArtistRow;
  base: string;
  qualifier?: string;
  key: string;
  ik: string;
  variantKeys: string[];
  input: SspVolumeInput;
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    let r = i;
    while (this.parent[r] !== r) r = this.parent[r];
    let c = i;
    while (this.parent[c] !== r) {
      const next = this.parent[c];
      this.parent[c] = r;
      c = next;
    }
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

function printedPageOf(
  input: SspVolumeInput,
  pdfPage: number,
  source?: { printed_page?: number | null }
): number | undefined {
  if (typeof source?.printed_page === 'number') return source.printed_page;
  const entry = input.printedPages?.[String(pdfPage)];
  const printed = typeof entry === 'number' ? entry : entry?.printed_page;
  return typeof printed === 'number' ? printed : undefined;
}

function sectionPages(input: SspVolumeInput, sections: string[] | undefined): number[] {
  const out: number[] = [];
  for (const s of sections ?? []) {
    const m = s.match(/^page-(\d+)$/);
    if (!m) continue;
    const printed = printedPageOf(input, Number.parseInt(m[1], 10));
    if (printed !== undefined) out.push(printed);
  }
  return out;
}

function rowPages(r: Row): number[] {
  const out: number[] = [];
  for (const s of r.row.all_sources ?? []) {
    if (typeof s.page !== 'number') continue;
    const printed = printedPageOf(r.input, s.page, s);
    if (printed !== undefined) out.push(printed);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

const PLACE_KEYS = {
  birth: ['birth_place', 'birthplace', 'native_place'],
  death: ['death_place'],
};

export function buildSspPeople(volumes: readonly SspVolumeInput[]): SspPeopleResult {
  const rows: Row[] = [];
  for (const input of volumes) {
    for (const row of input.artists) {
      const { base, qualifier } = splitQualifier(row.name_canonical);
      const key = sspNameKey(base);
      const variantKeys = (row.name_variants_seen ?? [])
        .filter(v => usableVariant(v, base) !== null && !splitQualifier(v).qualifier)
        .map(v => sspNameKey(v))
        .filter(k => k && k !== key);
      rows.push({
        volume: input.volume,
        row,
        base,
        qualifier,
        key,
        ik: qualifier ? `${key}|${ascii(qualifier).replace(/[^a-z0-9§]/g, '')}` : key,
        variantKeys,
        input,
      });
    }
  }

  const uf = new UnionFind(rows.length);
  const byIk = new Map<string, number[]>();
  rows.forEach((r, i) => byIk.set(r.ik, [...(byIk.get(r.ik) ?? []), i]));
  for (const idx of byIk.values()) for (const i of idx.slice(1)) uf.union(idx[0], i);

  const apart = new Set<string>();
  for (const [a, b] of KEEP_APART_PAIRS) {
    apart.add(`${sspNameKey(a)}\u0001${sspNameKey(b)}`);
    apart.add(`${sspNameKey(b)}\u0001${sspNameKey(a)}`);
  }
  const unqualifiedByKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (r.qualifier) return;
    unqualifiedByKey.set(r.key, [...(unqualifiedByKey.get(r.key) ?? []), i]);
  });

  // SSP's own review rows: the spelling variants, but not the pairs known to be two people.
  for (const input of volumes) {
    for (const review of input.reviews ?? []) {
      if (review.kind !== 'possible_same_person' || !Array.isArray(review.detail)) continue;
      const [na, nb] = review.detail.map(String);
      if (!na || !nb || splitQualifier(na).qualifier || splitQualifier(nb).qualifier) continue;
      const ka = sspNameKey(na);
      const kb = sspNameKey(nb);
      if (!ka || !kb || ka === kb || apart.has(`${ka}\u0001${kb}`)) continue;
      if (isEttendra(ka) || isEttendra(kb)) continue;
      for (const i of unqualifiedByKey.get(ka) ?? [])
        for (const j of unqualifiedByKey.get(kb) ?? []) uf.union(i, j);
    }
  }

  for (const [a, b] of SAME_PERSON_PAIRS) {
    for (const i of unqualifiedByKey.get(sspNameKey(a)) ?? [])
      for (const j of unqualifiedByKey.get(sspNameKey(b)) ?? []) uf.union(i, j);
  }

  // A variant spelling that is exactly one other person's name.
  const notes = new Map<number, string[]>();
  rows.forEach((r, i) => {
    if ((r.qualifier && !isSectionQualifier(r.qualifier)) || isEttendra(r.key)) return;
    for (const vk of r.variantKeys) {
      if (isEttendra(vk) || apart.has(`${r.key}\u0001${vk}`)) continue;
      const targets = unqualifiedByKey.get(vk) ?? [];
      const components = new Set(targets.map(t => uf.find(t)));
      components.delete(uf.find(i));
      if (components.size === 1 && (vk.includes(' ') || !r.key.includes(' '))) {
        for (const t of targets) uf.union(i, t);
      } else if (components.size > 1) {
        notes.set(i, [...(notes.get(i) ?? []), `variant "${vk}" names several people; not joined`]);
      }
    }
  });

  // Row lookup for relationship endpoints: the merged id and every id merged into it.
  const rowById = new Map<string, number>();
  rows.forEach((r, i) => {
    const vol = r.volume;
    rowById.set(r.row.merged_provisional_id, i);
    for (const id of r.row.merged_from_provisional_ids ?? []) {
      if (!rowById.has(id)) rowById.set(id, i);
    }
    void vol;
  });

  const components = new Map<number, number[]>();
  rows.forEach((_, i) => {
    const root = uf.find(i);
    components.set(root, [...(components.get(root) ?? []), i]);
  });

  // Composed-by edges: distinct compositions per person, Vols 1–4 (and Vol 5 as evidence).
  const composedBy = new Map<number, Set<string>>();
  const vol5Evidence = new Set<number>();
  for (const input of volumes) {
    for (const rel of input.relationships) {
      if (rel.type !== 'composed_by' && rel.type !== 'composer_of') continue;
      const personId = rel.type === 'composed_by' ? rel.to : rel.from;
      const workId = rel.type === 'composed_by' ? rel.from : rel.to;
      const idx = rowById.get(personId);
      if (idx === undefined) continue;
      const root = uf.find(idx);
      if (input.volume <= 4) {
        const set = composedBy.get(root) ?? new Set<string>();
        set.add(`${input.volume}:${workId}`);
        composedBy.set(root, set);
      } else {
        vol5Evidence.add(root);
      }
    }
  }

  const people: SspPerson[] = [];
  const skipped: SspSkipped[] = [];
  const usedKeys = new Map<string, number>();
  const keyOfRoot = new Map<number, string>();
  const personOfRoot = new Map<number, SspPerson>();
  const idSet = new Map<number, number[]>(components);

  // First pass: decide scope and facts for every component.
  const staged: { root: number; person: SspPerson }[] = [];
  for (const [root, idx] of components) {
    const members = idx.map(i => rows[i]).sort((a, b) => b.volume - a.volume);
    const names = members.map(m => m.base);
    const vols = [...new Set(members.map(m => m.volume))].sort();
    const attrs = (k: string) =>
      members.flatMap(m =>
        m.row.attributes_consolidated?.[k]
          ? [{ member: m, entry: m.row.attributes_consolidated[k] }]
          : []
      );

    const rolesSeen = [...new Set(members.flatMap(m => m.row.roles_seen ?? []))];
    const composedCount = composedBy.get(root)?.size ?? 0;
    const composerRole = members.some(
      m => m.volume <= 4 && (m.row.roles_seen ?? []).includes('composer')
    );
    const bio =
      members.some(m => m.volume === 5) &&
      (BIO_KEYS.some(k => attrs(k).some(a => a.member.volume === 5)) ||
        attrs('mudra').some(a => a.member.volume === 5) ||
        MUSICIAN_KEYS.some(k => attrs(k).some(a => a.member.volume === 5)) ||
        COMPOSER_RULER_KEYS.has(sspNameKey(pickIastName(members))) ||
        vol5Evidence.has(root));

    const display = pickIastName(members);
    const plainKey = sspNameKey(display);
    const label = display;

    if (/\//.test(display)) {
      skipped.push({ name: label, volumes: vols, reason: 'two people in one name' });
      continue;
    }
    if (NOT_A_PERSON.test(ascii(display))) {
      skipped.push({
        name: label,
        volumes: vols,
        reason: 'not a person (deity, place, group or royal)',
      });
      continue;
    }

    const roleTexts = flatten(attrs('role').flatMap(a => a.entry.values)).concat(
      flatten(attrs('roles').flatMap(a => a.entry.values))
    );
    const isRuler = roleTexts.some(r => typeof r === 'string' && RULER_ROLE.test(r));
    const musicEvidence =
      composedCount > 0 ||
      composerRole ||
      vol5Evidence.has(root) ||
      attrs('mudra').length > 0 ||
      attrs('works').length > 0 ||
      attrs('composed_forms').length > 0 ||
      attrs('composition_forms').length > 0;

    if (!composerRole && composedCount === 0 && !bio) {
      skipped.push({ name: label, volumes: vols, reason: 'not a composer and no Vol 5 biography' });
      continue;
    }
    if (isRuler && !musicEvidence && !COMPOSER_RULER_KEYS.has(plainKey)) {
      skipped.push({ name: label, volumes: vols, reason: 'ruler who composed nothing' });
      continue;
    }

    const person = stagePerson({
      members,
      display,
      attrs,
      composedCount,
      vols,
      composerEvidence: composerRole || composedCount > 0,
      bio,
      rolesSeen,
      roleTexts,
      notes: members.flatMap(m => notes.get(rows.indexOf(m)) ?? []),
    });
    // A unique key per person, even when two are kept apart under one spelling.
    const n = (usedKeys.get(person.key) ?? 0) + 1;
    usedKeys.set(person.key, n);
    if (n > 1) person.key = `${person.key}~${n}`;
    keyOfRoot.set(root, person.key);
    personOfRoot.set(root, person);
    staged.push({ root, person });
  }
  void idSet;

  // Gurus, from disciple_of / guru_of / initiated_by.
  let guruEdges = 0;
  let unresolved = 0;
  const seenEdge = new Set<string>();
  const guruCitations = new Map<string, SspPersonCitation[]>();
  for (const input of volumes) {
    for (const rel of input.relationships) {
      if (rel.type !== 'disciple_of' && rel.type !== 'guru_of' && rel.type !== 'initiated_by')
        continue;
      const [discipleId, guruId] = rel.type === 'guru_of' ? [rel.to, rel.from] : [rel.from, rel.to];
      const di = rowById.get(discipleId);
      const gi = rowById.get(guruId);
      if (di === undefined || gi === undefined) {
        if (di !== undefined) unresolved++;
        continue;
      }
      const dRoot = uf.find(di);
      const gRoot = uf.find(gi);
      if (dRoot === gRoot) continue;
      const disciple = personOfRoot.get(dRoot);
      if (!disciple) continue;
      guruEdges++;
      const guruPerson = personOfRoot.get(gRoot);
      const gMembers = (components.get(gRoot) ?? []).map(i => rows[i]);
      const guruIast = guruPerson?.iastName ?? pickIastName(gMembers);
      const edgeKey = `${disciple.key}\u0001${sspNameKey(guruIast)}`;
      const quotes = (rel.verbatim_quotes ?? []).map(q => q.quote ?? '').join(' ');
      const spiritual =
        rel.type === 'initiated_by' ||
        /initiat|mantra|upadē|upade|saint|yōgi|yogi|sannyās|ascetic|philosoph/i.test(quotes);
      const pages = (rel.supporting_pages ?? [])
        .map(p => printedPageOf(input, p))
        .filter((p): p is number => p !== undefined);
      if (seenEdge.has(edgeKey)) {
        const existing = disciple.gurus.find(g => sspNameKey(g.iastName) === sspNameKey(guruIast));
        if (existing && spiritual) existing.spiritual = true;
        continue;
      }
      seenEdge.add(edgeKey);
      const edge: SspGuruEdge = {
        guruKey: guruPerson?.key,
        name: searchedSpelling(guruIast),
        iastName: guruIast,
        spiritual,
      };
      disciple.gurus.push(edge);
      const list = guruCitations.get(disciple.key) ?? [];
      list.push({
        field: 'gurus',
        sourceSlug: SSP_SOURCE_SLUG,
        locator: sspPeopleLocator(input.volume, pages),
        note: edge.name,
      });
      guruCitations.set(disciple.key, list);
    }
  }

  let citationsDropped = 0;
  for (const { person } of staged) {
    person.citations.push(...(guruCitations.get(person.key) ?? []));
    if (person.citations.length > 100) {
      citationsDropped += person.citations.length - 100;
      person.notes.push(`${person.citations.length - 100} citations dropped (the list holds 100)`);
      person.citations = person.citations.slice(0, 100);
    }
    people.push(person);
  }

  people.sort((a, b) => b.composedCount - a.composedCount || a.name.localeCompare(b.name, 'en'));
  return {
    people,
    skipped,
    stats: {
      rows: rows.length,
      components: components.size,
      guruEdges,
      guruEdgesUnresolved: unresolved,
      citationsDropped,
    },
  };
}

function pickIastName(members: Row[]): string {
  const counts = new Map<string, { n: number; vol: number; name: string }>();
  for (const m of members) {
    const k = m.base;
    const c = counts.get(k) ?? { n: 0, vol: 0, name: k };
    c.n++;
    c.vol = Math.max(c.vol, m.volume);
    counts.set(k, c);
  }
  return [...counts.values()].sort(
    (a, b) =>
      b.n - a.n ||
      b.vol - a.vol ||
      (b.name.match(/\p{M}/gu)?.length ?? 0) - (a.name.match(/\p{M}/gu)?.length ?? 0)
  )[0].name;
}

interface StageInput {
  members: Row[];
  display: string;
  attrs: (k: string) => { member: Row; entry: { values?: unknown[]; sections?: string[] } }[];
  composedCount: number;
  vols: number[];
  composerEvidence: boolean;
  bio: boolean;
  rolesSeen: string[];
  roleTexts: unknown[];
  notes: string[];
}

function stagePerson(s: StageInput): SspPerson {
  const { members, display, attrs } = s;
  const citations: SspPersonCitation[] = [];
  const notes = [...s.notes];
  const facts: SspPersonFacts = { works: [] };

  const cite = (
    field: string,
    member: Row,
    entry: { sections?: string[] } | undefined,
    note?: string
  ) => {
    let pages = sectionPages(member.input, entry?.sections);
    if (pages.length === 0) pages = rowPages(member).slice(0, 3);
    citations.push({
      field,
      sourceSlug: SSP_SOURCE_SLUG,
      locator: sspPeopleLocator(member.volume, pages),
      ...(note ? { note } : {}),
    });
  };

  // Years: the first absolute one, highest volume first. A second, different year is noted.
  const yearFrom = (keys: string[]) => {
    const found: { year: number; saka?: number; member: Row; entry: { sections?: string[] } }[] =
      [];
    for (const k of keys) {
      for (const { member, entry } of attrs(k)) {
        for (const v of flatten(entry.values)) {
          const y = parseSspYear(v);
          if (y) found.push({ ...y, member, entry });
        }
      }
    }
    return found;
  };
  const births = yearFrom(['birth_date']);
  if (births[0]) {
    facts.birthYear = births[0].year;
    cite(
      'birthYear',
      births[0].member,
      births[0].entry,
      births[0].saka ? `śaka ${births[0].saka}` : undefined
    );
    if (births.some(b => b.year !== births[0].year))
      notes.push('birth years disagree between volumes');
  }
  const deaths = yearFrom(['death_date', 'death_year_ce']);
  if (deaths[0]) {
    facts.deathYear = deaths[0].year;
    cite(
      'deathYear',
      deaths[0].member,
      deaths[0].entry,
      deaths[0].saka ? `śaka ${deaths[0].saka}` : undefined
    );
    if (deaths.some(d => d.year !== deaths[0].year))
      notes.push('death years disagree between volumes');
  }

  const placeFrom = (keys: string[]) => {
    for (const k of keys) {
      for (const { member, entry } of attrs(k)) {
        for (const v of flatten(entry.values)) {
          const text = valueText(v);
          const place = text ? cleanPlace(text) : undefined;
          if (place) return { place, member, entry };
        }
      }
    }
    return undefined;
  };
  const bp = placeFrom(PLACE_KEYS.birth);
  if (bp) {
    facts.birthPlace = bp.place;
    cite('birthPlace', bp.member, bp.entry);
  }
  const dp = placeFrom(PLACE_KEYS.death);
  if (dp) {
    facts.deathPlace = dp.place;
    cite('deathPlace', dp.member, dp.entry);
  }

  const mudras = attrs('mudra');
  for (const { member, entry } of mudras) {
    const first = flatten(entry.values).find(v => typeof v === 'string' && v.trim().length > 0);
    if (typeof first === 'string') {
      const mudra = first
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (mudra && mudra.length <= 60) {
        facts.mudra = mudra;
        cite('mudra', member, entry);
        const others = new Set(
          mudras
            .flatMap(m => flatten(m.entry.values))
            .filter((v): v is string => typeof v === 'string')
            .map(v => ascii(v).trim())
        );
        if (others.size > 1) notes.push('more than one mudra given; the first is used');
        break;
      }
    }
  }

  const seenWork = new Set<string>();
  for (const k of ['works', 'work', 'publication']) {
    for (const { member, entry } of attrs(k)) {
      for (const v of flatten(entry.values)) {
        const title = typeof v === 'string' ? cleanWorkTitle(v) : undefined;
        if (!title) continue;
        const wk = ascii(title)
          .replace(/[^a-z]/g, '')
          .replace(/(.)\1+/g, '$1');
        if (seenWork.has(wk)) continue;
        seenWork.add(wk);
        facts.works.push(title);
        cite('works', member, entry, title);
      }
    }
  }

  const name = searchedSpelling(display);
  const alt = new Map<string, string>();
  const addAlt = (v: string) => {
    const k = ascii(v).replace(/\s+/g, ' ').trim();
    if (!alt.has(k) && k !== ascii(name)) alt.set(k, v);
  };
  addAlt(display);
  for (const m of s.members) {
    for (const v of m.row.name_variants_seen ?? []) {
      if (splitQualifier(v).qualifier) continue;
      const clean = usableVariant(v, display);
      if (clean) addAlt(clean);
    }
    const base = m.base;
    if (!m.qualifier && usableVariant(base, display)) addAlt(base);
  }
  const alternateNames = [...alt.values()].slice(0, 50);
  if (alternateNames.length > 0) {
    const m = s.members[0];
    citations.push({
      field: 'alternateNames',
      sourceSlug: SSP_SOURCE_SLUG,
      locator: sspPeopleLocator(m.volume, rowPages(m).slice(0, 3)),
    });
  }

  const qualifier = s.members.find(m => m.qualifier)?.qualifier;
  const roles = [
    ...new Set([
      ...s.rolesSeen,
      ...s.roleTexts.filter((r): r is string => typeof r === 'string').slice(0, 3),
    ]),
  ];

  return {
    key: s.members.find(m => m.base === display)?.ik ?? s.members[0].ik,
    name,
    iastName: display,
    ...(qualifier ? { qualifier } : {}),
    alternateNames,
    facts,
    citations,
    gurus: [],
    composedCount: s.composedCount,
    volumes: s.vols,
    sspIds: s.members.map(m => m.row.merged_provisional_id),
    scope: s.composerEvidence && s.bio ? 'both' : s.composerEvidence ? 'composer' : 'biography',
    roles,
    notes,
  };
}

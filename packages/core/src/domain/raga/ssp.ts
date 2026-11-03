/**
 * Subbarāma Dīkṣita's Sangīta Sampradāya Pradarśini (English edition, 2008) as raga facts.
 *
 * One pure function turns a rasika-books extraction record into a patch for the stored raga,
 * the citations that back it, the items held for a person, and notes for the report. It reads no
 * database and writes nothing. Plan: `docs/plans/261103-01-ssp-import.md`; field map:
 * `docs/research/ssp-import-gap-2026-11/gap-ragas.md`.
 *
 * Rules, each with a reason:
 *
 * - **Fill-only.** SSP writes a field when the stored value is empty or has no citation for it.
 *   A field that already has a citation is never touched. Never `arohanam`, `avarohanam`,
 *   `description`, `parentRaga` or `melaNumber`.
 * - **No prose.** The edition's English is under licence (facts only). `other_facts`,
 *   `historical_notes`, `editor_notes`, `anya_swaras[].rules`, `gamaka_rules` and
 *   `verbatim_quote` never enter the patch. `sspMovementFacts` returns them as input for a
 *   later writing pass in our own words; nothing there is stored.
 * - **Hold, never guess.** An item flagged `variant_uncertain` or `text_vs_image_conflict`, an
 *   ambiguous yāma, a pōḍi or modernist phrase, and anything a validator refuses goes to
 *   `held` with a reason.
 *
 * Browser-safe and pure.
 */

import { validateSwaras } from '../../admin/research';
import { SWARA_SEMITONES, parseSwaraSet, swarasOutsideRaga, validatePhrase } from './notation';
import { SCALE_TYPES } from './schema';
import { type Citation, type StoredCitation, isEmptyValue } from './sourced';

export const SSP_SOURCE_SLUG = 'ssp-2008-english';
/** The Tamil edition. Where it already cites a field, the English citation joins it. */
export const SSP_TAMIL_SLUG = 'ssp-1963-tamil';

/** Prayogas kept per raga. The schema cap is 50. */
export const SSP_MAX_PRAYOGAS = 50;
const MAX_SLOKAS = 5;
const DIKSHITAR_SCHOOL = 'Dikshitar school';
const VENKATAMAKHI = 'Venkatamakhi';

// ── input and output shapes ───────────────────────────────────────────────────────────────

interface SspSourceEntry {
  field: string;
  page?: number;
  printed_page?: number;
  confidence?: number;
}

interface SspPrayoga {
  label?: string | null;
  notation?: string | null;
  gamaka_raw?: string | null;
  printed_page?: number | null;
  confidence?: number | null;
  octave_unmarked?: boolean;
  variant_uncertain?: boolean;
  variant_note?: unknown;
  podi_swaras?: unknown[] | null;
  notation_modernist?: unknown;
}

interface SspAnya {
  swara?: string | null;
  phrases?: string[] | null;
  variant_uncertain?: boolean;
}

interface SspAltMurcchana {
  arohana?: string | null;
  avarohana?: string | null;
  printed_page?: number | null;
  confidence?: number | null;
}

interface SspMurcchana {
  arohana?: string | null;
  avarohana?: string | null;
  printed_page?: number | null;
  confidence?: number | null;
  variant_uncertain?: boolean;
  alternate_murcchanas?: SspAltMurcchana[] | null;
  alternate_murcchana?: unknown;
  alternates?: unknown;
  second_murcchana?: SspAltMurcchana | null;
  arohana_alternatives?: unknown;
  arohana_alternate?: unknown;
}

interface SspSloka {
  author?: string | null;
  text_iast?: string | null;
  attributed_to?: string | null;
  printed_page?: number | null;
  facts?: { time_of_day?: string | null; scale_type?: string | null } | null;
}

interface SspLakshana {
  raga_class?: string | null;
  scale_type?: string | null;
  graha_swaras?: string[] | null;
  time_of_day?: string | null;
  jiva_swaras?: { all?: string[] | null; most_ranjaka?: string[] | null } | null;
  nyasa_swaras?: { all?: string[] | null; most_ranjaka?: string[] | null } | null;
  anya_swaras?: SspAnya[] | null;
  prayogas?: SspPrayoga[] | null;
  gamaka_rules?: { where?: string | null; gamaka?: string | null; page?: number }[] | null;
  other_facts?: { fact?: string; page?: number }[] | null;
  sources?: (SspSourceEntry & { verbatim_quote?: string | null })[] | null;
}

/** One line of `entities/ragas.jsonl`. */
export interface SspRagaRecord {
  merged_provisional_id: string;
  name_canonical: string;
  kind?: string | null;
  janya_class?: string | null;
  mela_number?: number | null;
  mela_swaras?: string[] | null;
  printed_pages?: number[] | null;
  sloka?: SspSloka | null;
  murcchana?: SspMurcchana | null;
  lakshana?: SspLakshana | null;
  historical_notes?: { fact?: string; page?: number }[] | null;
  editor_notes?: { fact?: string; page?: number }[] | null;
}

/** One line of the run's `review.jsonl`. */
export interface SspReviewRow {
  section_id?: string;
  kind: string;
  detail?: unknown;
  path?: string | null;
}

export interface SspStoredRaga {
  arohanam?: string | null;
  avarohanam?: string | null;
  alternateScales?: string[] | null;
  timeOfDay?: string | null;
  scaleType?: string | null;
  isBhashanga?: boolean | null;
  prayogas?: unknown[] | null;
  jivaSwaras?: string[] | null;
  nyasaSwaras?: string[] | null;
  grahaSwaras?: string[] | null;
  anyaSwaras?: string[] | null;
  slokas?: unknown[] | null;
  citations?: StoredCitation[] | null;
}

export type SspField =
  | 'alternateScales'
  | 'timeOfDay'
  | 'scaleType'
  | 'isBhashanga'
  | 'prayogas'
  | 'jivaSwaras'
  | 'nyasaSwaras'
  | 'grahaSwaras'
  | 'anyaSwaras'
  | 'slokas';

export type SspTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'universal';

export interface SspPrayogaOut {
  notation: string;
  label?: string;
  gamaka?: string;
}

export interface SspSlokaOut {
  text: string;
  author?: string;
}

export interface SspPatch {
  alternateScales?: string[];
  timeOfDay?: SspTimeOfDay;
  scaleType?: (typeof SCALE_TYPES)[number];
  isBhashanga?: boolean;
  prayogas?: SspPrayogaOut[];
  jivaSwaras?: string[];
  nyasaSwaras?: string[];
  grahaSwaras?: string[];
  anyaSwaras?: string[];
  slokas?: SspSlokaOut[];
}

/** `CitationSchema` with the `slokas` field the other agent is adding. */
export type SspCitation = Omit<Citation, 'field'> & { field: Citation['field'] | 'slokas' };

export interface SspHeld {
  field: SspField;
  value: unknown;
  reason: string;
}

export interface SspResult {
  patch: SspPatch;
  citations: SspCitation[];
  held: SspHeld[];
  notes: string[];
}

export interface SspInput {
  record: SspRagaRecord;
  /** Review rows for this raga. Rows naming another section are ignored. */
  reviews?: SspReviewRow[];
  volume: number;
  stored?: SspStoredRaga;
}

// ── small helpers ───────────────────────────────────────────────────────────────────────────

function ascii(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** `Vol. 1, p. 390` or `Vol. 1, pp. 390–391`, from printed page numbers. */
export function sspLocator(volume: number, pages: readonly number[]): string {
  const nums = pages.filter(p => Number.isFinite(p));
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo === hi ? `Vol. ${volume}, p. ${lo}` : `Vol. ${volume}, pp. ${lo}–${hi}`;
}

const minOf = (nums: (number | null | undefined)[]): number | undefined => {
  const real = nums.filter((n): n is number => typeof n === 'number');
  return real.length > 0 ? Math.min(...real) : undefined;
};

/** Does the English value say what the stored one says? A bare stored letter matches any variant. */
function agreesWithStored(
  field: SspField,
  value: unknown,
  stored: SspStoredRaga | undefined
): boolean {
  const have = stored?.[field];
  if (field === 'prayogas') {
    const a = ((value as SspPrayogaOut[]) ?? []).map(p => p.notation).join('/');
    const b = ((have as { notation?: string }[]) ?? []).map(p => p.notation).join('/');
    return a === b;
  }
  if (field === 'slokas') {
    const a = ((value as SspSlokaOut[]) ?? []).map(p => p.text).join('/');
    const b = ((have as { text?: string }[]) ?? []).map(p => p.text).join('/');
    return a === b;
  }
  if (Array.isArray(value)) {
    const mine = value as string[];
    const theirs = Array.isArray(have) ? (have as string[]) : [];
    const same = (a: string, b: string) => a === b || (b.length === 1 && a[0] === b);
    return (
      mine.length === theirs.length &&
      mine.every(t => theirs.some(h => same(t, h))) &&
      theirs.every(h => mine.some(t => same(t, h)))
    );
  }
  return value === have;
}

function isCitedField(stored: SspStoredRaga | undefined, field: string): boolean {
  return (stored?.citations ?? []).some(c => c.field === field);
}

const COUNT_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

// ── time of day ───────────────────────────────────────────────────────────────────────────

const TIME_TABLE: Readonly<Record<string, SspTimeOfDay>> = {
  'all times': 'universal',
  evening: 'evening',
  'evening dusk': 'evening',
  dusk: 'evening',
  'end of day': 'evening',
  'last yama of the day': 'evening',
  'fourth quarter of the day': 'evening',
  'early morning': 'morning',
  'early dawn': 'morning',
  dawn: 'morning',
  morning: 'morning',
  'first yama of the day': 'morning',
  afternoon: 'afternoon',
  'mid-afternoon': 'afternoon',
  midday: 'afternoon',
  night: 'night',
  'fourth quarter of the night': 'night',
  'first yama of the night': 'night',
  'early part of the night': 'night',
};

/** "first yāma", "fifth yāma (bāṇa yāma)": a yāma with no side of the day named. */
const AMBIGUOUS_YAMA = /^(first|second|third|fourth|fifth|sixth|seventh|eighth) yama( \(.*\))?$/;

export type SspTimeMapping =
  | { ok: true; value: SspTimeOfDay }
  | { ok: false; reason: 'ambiguous' | 'unmapped' };

/** The closed table. Anything outside it is held, never defaulted. */
export function mapSspTimeOfDay(raw: string | null | undefined): SspTimeMapping {
  const key = ascii(String(raw ?? ''));
  const hit = TIME_TABLE[key];
  if (hit) return { ok: true, value: hit };
  return { ok: false, reason: AMBIGUOUS_YAMA.test(key) ? 'ambiguous' : 'unmapped' };
}

// ── scale lines ───────────────────────────────────────────────────────────────────────────

export interface CleanLine {
  ok: boolean;
  value?: string;
  reason?: string;
}

/**
 * A murcchana line as stored: octave marks and `|` breaks dropped, single-spaced. Unlike
 * `validateSwaras` it allows a line with no S (five ragas open on R); a line that does hold an S
 * goes through `validateSwaras` itself, which is not loosened.
 */
export function cleanMurcchanaLine(raw: string | null | undefined): CleanLine {
  const tokens = String(raw ?? '')
    .replace(/\|/g, ' ')
    .replace(/['`.]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 3)
    return { ok: false, reason: `only ${tokens.length} token(s); not a scale` };
  const bad = tokens.filter(t => !(t in SWARA_SEMITONES));
  if (bad.length > 0)
    return { ok: false, reason: `not swara notation: ${bad.slice(0, 3).join(' ')}` };
  const line = tokens.join(' ');
  if (!tokens.includes('S')) return { ok: true, value: line };
  const checked = validateSwaras(line);
  return checked.ok ? { ok: true, value: checked.value } : { ok: false, reason: checked.reason };
}

/** Tokens of a scale or an alternateScales half, for comparing. Leading "(10 name janya)" dropped. */
function compareKey(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/^\s*\([^)]*\)\s*/, '')
    .replace(/['`.|]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function entryKey(entry: string): string {
  const [asc, ...rest] = entry.split(' - ');
  return `${compareKey(asc)} - ${compareKey(rest.join(' - '))}`;
}

// ── review rows ───────────────────────────────────────────────────────────────────────────

const PRAYOGA_PATH = /^lakshana\.prayogas\[(\d+)\]$/;
const ANYA_PATH = /^lakshana\.anya_swaras\[(\d+)\]$/;

function textOf(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return '';
}

/** Which field a `text_vs_image_conflict` names. It carries no path, so this reads the words. */
function fieldsNamedBy(detail: unknown): (SspField | 'all')[] {
  if (detail && typeof detail === 'object') {
    const f = (detail as { field?: unknown }).field;
    if (f === 'all') return ['all'];
    if (f === 'prayogas') return ['prayogas'];
  }
  const text = textOf(detail);
  const out: SspField[] = [];
  if (/śloka|sloka/i.test(text)) out.push('slokas');
  if (/ārōhaṇa|avarōhaṇa|mūrcchana|murcchana|arohana/i.test(text)) out.push('alternateScales');
  if (out.length === 0) out.push('prayogas');
  return out;
}

// ── the main function ───────────────────────────────────────────────────────────────────────

export function buildSspRagaPatch(input: SspInput): SspResult {
  const { record, volume } = input;
  const stored = input.stored;
  const lakshana = record.lakshana ?? {};
  const murcchana = record.murcchana ?? null;
  const reviews = (input.reviews ?? []).filter(
    r => !r.section_id || r.section_id === record.merged_provisional_id
  );

  const patch: SspPatch = {};
  const citations: SspCitation[] = [];
  const held: SspHeld[] = [];
  const notes: string[] = [];

  // review gates
  const variantPrayogas = new Set<number>();
  const variantAnya = new Set<number>();
  const unmarkedPrayogas = new Set<number>();
  let variantMurcchana = Boolean(murcchana?.variant_uncertain);
  const fieldHolds = new Map<SspField | 'all', string>();
  for (const row of reviews) {
    const path = row.path ?? '';
    if (row.kind === 'variant_uncertain') {
      const p = PRAYOGA_PATH.exec(path);
      const a = ANYA_PATH.exec(path);
      if (p) variantPrayogas.add(Number(p[1]));
      else if (a) variantAnya.add(Number(a[1]));
      else if (path === 'murcchana') variantMurcchana = true;
    } else if (row.kind === 'octave_unmarked') {
      const p = PRAYOGA_PATH.exec(path);
      if (p) unmarkedPrayogas.add(Number(p[1]));
    } else if (row.kind === 'text_vs_image_conflict') {
      for (const field of fieldsNamedBy(row.detail)) {
        if (!fieldHolds.has(field)) {
          fieldHolds.set(field, 'text_vs_image_conflict: the page text and image disagree');
        }
      }
    }
  }
  const holdFor = (field: SspField): string | undefined =>
    fieldHolds.get(field) ??
    (fieldHolds.has('all') ? 'text_vs_image_conflict: values read from the image only' : undefined);

  const writable = (field: SspField): boolean =>
    isEmptyValue(stored?.[field]) || !isCitedField(stored, field);

  // page and confidence for a field, from the lakshana `sources` entries
  const sources = lakshana.sources ?? [];
  const sourceInfo = (...names: string[]) => {
    const entries = sources.filter(s => names.includes(s.field));
    const pages = entries
      .map(s => s.printed_page)
      .filter((p): p is number => typeof p === 'number');
    return { pages, confidence: minOf(entries.map(s => s.confidence)) };
  };
  const recordPages = (record.printed_pages ?? []).filter(p => Number.isFinite(p));
  const locatorFrom = (pages: number[], field: string): string => {
    if (pages.length > 0) return sspLocator(volume, pages);
    if (recordPages.length > 0) {
      notes.push(`${field}: no page in the sources list; cited the whole entry's pages`);
      return sspLocator(volume, recordPages);
    }
    notes.push(`${field}: no page found`);
    return `Vol. ${volume}`;
  };
  const cite = (
    field: SspCitation['field'],
    pages: number[],
    extra: Partial<Pick<SspCitation, 'confidence' | 'tradition' | 'note'>> = {}
  ): SspCitation => ({
    field,
    sourceSlug: SSP_SOURCE_SLUG,
    locator: locatorFrom(pages, field),
    ...(extra.confidence !== undefined ? { confidence: extra.confidence } : {}),
    ...(extra.tradition ? { tradition: extra.tradition } : {}),
    ...(extra.note ? { note: extra.note.slice(0, 300) } : {}),
  });

  /** Put a value in the patch, or in `held`, or leave it because a citation guards it. */
  function commit<K extends SspField>(
    field: K,
    value: SspPatch[K],
    cites: SspCitation[],
    opts: { skipFillRule?: boolean } = {}
  ): void {
    const hold = holdFor(field);
    if (hold) {
      held.push({ field, value, reason: hold });
      return;
    }
    if (!opts.skipFillRule && !writable(field)) {
      const slugs = new Set(
        (stored?.citations ?? []).filter(c => c.field === field).map(c => c.sourceSlug)
      );
      if (slugs.size === 1 && slugs.has(SSP_TAMIL_SLUG)) {
        if (agreesWithStored(field, value, stored)) {
          citations.push(...cites);
          notes.push(`${field}: agrees with the Tamil edition; English citation added, value kept`);
        } else {
          notes.push(
            `${field}: the English edition disagrees with the Tamil-cited stored value (${JSON.stringify(value)}); kept stored, for review`
          );
        }
        return;
      }
      notes.push(`kept stored ${field}: it already has a citation`);
      return;
    }
    patch[field] = value;
    citations.push(...cites);
  }

  // the scale tokens a swara set must lie inside
  const scaleSet = new Set<string>(record.mela_swaras ?? []);
  for (const line of [murcchana?.arohana, murcchana?.avarohana]) {
    const c = cleanMurcchanaLine(line);
    if (c.ok) for (const t of (c.value ?? '').split(' ')) scaleSet.add(t);
  }
  const anyaAll = (lakshana.anya_swaras ?? []).map(a => String(a.swara ?? '')).filter(Boolean);
  const scaleList = [...scaleSet];

  // ── alternateScales: the murcchana, appended ──────────────────────────────────────────
  {
    const existing = stored?.alternateScales ?? [];
    const seen = new Set(existing.map(entryKey));
    const storedPair = `${compareKey(stored?.arohanam)} - ${compareKey(stored?.avarohanam)}`;
    const additions: string[] = [];
    const addCites: SspCitation[] = [];

    const consider = (
      asc: string | null | undefined,
      desc: string | null | undefined,
      meta: { page?: number | null; confidence?: number | null; label: string }
    ) => {
      const a = cleanMurcchanaLine(asc);
      const d = cleanMurcchanaLine(desc);
      if (!a.ok || !d.ok) {
        held.push({
          field: 'alternateScales',
          value: `${asc ?? ''} - ${desc ?? ''}`,
          reason: `${meta.label}: ${!a.ok ? `ascent ${a.reason}` : `descent ${d.reason}`}`,
        });
        return;
      }
      const entry = `${a.value} - ${d.value}`;
      const key = entryKey(entry);
      if (key === storedPair) {
        notes.push(`${meta.label} equals the stored arohanam and avarohanam; not appended`);
        return;
      }
      if (seen.has(key)) {
        notes.push(`${meta.label} is already in alternateScales; not appended`);
        return;
      }
      seen.add(key);
      const pages = typeof meta.page === 'number' ? [meta.page] : sourceInfo('murcchana').pages;
      additions.push(entry);
      addCites.push(
        cite(
          'alternateScales',
          pages.length > 0
            ? pages
            : typeof murcchana?.printed_page === 'number'
              ? [murcchana.printed_page]
              : [],
          {
            confidence: meta.confidence ?? murcchana?.confidence ?? undefined,
            tradition: DIKSHITAR_SCHOOL,
            note: entry,
          }
        )
      );
    };

    if (murcchana && (murcchana.arohana || murcchana.avarohana)) {
      if (variantMurcchana) {
        held.push({
          field: 'alternateScales',
          value: `${murcchana.arohana ?? ''} - ${murcchana.avarohana ?? ''}`,
          reason: 'variant_uncertain: the murcchana carries an uncertain variant',
        });
      } else {
        consider(murcchana.arohana, murcchana.avarohana, {
          page: murcchana.printed_page,
          confidence: murcchana.confidence,
          label: 'murcchana',
        });
      }
      for (const alt of murcchana.alternate_murcchanas ?? []) {
        if (variantMurcchana) break;
        consider(alt.arohana, alt.avarohana, {
          page: alt.printed_page,
          confidence: alt.confidence,
          label: 'alternate murcchana',
        });
      }
      if (murcchana.second_murcchana && !variantMurcchana) {
        consider(murcchana.second_murcchana.arohana, murcchana.second_murcchana.avarohana, {
          page: murcchana.second_murcchana.printed_page,
          confidence: murcchana.second_murcchana.confidence,
          label: 'second murcchana',
        });
      }
      const unpaired: [string, unknown][] = [
        ['alternate_murcchana', murcchana.alternate_murcchana],
        ['alternates', murcchana.alternates],
        ['arohana_alternatives', murcchana.arohana_alternatives],
        ['arohana_alternate', murcchana.arohana_alternate],
      ];
      for (const [name, value] of unpaired) {
        if (value === undefined || value === null) continue;
        held.push({
          field: 'alternateScales',
          value,
          reason: `${name}: not a paired ascent and descent in tokens`,
        });
      }
    }

    if (additions.length > 0) {
      const hold = holdFor('alternateScales');
      if (hold) {
        for (const entry of additions)
          held.push({ field: 'alternateScales', value: entry, reason: hold });
      } else {
        patch.alternateScales = [...existing, ...additions];
        citations.push(...addCites);
      }
    }
  }

  // ── timeOfDay ────────────────────────────────────────────────────────────────────────
  {
    const vivarana = lakshana.time_of_day ?? null;
    const slokaTime = record.sloka?.facts?.time_of_day ?? null;
    const info = sourceInfo('time_of_day');
    const slokaPage = record.sloka?.printed_page;
    if (vivarana) {
      const mapped = mapSspTimeOfDay(vivarana);
      if (!mapped.ok) {
        held.push({
          field: 'timeOfDay',
          value: vivarana,
          reason:
            mapped.reason === 'ambiguous'
              ? 'ambiguous yāma: the side of the day is not named'
              : 'time of day is not in the mapping table',
        });
      } else {
        const cites = [
          cite('timeOfDay', info.pages, {
            confidence: info.confidence,
            tradition: DIKSHITAR_SCHOOL,
          }),
        ];
        if (slokaTime) {
          const other = mapSspTimeOfDay(slokaTime);
          if (!other.ok || other.value !== mapped.value) {
            cites.push(
              cite('timeOfDay', typeof slokaPage === 'number' ? [slokaPage] : info.pages, {
                tradition: VENKATAMAKHI,
                note: `Vēṅkaṭamakhi's śloka gives the time as: ${slokaTime}.`,
              })
            );
          }
        }
        commit('timeOfDay', mapped.value, cites);
      }
    } else if (slokaTime) {
      const mapped = mapSspTimeOfDay(slokaTime);
      if (mapped.ok) {
        commit('timeOfDay', mapped.value, [
          cite('timeOfDay', typeof slokaPage === 'number' ? [slokaPage] : [], {
            tradition: VENKATAMAKHI,
            note: `Only Vēṅkaṭamakhi's śloka gives a time: ${slokaTime}.`,
          }),
        ]);
      } else {
        held.push({
          field: 'timeOfDay',
          value: slokaTime,
          reason:
            mapped.reason === 'ambiguous'
              ? 'ambiguous yāma in the śloka; the vivaraṇa gives no time'
              : 'śloka time is not in the mapping table; the vivaraṇa gives no time',
        });
      }
    }
  }

  // ── scaleType ────────────────────────────────────────────────────────────────────────
  {
    const info = sourceInfo('scale_type');
    const known = (v: string | null | undefined) =>
      (SCALE_TYPES as readonly string[]).includes(String(v))
        ? (v as SspPatch['scaleType'])
        : undefined;
    const value = known(lakshana.scale_type) ?? known(record.sloka?.facts?.scale_type);
    if (value) {
      commit('scaleType', value, [
        cite('scaleType', info.pages, { confidence: info.confidence, tradition: DIKSHITAR_SCHOOL }),
      ]);
      const slokaScale = record.sloka?.facts?.scale_type;
      if (slokaScale && ascii(slokaScale) !== value) {
        notes.push(`scaleType: the śloka reads "${slokaScale}"; kept the vivaraṇa value ${value}`);
      }
    } else if (lakshana.scale_type) {
      held.push({
        field: 'scaleType',
        value: lakshana.scale_type,
        reason: 'scale type is not one of the allowed values',
      });
    }
  }

  // ── isBhashanga ──────────────────────────────────────────────────────────────────────
  {
    const classOf = (v: string | null | undefined): boolean | undefined => {
      const k = ascii(String(v ?? ''));
      if (/^bha(sh|s)anga$/.test(k)) return true;
      if (k === 'upanga') return false;
      return undefined;
    };
    const a = classOf(lakshana.raga_class);
    const b = classOf(record.janya_class);
    if (a !== undefined && b !== undefined && a !== b) {
      notes.push('isBhashanga: raga_class and janya_class disagree');
    }
    const value = a ?? b;
    if (value !== undefined) {
      const info = sourceInfo('raga_class');
      commit('isBhashanga', value, [
        cite('isBhashanga', info.pages, {
          confidence: info.confidence,
          tradition: DIKSHITAR_SCHOOL,
        }),
      ]);
    }
  }

  // ── graha, jiva, nyasa ───────────────────────────────────────────────────────────────
  const wholeScaleKey = [...scaleSet].sort().join(' ');
  const setField = (
    field: 'grahaSwaras' | 'jivaSwaras' | 'nyasaSwaras',
    sourceName: string,
    raw: string[] | null | undefined,
    note?: string
  ) => {
    if (!raw || raw.length === 0) return;
    const checked = parseSwaraSet(raw);
    if (!checked.ok || !checked.tokens) {
      held.push({ field, value: raw, reason: `not swara notation: ${checked.reason}` });
      return;
    }
    const outside = swarasOutsideRaga(checked.tokens, scaleList, anyaAll);
    if (outside.length > 0) {
      held.push({
        field,
        value: checked.tokens,
        reason: `names a swara outside the raga's scale: ${outside.join(' ')}`,
      });
      return;
    }
    const info = sourceInfo(sourceName);
    commit(field, checked.tokens, [
      cite(field, info.pages, {
        confidence: info.confidence,
        tradition: DIKSHITAR_SCHOOL,
        note,
      }),
    ]);
  };

  setField('grahaSwaras', 'graha_swaras', lakshana.graha_swaras);

  const jivaNyasa = (
    field: 'jivaSwaras' | 'nyasaSwaras',
    kind: 'jiva' | 'nyasa',
    sourceName: string,
    raw: { all?: string[] | null; most_ranjaka?: string[] | null } | null | undefined
  ) => {
    const all = raw?.all ?? [];
    const most = raw?.most_ranjaka ?? [];
    if (most.length > 0) {
      const mostSet = parseSwaraSet(most).tokens ?? [];
      const allSet = parseSwaraSet(all).tokens ?? [];
      let note: string | undefined;
      if (allSet.length > 0 && allSet.join(' ') !== mostSet.join(' ')) {
        const isSuperset = mostSet.every(t => allSet.includes(t));
        note = isSuperset
          ? `All ${countWord(allSet.length)} are ${kind}; these ${countWord(mostSet.length)} most of all.`
          : `${kind} in all: ${allSet.join(' ')}; most ranjaka: ${mostSet.join(' ')}.`;
      }
      setField(field, sourceName, most, note);
      return;
    }
    if (all.length === 0) return;
    const allSet = parseSwaraSet(all).tokens ?? [];
    if (allSet.length > 0 && [...allSet].sort().join(' ') === wholeScaleKey) {
      notes.push(`${field}: SSP lists the whole scale and no most-ranjaka subset; skipped`);
      return;
    }
    setField(field, sourceName, all);
  };
  jivaNyasa('jivaSwaras', 'jiva', 'jiva_swaras', lakshana.jiva_swaras);
  jivaNyasa('nyasaSwaras', 'nyasa', 'nyasa_swaras', lakshana.nyasa_swaras);

  // ── anyaSwaras and prayogas ──────────────────────────────────────────────────────────
  const anyaTokens: string[] = [];
  const anyaPhrases: { notation: string }[] = [];
  (lakshana.anya_swaras ?? []).forEach((anya, i) => {
    const swara = String(anya.swara ?? '').trim();
    if (!swara) return;
    if (variantAnya.has(i) || anya.variant_uncertain) {
      held.push({
        field: 'anyaSwaras',
        value: { swara, phrases: anya.phrases ?? [] },
        reason: 'variant_uncertain: the variant of this borrowed note is not settled',
      });
      return;
    }
    const checked = parseSwaraSet([swara]);
    if (!checked.ok || !checked.tokens) {
      held.push({
        field: 'anyaSwaras',
        value: swara,
        reason: `not swara notation: ${checked.reason}`,
      });
      return;
    }
    for (const t of checked.tokens) if (!anyaTokens.includes(t)) anyaTokens.push(t);
    for (const phrase of anya.phrases ?? []) anyaPhrases.push({ notation: phrase });
  });
  if (anyaTokens.length > 0) {
    const info = sourceInfo('anya_swaras');
    commit('anyaSwaras', anyaTokens, [
      cite('anyaSwaras', info.pages, { confidence: info.confidence, tradition: DIKSHITAR_SCHOOL }),
    ]);
  }

  {
    const out: SspPrayogaOut[] = [];
    const pages: number[] = [];
    const confs: (number | null | undefined)[] = [];
    const seen = new Set<string>();

    const take = (
      notation: string,
      label: string | undefined,
      gamaka: string | undefined,
      page: number | null | undefined,
      conf: number | null | undefined
    ) => {
      const v = validatePhrase(notation);
      if (!v.ok || !v.value) {
        held.push({
          field: 'prayogas',
          value: notation,
          reason: /fewer than two notes/.test(v.reason ?? '')
            ? 'single-token phrase'
            : `invalid notation: ${v.reason}`,
        });
        return;
      }
      if (seen.has(v.value)) return;
      seen.add(v.value);
      out.push({
        notation: v.value,
        ...(label ? { label } : {}),
        ...(gamaka ? { gamaka: gamaka.slice(0, 200) } : {}),
      });
      if (typeof page === 'number') pages.push(page);
      confs.push(conf);
    };

    (lakshana.prayogas ?? []).forEach((p, i) => {
      const raw = String(p.notation ?? '').trim();
      if (!raw) return;
      if (variantPrayogas.has(i) || p.variant_uncertain || p.variant_note) {
        held.push({
          field: 'prayogas',
          value: raw,
          reason: 'variant_uncertain: the variant of a note in this phrase is not settled',
        });
        return;
      }
      if (p.podi_swaras && p.podi_swaras.length > 0) {
        held.push({
          field: 'prayogas',
          value: raw,
          reason: 'pōḍi (grace) note: it would show as a full note',
        });
        return;
      }
      if (p.notation_modernist || /modernist/i.test(String(p.label ?? ''))) {
        held.push({
          field: 'prayogas',
          value: raw,
          reason: 'modernist reading: two readings of one phrase have no field',
        });
        return;
      }
      // A phrase the raga forbids is not one of its phrases. Shown in the same list, with the
      // warning in muted text after it, it would teach exactly what the source rules out.
      if (/avoid/i.test(ascii(String(p.label ?? '')))) {
        held.push({
          field: 'prayogas',
          value: raw,
          reason: 'phrase to avoid: no field for forbidden phrases yet',
        });
        return;
      }
      const unmarked = p.octave_unmarked || unmarkedPrayogas.has(i);
      const text = unmarked ? raw.replace(/['.]/g, '') : raw;
      take(text, prayogaLabel(p.label), p.gamaka_raw ?? undefined, p.printed_page, p.confidence);
    });
    for (const phrase of anyaPhrases) {
      take(phrase.notation, 'Borrowed-note phrase', undefined, undefined, undefined);
    }
    if (anyaPhrases.length > 0) {
      pages.push(...sourceInfo('anya_swaras').pages);
    }

    if (out.length > SSP_MAX_PRAYOGAS) {
      notes.push(`prayogas: ${out.length} phrases; kept the first ${SSP_MAX_PRAYOGAS}`);
      out.length = SSP_MAX_PRAYOGAS;
    }
    if (out.length > 0) {
      const fallback = sourceInfo('prayogas');
      commit('prayogas', out, [
        cite('prayogas', pages.length > 0 ? pages : fallback.pages, {
          confidence: minOf(confs) ?? fallback.confidence,
          tradition: DIKSHITAR_SCHOOL,
        }),
      ]);
    }
  }

  // ── slokas ───────────────────────────────────────────────────────────────────────────
  {
    const sloka = record.sloka;
    const text = sloka?.text_iast;
    if (sloka && text) {
      let author = sloka.author?.trim() || undefined;
      if (author && author.length > 100) {
        const short = author.split(' (')[0]?.trim();
        notes.push('slokas: author text was long; kept the name before the bracket');
        author = short || undefined;
      }
      const value: SspSlokaOut[] = [{ text, ...(author ? { author } : {}) }].slice(0, MAX_SLOKAS);
      const byEditors = /editors/i.test(sloka.attributed_to ?? '');
      commit('slokas', value, [
        cite('slokas', typeof sloka.printed_page === 'number' ? [sloka.printed_page] : [], {
          note: byEditors ? 'Verse supplied by the editors, not part of the 1904 text.' : undefined,
        }),
      ]);
    }
  }

  return { patch, citations, held, notes };
}

/** SSP's labels are technical terms; ours are a closed set. No match, no label. */
export function prayogaLabel(raw: string | null | undefined): string | undefined {
  const k = ascii(String(raw ?? ''));
  if (!k) return undefined;
  if (/anya/.test(k)) return 'Borrowed-note phrase';
  if (/jiva/.test(k)) return 'Jiva phrase';
  if (/ranjaka/.test(k)) return 'Ranjaka phrase';
  if (/visesa|characteristic/.test(k)) return 'Characteristic phrase';
  return undefined;
}

// ── facts for a later writing pass ──────────────────────────────────────────────────────────

export interface SspMovementFact {
  kind: string;
  text: string;
  page: number | undefined;
}

/**
 * The English facts the patch leaves out, as a list for a later pass that writes `movement` in
 * our own words. Input only: nothing here is stored, and none of it may be copied.
 */
export function sspMovementFacts(record: SspRagaRecord): SspMovementFact[] {
  const out: SspMovementFact[] = [];
  const lakshana = record.lakshana ?? {};
  const push = (kind: string, text: unknown, page: unknown) => {
    if (typeof text === 'string' && text.trim()) {
      out.push({ kind, text: text.trim(), page: typeof page === 'number' ? page : undefined });
    }
  };
  for (const f of lakshana.other_facts ?? []) push('other_fact', f.fact, f.page);
  for (const f of record.historical_notes ?? []) push('historical_note', f.fact, f.page);
  for (const f of record.editor_notes ?? []) push('editor_note', f.fact, f.page);
  for (const a of (lakshana.anya_swaras ?? []) as (SspAnya & {
    rules?: string[];
    page?: number;
  })[]) {
    for (const rule of a.rules ?? []) push('anya_rule', `${a.swara ?? ''}: ${rule}`, a.page);
  }
  for (const g of lakshana.gamaka_rules ?? []) {
    push('gamaka_rule', [g.gamaka, g.where].filter(Boolean).join(': '), g.page);
  }
  for (const s of lakshana.sources ?? []) {
    push(`quote:${s.field}`, s.verbatim_quote, s.printed_page);
  }
  return out;
}

// ── match check ─────────────────────────────────────────────────────────────────────────────

export interface SspMatchFlags {
  /** The record's mela number differs from the stored one. */
  melaMismatch: boolean;
  /** The SSP name occurs in more than one place in the edition. */
  duplicateName: boolean;
  /** A parsed heading, not a raga: no kind, no murcchana, no śloka. */
  junkHeading: boolean;
  reasons: string[];
}

export interface SspMatchOptions {
  /** SSP names that occur more than once across volumes (as `name_canonical`). */
  duplicateNames?: ReadonlySet<string>;
  /** The mela number of the stored raga's parent, when the stored raga holds none. */
  parentMelaNumber?: number | null;
}

/**
 * Flags a person must settle before an SSP record is attached to a stored raga. A janya stores
 * its parent's mela number, so one comparison serves melas and janyas.
 */
export function sspMatchCheck(
  record: SspRagaRecord,
  stored: { melaNumber?: number | null },
  options: SspMatchOptions = {}
): SspMatchFlags {
  const reasons: string[] = [];
  const storedMela = stored.melaNumber ?? options.parentMelaNumber ?? null;
  const melaMismatch =
    typeof record.mela_number === 'number' &&
    storedMela !== null &&
    storedMela !== record.mela_number;
  if (melaMismatch) {
    reasons.push(`mela number: SSP says ${record.mela_number}, stored says ${storedMela}`);
  }
  const duplicateName = options.duplicateNames?.has(record.name_canonical) ?? false;
  if (duplicateName) reasons.push(`SSP name "${record.name_canonical}" occurs more than once`);
  const junkHeading = !record.kind && !record.murcchana && !record.sloka;
  if (junkHeading) reasons.push('no kind, murcchana or śloka: a parsed heading, not a raga');
  return { melaMismatch, duplicateName, junkHeading, reasons };
}

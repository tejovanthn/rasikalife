/**
 * Validation for facts gathered by a research agent, before any of them reach the database.
 *
 * This exists because the research itself is the cheap, delegable part and the checking is
 * not. An agent asked to fill fields returns something plausible for every one of them; what
 * decides whether the result is worth having is what gets refused. So every rule the agent is
 * told in prose is also enforced here, and the enforcement is what we rely on.
 *
 * Browser-safe and dependency-free on purpose: it is pure string work over plain objects, so
 * it can be unit-tested without an environment, which `packages/scripts` cannot be.
 *
 * Three classes of check, in descending order of how much damage they prevent:
 *
 *   1. **Notation.** A raga's arohanam is the fact people search for, and a wrong one is worse
 *      than a blank. `validateSwaras` accepts only real swara tokens, so a prose answer
 *      ("ascends through the fifth") or a transliterated one is refused rather than published.
 *   2. **Claims about the wrong subject.** The commonest research error is a true fact about
 *      something adjacent — a parent movement's founding year, a namesake's biography, a
 *      melakarta's number on its janya. `melaNumber` is therefore never accepted from an
 *      agent at all; see `deriveMelaNumbers`.
 *   3. **Inflation and hedging.** Prose that ranks, praises, or reasons out loud is not a
 *      fact, and this codebase has paid for that lesson repeatedly.
 */

// ── notation ────────────────────────────────────────────────────────────────────────────

/**
 * The sixteen swara positions, plus the two invariant ones. Numbered forms are what the
 * corpus stores (`S R1 G2 M1 P D1 N3 S`); bare letters are accepted because Hindustani
 * sources write them that way, and an octave dot or apostrophe may ride along.
 */
const SWARA_TOKEN = /^[SRGMPDN][123]?['`,]*$/;

export interface Checked {
  ok: boolean;
  value?: string;
  reason?: string;
}

const reject = (reason: string): Checked => ({ ok: false, reason });
const accept = (value: string): Checked => ({ ok: true, value });

/**
 * A scale line, normalised to single-spaced uppercase tokens.
 *
 * Refuses anything that is not swara notation. This is the one field where a plausible wrong
 * answer is most costly: raga pages rank for "<name> arohanam avarohanam", and a reader who
 * finds a wrong scale there has been actively misled about the raga's defining feature.
 */
export function validateSwaras(raw: string): Checked {
  const text = String(raw ?? '').trim();
  if (!text) return reject('empty');
  if (text.length > 200) return reject('longer than the 200-character column');

  const tokens = text.toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return reject(`only ${tokens.length} token(s); not a scale`);

  const bad = tokens.filter(token => !SWARA_TOKEN.test(token));
  if (bad.length > 0) return reject(`not swara notation: ${bad.slice(0, 3).join(' ')}`);

  // A scale that never states the tonic is almost always prose that happened to parse.
  if (!tokens.includes('S')) return reject('no S in the line');
  return accept(tokens.join(' '));
}

// ── the 72-melakarta scheme ─────────────────────────────────────────────────────────────

/**
 * The (Ra, Ga) pair by chakra and the (Da, Ni) pair by position inside it.
 *
 * A melakarta's scale *is* its number: madhyamam is M1 for 1–36 and M2 for 37–72, the first
 * tetrachord comes from the chakra, the second from the position within it. So the 72 canonical
 * scales are computed rather than researched — no lookup, and no chance of a wrong one on the
 * pages every janya links up to.
 */
const RA_GA = [
  ['R1', 'G1'],
  ['R1', 'G2'],
  ['R1', 'G3'],
  ['R2', 'G2'],
  ['R2', 'G3'],
  ['R3', 'G3'],
] as const;
const DA_NI = [
  ['D1', 'N1'],
  ['D1', 'N2'],
  ['D1', 'N3'],
  ['D2', 'N2'],
  ['D2', 'N3'],
  ['D3', 'N3'],
] as const;

/** The ascending scale of melakarta `n`, as stored. Descending is its reverse. */
export function melakartaScale(n: number): { arohanam: string; avarohanam: string } {
  if (!Number.isInteger(n) || n < 1 || n > 72) throw new Error(`no melakarta ${n}`);
  const half = n <= 36 ? n : n - 36;
  const [ra, ga] = RA_GA[Math.floor((half - 1) / 6)];
  const [da, ni] = DA_NI[(half - 1) % 6];
  const up = ['S', ra, ga, n <= 36 ? 'M1' : 'M2', 'P', da, ni, 'S'];
  return { arohanam: up.join(' '), avarohanam: [...up].reverse().join(' ') };
}

/** The seven distinct swaras of melakarta `n`. */
export function melakartaSwaras(n: number): Set<string> {
  return new Set(melakartaScale(n).arohanam.split(' '));
}

/**
 * Notes in a janya's scale that its parent melakarta does not contain.
 *
 * **A hit is not automatically an error.** A janya may borrow a foreign note deliberately — an
 * *anya swara* — and some of the best-known ragas are defined by it: Yamunakalyani is Kalyani
 * with M1, Bhairavi takes D2 against Natabhairavi's D1, Kambhoji takes N3. So this reports
 * rather than refuses; it is a question to ask of a scale, not a verdict on one.
 *
 * What it does catch outright is a scale paired with the wrong parent, and prose or junk that
 * reached the field before this pipeline existed — the corpus holds `varies`, `uses all notes
 * of mela`, a stray `M3`, and one scale written with Unicode subscript digits.
 */
export function foreignNotes(scale: string, melaNumber: number): string[] {
  const allowed = melakartaSwaras(melaNumber);
  const seen = new Set(
    scale
      .toUpperCase()
      .split(/\s+/)
      .map(token => token.replace(/['`,]/g, ''))
      .filter(Boolean)
  );
  return [...seen].filter(token => !allowed.has(token));
}

// ── prose ───────────────────────────────────────────────────────────────────────────────

/**
 * Ranking and praise. Neither is a fact, and both read as authority.
 *
 * The second line was added after the first melakarta run came back with **zero** refusals
 * across 151 cells and two descriptions that still praised: Shankarabharanam, the busiest raga
 * page on the site, was "a mellifluous raga offering wide scope for composition", and
 * Kamavardhani was "popular with musicians". A refusal count of zero measures the pattern, not
 * the prose. When widening this, prefer a word that is *only* ever praise — `beautiful` is
 * deliberately absent, because "its name means the beautiful one" is a translation and true.
 */
const PUFFERY =
  /\b(renowned|premier|iconic|prestigious|leading|legendary|famous|acclaimed|eminent|illustrious|foremost|world-class|unparalleled|vibrant|majestic|soul-stirring|hauntingly|mesmeri[sz]ing|one of the (oldest|most|largest|finest|greatest)|(?:[a-z]+'s|the)\s+(oldest|largest|greatest|finest|most popular)|mellifluous|popular|sublime|enchanting|captivating|exquisite|magnificent|breathtaking|spellbinding|scintillating|timeless|beloved|revered|quintessential|masterpiece|wide scope)\b/i;

/** The agent reasoning out loud. Whatever follows is not what a source said. */
const SPECULATION =
  /\b(implying|implies|presumably|apparently|seemingly|likely|appears? to|seems? to|possibly|probably|may have been|might be|reportedly|is believed to|thought to be|unclear|I could not|not sure)\b/i;

/** Returns the offending phrase, or undefined when the prose is plain. */
export function checkProse(text: string): string | undefined {
  return (PUFFERY.exec(text) ?? SPECULATION.exec(text))?.[0];
}

// ── social links ────────────────────────────────────────────────────────────────────────

/** platform → hosts that legitimately serve it. `website` is any host by definition. */
const PLATFORM_HOSTS: Record<string, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  twitter: ['twitter.com', 'x.com'],
  wikipedia: ['wikipedia.org'],
  spotify: ['spotify.com'],
  apple_music: ['apple.com'],
  soundcloud: ['soundcloud.com'],
  website: [],
};

const URL_RE = /^https?:\/\/\S+$/;

/**
 * Keeps only links whose host matches the platform they claim. The cheap failure is a handle
 * guessed from the entity's name, which points a reader at a stranger's account.
 */
export function validateSocialLinks(raw: unknown): { value?: string; rejected: string[] } {
  if (!Array.isArray(raw)) return { rejected: [] };
  const good: string[] = [];
  const rejected: string[] = [];
  for (const item of raw) {
    const platform = String((item as { platform?: unknown })?.platform ?? '')
      .trim()
      .toLowerCase();
    const url = String((item as { url?: unknown })?.url ?? '').trim();
    const hosts = PLATFORM_HOSTS[platform];
    if (!hosts || !URL_RE.test(url)) {
      rejected.push(`${platform || '?'}:${url || '?'}`);
      continue;
    }
    const host = /^https?:\/\/([^/]+)/.exec(url.toLowerCase())?.[1] ?? '';
    if (hosts.length > 0 && !hosts.some(allowed => host.endsWith(allowed))) {
      rejected.push(`${platform} points at ${host}`);
      continue;
    }
    good.push(`${platform}:${url}`);
  }
  return { value: good.length > 0 ? good.join('|') : undefined, rejected };
}

// ── per-domain field rules ──────────────────────────────────────────────────────────────

const TIME_OF_DAY = new Set(['morning', 'afternoon', 'evening', 'night', 'universal']);
const TRADITIONS = new Set(['carnatic', 'hindustani', 'both']);

const BLANKISH = new Set(['', 'n/a', 'na', 'unknown', 'none', 'null', '-', 'not stated']);

/**
 * The fields a research agent is asked for, per domain. `melaNumber` is deliberately absent
 * from every list — it is derived, never reported. See `deriveMelaNumbers`.
 */
export const RESEARCH_FIELDS: Record<string, readonly string[]> = {
  raga: [
    'description',
    'tradition',
    'arohanam',
    'avarohanam',
    'alternateScales',
    'rasa',
    'timeOfDay',
    'season',
    'parentRaga',
  ],
};

// ── choosing what to research, and in what order ────────────────────────────────────────

/**
 * Picks the records a pass covers, in the order the pass wants them.
 *
 * A corpus this size is researched in passes — the canonical records first, then everything
 * else busiest-first — so the order records reach a worker in has to be something the caller
 * can state rather than whatever the table scan returned. `wanted` both selects and orders;
 * `excluded` drops what an earlier pass already covered.
 *
 * An id that names nothing is dropped rather than throwing: the list is usually generated
 * from an older export, and one merged-away raga should not take the run down with it. The
 * count of those is returned so the caller can say so.
 */
export function selectRecords<T extends { id: string }>(
  rows: T[],
  opts: { wanted?: string[]; excluded?: string[] } = {}
): { records: T[]; unmatched: number } {
  const byId = new Map(rows.map(row => [row.id, row]));
  const excluded = new Set(opts.excluded ?? []);
  if (!opts.wanted) return { records: rows.filter(row => !excluded.has(row.id)), unmatched: 0 };

  const records: T[] = [];
  const seen = new Set<string>();
  let unmatched = 0;
  for (const id of opts.wanted) {
    const row = byId.get(id);
    if (!row) {
      unmatched += 1;
      continue;
    }
    // A list built by concatenating passes can name the same id twice; researching it twice
    // would spend the budget twice for one page.
    if (seen.has(id) || excluded.has(id)) continue;
    seen.add(id);
    records.push(row);
  }
  return { records, unmatched };
}

/** Validates one researched cell. Returns the value to store, or the reason it was refused. */
export function validateResearchField(domain: string, field: string, raw: unknown): Checked {
  if (raw == null) return reject('null');
  const text = String(raw).trim();
  if (BLANKISH.has(text.toLowerCase())) return reject('blank');

  if (field === 'melaNumber') {
    return reject('melaNumber is derived from the parent raga, never taken from research');
  }

  if (domain === 'raga') {
    switch (field) {
      case 'arohanam':
      case 'avarohanam':
        return validateSwaras(text);
      case 'alternateScales': {
        const parts = (Array.isArray(raw) ? raw.map(String) : text.split('|')).map(s => s.trim());
        const checked = parts.map(validateSwaras);
        const bad = checked.find(c => !c.ok);
        if (bad) return reject(`alternate scale ${bad.reason}`);
        return accept(checked.map(c => c.value).join('|'));
      }
      case 'tradition':
        return TRADITIONS.has(text.toLowerCase())
          ? accept(text.toLowerCase())
          : reject(`tradition must be carnatic, hindustani or both, got "${text}"`);
      case 'timeOfDay':
        return TIME_OF_DAY.has(text.toLowerCase())
          ? accept(text.toLowerCase())
          : reject(`timeOfDay must be one of ${[...TIME_OF_DAY].join(', ')}, got "${text}"`);
      case 'description': {
        if (text.length > 5000) return reject('longer than the 5000-character column');
        const phrase = checkProse(text);
        if (phrase) return reject(`prose flagged on "${phrase}"`);
        // A description whose swaras have been spelled out as words is the transliteration
        // bug in narrative form, and reads as authoritative.
        if (/\bsa\s+ri\s+ga\b/i.test(text)) return reject('spells swaras as words');
        return accept(text);
      }
      case 'rasa':
      case 'season':
        return text.length <= 100 ? accept(text) : reject('longer than the 100-character column');
      case 'parentRaga':
        return text.length <= 100 ? accept(text) : reject('longer than a raga name');
      default:
        return reject(`${field} is not a researched field for ${domain}`);
    }
  }
  return reject(`no rules for domain ${domain}`);
}

// ── merge ───────────────────────────────────────────────────────────────────────────────

export interface ResearchRecord {
  id?: string;
  name?: string;
  fields?: Record<string, unknown>;
  notes?: string;
  sources?: string[];
}

export interface MergeRejection {
  id: string;
  name: string;
  field: string;
  reason: string;
  value: string;
}

export interface MergeReport {
  filled: number;
  keptExisting: number;
  rejections: MergeRejection[];
  derivedMela: number;
}

type Row = Record<string, string>;

/**
 * Folds validated research into exported admin-CSV rows.
 *
 * **Only empty cells are written.** What is stored was put there by a person or an earlier
 * pass, and a fresh web lookup is not stronger evidence than either. Correcting a stored
 * value is a separate, deliberate act — see `clearFieldsForDomain`.
 */
export function mergeResearch(domain: string, rows: Row[], results: ResearchRecord[]): MergeReport {
  const byId = new Map(rows.map(row => [row.id, row]));
  const report: MergeReport = { filled: 0, keptExisting: 0, rejections: [], derivedMela: 0 };

  for (const record of results) {
    const row = record.id ? byId.get(record.id) : undefined;
    if (!row) continue;
    for (const [field, raw] of Object.entries(record.fields ?? {})) {
      const column = field === 'parentRaga' ? 'parentRaga' : field;
      if (!(column in row)) {
        report.rejections.push({
          id: row.id,
          name: row.name,
          field,
          reason: 'no such column',
          value: String(raw).slice(0, 80),
        });
        continue;
      }
      const checked = validateResearchField(domain, field, raw);
      if (!checked.ok) {
        report.rejections.push({
          id: row.id,
          name: row.name,
          field,
          reason: checked.reason as string,
          value: String(raw).slice(0, 80),
        });
        continue;
      }
      if (row[column].trim()) {
        report.keptExisting += 1;
        continue;
      }
      row[column] = checked.value as string;
      report.filled += 1;
    }
  }

  if (domain === 'raga') report.derivedMela = deriveMelaNumbers(rows);
  return report;
}

/**
 * Fills `melaNumber` on a janya from the raga it names as its parent.
 *
 * A janya stores its **parent's** mela number, which is exactly the sort of fact an agent
 * gets subtly wrong — it will happily report the janya's own position, or the parent's number
 * against the wrong parent. Since the corpus already holds every melakarta's number, the
 * value is derivable, and a derivation is both free and right. Nothing is overwritten, and a
 * parent that cannot be resolved simply leaves the field empty.
 */
export function deriveMelaNumbers(rows: Row[]): number {
  const melaByName = new Map<string, string>();
  for (const row of rows) {
    if (row.melaNumber?.trim() && !row.parentRaga?.trim()) {
      melaByName.set(normaliseRagaName(row.name), row.melaNumber.trim());
    }
  }

  let derived = 0;
  for (const row of rows) {
    const parent = row.parentRaga?.trim();
    if (!parent || row.melaNumber?.trim()) continue;
    const mela = melaByName.get(normaliseRagaName(parent));
    if (!mela) continue;
    row.melaNumber = mela;
    derived += 1;
  }
  return derived;
}

/** Case, diacritics, punctuation and the alias bracket removed — the raga dedup exact key. */
function normaliseRagaName(name: string): string {
  return (name ?? '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

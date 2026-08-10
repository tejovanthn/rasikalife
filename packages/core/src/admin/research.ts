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
 *   4. **A name that would become a record.** The admin importer resolves a linked name by
 *      exact match and creates one when it misses, so a parent reported in ordinary spelling
 *      against a corpus stored in ITRANS writes a blank raga rather than a reference. See
 *      `corpusNames`.
 */

import { ragaVariantKey } from '../domain/raga/dedup';

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
 *
 * **The artist list is short on purpose, and the omissions are the design.** A raga is a
 * reference object whose name *is* its subject; an artist is a living person whose name is not,
 * so the failure modes are different in kind and three fields are refused outright:
 *
 * - **`biography`.** `domain/artist/media-kit.ts` states the rule this codebase runs on — every
 *   artist platform lets a press-kit paragraph *become* the record, which is how biographies
 *   fill with claims nobody checked. `rewrite-artist-bios` exists to drain that field back to
 *   narrative once the facts are in fields. Crawling promotional prose into it refills what the
 *   pipeline was built to empty. Prose is *derived* from these fields, never researched into
 *   them.
 * - **`photoUrl`.** A raga's scale is a fact; a photograph is someone's copyrighted work. It
 *   also cannot travel this path: the column is deliberately absent from `ADMIN_CSV_DOMAINS`,
 *   and `packages/og-image` allowlists the photo fetch to the CDN host, so an external URL
 *   would store cleanly and silently degrade every share card to text.
 * - **`birthYear` and `gurus`.** A birth year is a claim about a private individual, and many
 *   here are children performing an arangetram. A guru edge is *the* credential in this domain,
 *   and prose flattens exactly the distinction `GURU_RELATIONSHIPS` exists to keep — a workshop
 *   attendee and a senior disciple both read as "studied under".
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
  artist: ['website', 'socialLinks', 'city', 'specialisations', 'birthPlace', 'activeYears'],
};

/**
 * Hosts that belong in `socialLinks`, so `website` refuses them.
 *
 * An artist whose only web presence is an Instagram page will otherwise have it reported twice,
 * and both columns feed `sameAs` in the JSON-LD — which would publish the same account as two
 * separate claims about the same person.
 */
const SOCIAL_HOSTS = Object.values(PLATFORM_HOSTS).flat();

/** A place name, not a postal address and not a sentence. */
function validatePlace(text: string, limit: number): Checked {
  if (text.length > limit) return reject(`longer than the ${limit}-character column`);
  // A digit in a city is a house number, a postcode or a phone number that landed in the
  // wrong cell. None of them is a place name.
  if (/\d/.test(text)) return reject('contains a digit; a place name has none');
  // "Chennai, Tamil Nadu" is a place. "Chennai, Tamil Nadu, India" is an address, and the
  // field the profile renders wants the city.
  if ((text.match(/,/g) ?? []).length > 1) return reject('more than one comma; name the city');
  const phrase = checkProse(text);
  if (phrase) return reject(`prose flagged on "${phrase}"`);
  return accept(text);
}

/**
 * `activeYears` is free text on the record, which is what makes it worth pinning here.
 *
 * The value a worker reaches for first is "over four decades" or "since the early 1990s", and
 * neither is a span the profile can render beside a dated one. So it must state real years:
 * `1985`, `1985-2010`, `1985-present`, or `since 1985`. Dashes are normalised because a source
 * will use an en dash and the column is 50 characters of anything.
 */
function validateActiveYears(text: string): Checked {
  if (text.length > 50) return reject('longer than the 50-character column');
  const normalised = text
    .replace(/[‐-―]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .trim();

  const match = /^(?:since\s+)?(\d{4})(?:-(\d{4}|present))?$/i.exec(normalised);
  if (!match) return reject(`not a year span: "${text}"`);

  // Bounds from YearSchema, so a span that parses is always one the record can hold.
  const years = [match[1], match[2]].filter(y => y && y !== 'present').map(Number);
  for (const year of years) {
    if (year < 1800 || year > 2100) return reject(`${year} is outside 1800-2100`);
  }
  if (years.length === 2 && years[0] > years[1]) return reject(`${years[0]} is after ${years[1]}`);

  return accept(normalised.toLowerCase().startsWith('since ') ? `since ${match[1]}` : normalised);
}

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

  if (domain === 'artist') {
    switch (field) {
      case 'website': {
        if (text.length > 500) return reject('longer than the 500-character column');
        if (!URL_RE.test(text)) return reject(`not an http(s) URL: "${text}"`);
        const host = /^https?:\/\/([^/]+)/.exec(text.toLowerCase())?.[1] ?? '';
        if (SOCIAL_HOSTS.some(social => host.endsWith(social))) {
          return reject(`${host} belongs in socialLinks, not website`);
        }
        return accept(text);
      }
      case 'socialLinks': {
        const { value, rejected } = validateSocialLinks(raw);
        if (!value) return reject(rejected.length ? `bad links: ${rejected.join(', ')}` : 'none');
        return accept(value);
      }
      case 'city':
        return validatePlace(text, 200);
      case 'birthPlace':
        return validatePlace(text, 200);
      case 'specialisations': {
        const parts = (Array.isArray(raw) ? raw.map(String) : text.split('|'))
          .map(s => s.trim())
          .filter(Boolean);
        if (parts.length === 0) return reject('empty');
        // Six is already more than any real artist claims; a longer list is a model listing
        // every art form it has heard of rather than the ones this person practises.
        if (parts.length > 6) return reject(`${parts.length} specialisations; six is the cap`);
        for (const part of parts) {
          if (part.length > 100) return reject(`"${part.slice(0, 40)}…" is over 100 characters`);
          const phrase = checkProse(part);
          if (phrase) return reject(`prose flagged on "${phrase}"`);
        }
        return accept(parts.join('|'));
      }
      case 'activeYears':
        return validateActiveYears(text);
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
  // Raga-only: it keys on `melaNumber` and the raga variant key, and building it over another
  // domain's rows would cost a sweep to produce a map nothing reads.
  const byName = domain === 'raga' ? corpusNames(rows) : undefined;

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

      // A name-referencing column must arrive spelled the way the corpus spells it, because
      // the importer resolves it by exact name and *creates* a record when it misses. A
      // worker reports "Shankarabharanam"; the corpus stores "shankarAbharaNa"; the import
      // then wrote seven blank ragas and pointed sixteen janyas at them. Rewrite to the
      // stored spelling or refuse — never hand the importer a name it will silently invent.
      if (column === 'parentRaga' && byName) {
        const resolved = byName.resolve(checked.value as string);
        if (!resolved) {
          report.rejections.push({
            id: row.id,
            name: row.name,
            field,
            reason: 'no raga in the corpus answers to that name; importing it would create one',
            value: String(raw).slice(0, 80),
          });
          continue;
        }
        row[column] = resolved;
        report.filled += 1;
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

/**
 * Resolves a reported raga name to the spelling the corpus actually stores.
 *
 * Two tiers, and the second is deliberately timid. The exact key (case, diacritics,
 * punctuation and the alias bracket removed) is safe enough that a hit is a hit. The variant
 * key also guesses transliteration, which is what bridges `Sankarabharanam` to
 * `shankarAbharaNa` — but it is known to collide distinct ragas, so a variant hit counts only
 * when exactly one record answers to it.
 *
 * Everything else is refused rather than guessed. Of the seven names that caused the incident
 * this exists to prevent, the variant key bridges one; the rest — `Vachaspati`/`vAcaspati`,
 * `Suryakantam`/`chAyAvati` — no string rule reaches, and a reviewer reading a refusal is the
 * only honest answer. This is the same discipline `bestArtistMatch` follows: report a
 * candidate, never bind to it.
 *
 * A melakarta wins a collision on the exact key, since a parent reference is nearly always
 * reaching for one and the corpus holds several spellings of some.
 */
function corpusNames(rows: Row[]): { resolve: (name: string) => string | undefined } {
  const exact = new Map<string, string>();
  const variants = new Map<string, string[]>();
  for (const row of rows) {
    const key = normaliseRagaName(row.name);
    if (!key) continue;
    const held = exact.get(key);
    const isMelakarta = Boolean(row.melaNumber?.trim()) && !row.parentRaga?.trim();
    if (!held || isMelakarta) exact.set(key, row.name);

    const variant = ragaVariantKey(row.name);
    if (!variant) continue;
    const names = variants.get(variant) ?? [];
    if (!names.includes(row.name)) names.push(row.name);
    variants.set(variant, names);
  }

  return {
    resolve(name: string) {
      const hit = exact.get(normaliseRagaName(name));
      if (hit) return hit;
      const near = variants.get(ragaVariantKey(name) ?? '');
      return near?.length === 1 ? near[0] : undefined;
    },
  };
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

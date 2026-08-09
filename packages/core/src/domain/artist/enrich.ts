/**
 * Deriving an artist's `instrument` from the roles they were credited with on stage.
 *
 * 503 of 1,159 artists in prod hold nothing but a name and 655 hold nothing but an honorific;
 * exactly one has a biography, so `extract-artist-bios` has nothing to read. Meanwhile the
 * `EventArtist` junction carries a free-text `role` per appearance — 1,349 rows across 133
 * distinct roles, headed by vocal, mridangam, violin and ghatam. That is the same fact the
 * `instrument` field holds, already in the table, already checked by whoever verified the
 * poster. Nothing here is looked up, so nothing here can be a wrong claim about a person.
 *
 * `instrument` is what `artistTagline` and `artistMetaDescription` lead with, so filling it is
 * what turns "Sudha Ragunathan." into "Sudha Ragunathan — Vocal." on the largest and
 * worst-converting query class on the site.
 *
 * Browser-safe and dependency-free, like `venue/enrich.ts` and `organiser/enrich.ts`: it is
 * pure string work, so it can be unit-tested without an environment.
 *
 * ## What counts as a role worth keeping
 *
 * A role is kept when it names **what the person did** specifically enough to tell them apart
 * from the rest of the corpus, and dropped when it names their **standing at that event** or
 * is true of everybody on the site. So `mridangam`, `bharatanatyam` and `harmonium` are kept;
 * `chief-guest` (18), `guest-of-honour` (14), `disciple` (22), `awardee`, `convenor` and
 * `chairman` are standing, and `performer` (46), `artist` and `accompanist` are true of the
 * whole corpus. Dropping those is what leaves 289 artists with events blank — correctly.
 *
 * The vocabulary is **closed and explicit**, for the reason `venueTypeFromName` gives: a rule
 * that guesses puts a wrong claim on a page whose whole problem is that it holds too few
 * claims. An unrecognised role fills nothing and waits for a person. That is why the aliases
 * are spelled out one by one rather than stemmed — `mrudanga`, `khajira` and `morching` are
 * how they were actually typed, and no stemmer reaches them from the canonical spelling.
 */

/**
 * Every role string the corpus uses, mapped to the spelling stored on the artist.
 *
 * Built rather than written out so each canonical name sits with its own variants; the aliases
 * are the real ones seen in the junction, not invented ones.
 */
const INSTRUMENT_BY_ROLE = new Map<string, string>();

function alias(canonical: string, ...variants: string[]): void {
  for (const role of [canonical, ...variants]) INSTRUMENT_BY_ROLE.set(role, canonical);
}

// Voice. `vocal support` is still singing; `gita (music)` is deliberately absent — it is one
// limb of a kavya/chitra/gita/nrutya programme and means "music" in general, not a part sung.
alias(
  'vocal',
  'vocals',
  'vocalist',
  'duet vocal',
  'vocal support',
  'hindustani vocal',
  'karnatak vocal',
  'carnatic vocal',
  'vocal (thumri)'
);

// Percussion.
alias(
  'mridangam',
  'mrudangam',
  'mrudanga',
  'mridanga',
  'panchama mrudanga',
  'accompanist (mridangam)',
  'mridangam maestro'
);
alias('ghatam', 'ghata');
alias('tabla', 'tabala');
alias('khanjira', 'kanjira', 'khajira');
alias('morsing', 'morching');
alias('konnakkol', 'konnakol');
alias('thavil', 'tavil');
alias('pakhawaj');
alias('dholak');
alias('maddale');
alias('shrikhol');
alias('manjira');
alias('thamate');
alias('drums');
alias('percussion', 'percussions');

// Strings, wind and keys.
alias('violin', 'electric violin', 'violin solo');
alias('veena');
alias('sitar');
alias('sarod');
alias('sarangi');
alias('santoor');
alias('flute');
alias('bansuri');
alias('nadaswaram');
alias('saxophone');
alias('accordion', 'accordion ensemble');
alias('keyboard');
alias(
  'harmonium',
  'karnatak harmonium solo',
  'hindustani harmonium solo',
  'accompanist (harmonium)',
  'harmonium ensemble'
);

// Dance and the spoken forms. Not instruments, but `instrument` is the field the tagline reads
// and a Bharatanatyam dancer's page needs the same rescue a mridangist's does. Bare `dance` and
// `dancer` are kept even though they name no style: unlike `performer` they still say which art
// this is, which is the whole test above. A named style always wins, because both are counted
// and the commoner one leads.
alias('bharatanatyam', 'bharatanatyam dancer', 'bharatanatyam dancers');
alias('kathak');
alias('kuchipudi');
alias('odissi', 'odissi dancer');
alias('mohiniyattam');
alias('nattuvangam', 'nattuvanga');
alias('dance', 'dancer');
alias('harikatha');
alias('gamaka');

/**
 * Roles seen in the corpus that deliberately derive nothing, kept as a list so the decision is
 * reviewable and a test can assert it. Everything absent from `INSTRUMENT_BY_ROLE` is refused
 * anyway — this is the subset someone will otherwise be tempted to add.
 *
 * Three kinds: standing at the event (`chief-guest`, `awardee`), a description true of the
 * whole corpus (`performer`, `artist`), and a body rather than a part (`ensemble`, `troupe`,
 * an academy's name). `guru` and `disciple` describe a relationship, which is what the `gurus`
 * field with its `relationship` exists to record properly.
 */
export const NON_INSTRUMENT_ROLES: readonly string[] = [
  'accompaniment',
  'accompanist',
  'artist',
  'artistic director',
  'awardee',
  'chairman',
  'chief-guest',
  'chief-mentor',
  'choreographer',
  'collaborator',
  'compere',
  'concept',
  'conductor',
  'convenor',
  'curator',
  'dialogues',
  'director',
  'disciple',
  'ensemble',
  'explanation',
  'group',
  'guest-of-honour',
  'guru',
  'instructor',
  'lecturer',
  'master of ceremony',
  'master of the ceremony',
  'music',
  'narration',
  'performer',
  'presenter',
  'president',
  'speaker',
  'team',
  'troupe',
];

/** At most this many, commonest first. Beyond three the tagline stops being a tagline. */
const MAX_INSTRUMENTS = 3;

/**
 * Splits one credit into the parts it names.
 *
 * Commas and slashes are the only separators, because they are the only ones used: the corpus
 * holds `tabla, thamate, percussions` and `morching/tabla`. Splitting on spaces as well would
 * pull `harmonium` out of `hindustani harmonium solo` — right by luck here, and wrong the
 * moment a role reads `assistant to the violinist`.
 */
function partsOf(role: string): string[] {
  return role
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[,/]/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * The `instrument` value a set of stage credits states outright, or `undefined`.
 *
 * Takes **one entry per appearance**, repeats included, because the repeats are the ranking: a
 * mridangist who sang once should read "Mridangam, Vocal" and not the other way round. Ties
 * keep the order first seen, so the result is stable across runs and a re-run writes nothing
 * new.
 *
 * Returns the comma-separated form `instrument` already stores (`"mridangam, vocal"`), so the
 * caller writes the string unchanged; `parseInstruments` in the web package does the casing.
 */
export function instrumentFromRoles(roles: Array<string | null | undefined>): string | undefined {
  const counts = new Map<string, number>();

  for (const role of roles) {
    if (!role) continue;
    // Within one credit a part counts once, so `tabla / tabla` is not two appearances.
    const seen = new Set<string>();
    for (const part of partsOf(role)) {
      const instrument = INSTRUMENT_BY_ROLE.get(part);
      if (!instrument || seen.has(instrument)) continue;
      seen.add(instrument);
      counts.set(instrument, (counts.get(instrument) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return undefined;

  // Map iteration is insertion-ordered, so a stable sort on the count alone keeps first-seen
  // order within a tie.
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_INSTRUMENTS)
    .map(([instrument]) => instrument)
    .join(', ');
}

/** Whether a role would contribute anything, for reporting which credits a run ignored. */
export function isInstrumentRole(role: string): boolean {
  return partsOf(role).some(part => INSTRUMENT_BY_ROLE.has(part));
}

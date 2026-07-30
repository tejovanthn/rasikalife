import type { BioExtraction, ExtractionConfidence } from './bio-extract';
import { artistNameSimilarity, normalizeArtistName } from './dedup';
import type { Artist } from './entity';

/**
 * Turns one biography's extraction into flat, reviewable proposal rows.
 *
 * The output is a spreadsheet, not a write. Nothing here creates an `Artist` or an
 * `Organiser`: there are already duplicate slugs publicly indexed, and an extractor creating
 * entities at scale multiplies that faster than one person can clean it up. Names are matched
 * against existing records and returned with their score, and a human picks or creates.
 */

export const PROPOSAL_TYPES = [
  'guru',
  'affiliation',
  'credential',
  'work',
  'arangetram',
  'unresolved',
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export interface Proposal {
  artistId: string;
  artistName: string;
  proposalType: ProposalType;
  /** The extracted name or title — the thing being proposed. */
  value: string;
  relationship: string;
  role: string;
  startYear: string;
  endYear: string;
  /** The id of the best existing match, blank when nothing scored high enough. */
  resolvedId: string;
  /**
   * The matched artist's **name**. Without it the sheet asks a reviewer to judge a match from
   * a 27-character KSUID and a number, which means a database lookup per row — and the whole
   * design rests on a human catching a wrong match.
   */
  matchName: string;
  /** The best match's score, to two decimals. Blank when no candidate was considered. */
  matchScore: string;
  confidence: ExtractionConfidence | '';
  sourceSentence: string;
  /** Left blank for the reviewer: 'y' to accept, 'n' to reject. */
  decision: string;
  /** Left blank for the reviewer: a corrected value to use instead of `value`. */
  correctedValue: string;
}

/** The CSV header, in order. Also the shape the importer reads back. */
export const PROPOSAL_COLUMNS: Array<keyof Proposal> = [
  'artistId',
  'artistName',
  'proposalType',
  'value',
  'relationship',
  'role',
  'startYear',
  'endYear',
  'resolvedId',
  'matchName',
  'matchScore',
  'confidence',
  'sourceSentence',
  'decision',
  'correctedValue',
];

/**
 * Below this, a candidate is reported but not treated as resolved.
 *
 * Lower than `findArtistMatch`'s 0.85 default on purpose: this does not *act* on the match, it
 * shows a reviewer the closest thing already in the database so they can spot a near-miss
 * rather than creating a duplicate. Anything under this is not worth a reviewer's attention.
 */
const REPORT_THRESHOLD = 0.6;

/** At or above this the row is pre-filled with the match, so a reviewer only has to confirm. */
const RESOLVE_THRESHOLD = 0.85;

/** Two scores within this of each other are a tie, not a ranking. */
const TIE_EPSILON = 0.001;

interface Match {
  id: string;
  name: string;
  score: number;
  /**
   * Another *different* artist scored the same. Duplicate records for one person are the
   * reason this module never auto-creates, so a tie is the expected shape when the corpus
   * holds two rows for one guru — and picking whichever the sweep reached first would bind
   * the edge to an arbitrary duplicate at a confident-looking score.
   */
  ambiguous: boolean;
}

/**
 * Best existing artist for a name, with its score and name — as against `findArtistMatch`,
 * which collapses to a single pass/fail result and so cannot show a reviewer a near-miss.
 *
 * `candidates` is passed in rather than fetched. `listAllArtistsForMatching` warns that a
 * per-name sweep turns into a hundred full scans in one run, so the caller loads the corpus
 * once and hands it down.
 */
export function bestArtistMatch(name: string, candidates: Artist[]): Match | null {
  if (normalizeArtistName(name) === '') return null;

  let best: { id: string; name: string; score: number } | null = null;
  let runnerUpScore = Number.NEGATIVE_INFINITY;
  let runnerUpId = '';

  for (const candidate of candidates) {
    for (const candidateName of [candidate.name, ...(candidate.alternateNames ?? [])]) {
      const score = artistNameSimilarity(name, candidateName);
      if (!best || score > best.score) {
        // The old best becomes the runner-up, unless it is the same record under an alias.
        if (best && best.id !== candidate.id) {
          runnerUpScore = best.score;
          runnerUpId = best.id;
        }
        best = { id: candidate.id, name: candidate.name, score };
      } else if (candidate.id !== best.id && score > runnerUpScore) {
        runnerUpScore = score;
        runnerUpId = candidate.id;
      }
    }
  }

  if (!best || best.score < REPORT_THRESHOLD) return null;

  return {
    ...best,
    ambiguous: runnerUpId !== '' && runnerUpScore >= best.score - TIE_EPSILON,
  };
}

function blankProposal(artistId: string, artistName: string, proposalType: ProposalType): Proposal {
  return {
    artistId,
    artistName,
    proposalType,
    value: '',
    relationship: '',
    role: '',
    startYear: '',
    endYear: '',
    resolvedId: '',
    matchName: '',
    matchScore: '',
    confidence: '',
    sourceSentence: '',
    decision: '',
    correctedValue: '',
  };
}

const yearText = (year: number | null | undefined): string => (year ? String(year) : '');

/**
 * The three match columns for a row.
 *
 * A pre-filled `resolvedId` is a recommendation a reviewer will mostly accept, so it is
 * withheld unless the match is both strong and unambiguous. The name and score are always
 * reported — a near-miss is exactly what stops someone creating a duplicate.
 */
function matchColumns(match: ReturnType<typeof bestArtistMatch>) {
  if (!match) return { resolvedId: '', matchName: '', matchScore: '' };
  return {
    resolvedId: match.score >= RESOLVE_THRESHOLD && !match.ambiguous ? match.id : '',
    matchName: match.ambiguous ? `${match.name} (ambiguous)` : match.name,
    matchScore: match.score.toFixed(2),
  };
}

/**
 * Flattens an extraction into one row per proposed fact.
 *
 * Only guru names are matched against the artist corpus. Organisations are left unresolved on
 * purpose: there is no fuzzy organiser matcher to mirror `artistNameSimilarity`, and an exact
 * lookup would resolve "IIM Bangalore" against "Indian Institute of Management Bangalore" not
 * at all while giving a reviewer false confidence when it did hit. Better a blank column that
 * says "decide this" than a column that is quietly wrong.
 */
export function toProposals(
  artist: { id: string; name: string },
  extraction: BioExtraction,
  candidates: Artist[]
): Proposal[] {
  const rows: Proposal[] = [];

  // The subject cannot be their own guru, so they are not a candidate for one.
  //
  // Without this the failure is quiet and convincing: a bio opens with the artist's full name,
  // the model attributes one sentence to the wrong person, and the row comes back matched to
  // the subject at score 1.00 — which is exactly the row a reviewer waves through. The result
  // is an artist listed as their own guru, rendering on their own lineage section and linking
  // to themselves.
  const others = candidates.filter(c => c.id !== artist.id);

  for (const guru of extraction.gurus) {
    // A guru the model would not classify is a judgment call, not a fact. It goes where the
    // other judgment calls go rather than becoming a lineage edge with a blank relationship —
    // the importer would drop it anyway, silently and much further downstream.
    if (!guru.relationship) {
      rows.push({
        ...blankProposal(artist.id, artist.name, 'unresolved'),
        value: guru.name,
        role: 'named as a teacher, but the kind of instruction is unclear',
        confidence: guru.confidence,
        sourceSentence: guru.sourceSentence ?? '',
      });
      continue;
    }

    const match = bestArtistMatch(guru.name, others);
    rows.push({
      ...blankProposal(artist.id, artist.name, 'guru'),
      value: guru.name,
      relationship: guru.relationship,
      startYear: yearText(guru.startYear),
      endYear: yearText(guru.endYear),
      ...matchColumns(match),
      confidence: guru.confidence,
      sourceSentence: guru.sourceSentence ?? '',
    });
  }

  for (const affiliation of extraction.affiliations) {
    rows.push({
      ...blankProposal(artist.id, artist.name, 'affiliation'),
      value: affiliation.organisationName,
      role: affiliation.role ?? '',
      startYear: yearText(affiliation.startYear),
      endYear: yearText(affiliation.endYear),
      // "current" rides the relationship column rather than earning one of its own: the CSV is
      // already fourteen columns wide and this is the only boolean in it.
      relationship: affiliation.isCurrent ? 'current' : '',
      confidence: affiliation.confidence,
      sourceSentence: affiliation.sourceSentence ?? '',
    });
  }

  for (const credential of extraction.credentials) {
    rows.push({
      ...blankProposal(artist.id, artist.name, 'credential'),
      value: credential.qualification,
      role: credential.institution ?? '',
      startYear: yearText(credential.year),
      confidence: credential.confidence,
      sourceSentence: credential.sourceSentence ?? '',
    });
  }

  for (const work of extraction.works) {
    rows.push({
      ...blankProposal(artist.id, artist.name, 'work'),
      value: work.title,
      role: work.role ?? '',
      startYear: yearText(work.year),
      confidence: work.confidence,
      sourceSentence: work.sourceSentence ?? '',
    });
  }

  const arangetram = extraction.arangetram;
  // A year alone is still worth a row; a row with neither year nor guru says nothing.
  if (arangetram && (arangetram.year || arangetram.guruName)) {
    const match = arangetram.guruName ? bestArtistMatch(arangetram.guruName, others) : null;
    rows.push({
      ...blankProposal(artist.id, artist.name, 'arangetram'),
      value: arangetram.guruName ?? '',
      role: arangetram.venueName ?? '',
      startYear: yearText(arangetram.year),
      ...matchColumns(match),
      confidence: arangetram.confidence,
      sourceSentence: arangetram.sourceSentence ?? '',
    });
  }

  // Last, so a reviewer scanning a sorted sheet reads the judgment calls together.
  for (const item of extraction.unresolved) {
    rows.push({
      ...blankProposal(artist.id, artist.name, 'unresolved'),
      value: item.text,
      role: item.reason,
      sourceSentence: item.text,
    });
  }

  return rows;
}

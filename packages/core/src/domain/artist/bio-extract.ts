import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { GURU_RELATIONSHIPS } from './schema';

/**
 * Pulls the structured facts out of an artist's prose biography.
 *
 * The point of this module is what it *refuses* to do. A naive name-extractor run over a
 * typical bio produces edges that are wrong in ways nobody catches later: an influence read as
 * a guru, a university professor read as a discipleship, three workshop teachers read as
 * lineage. A wrong guru edge renders on two artist pages and propagates into the lineage graph;
 * a missing one is invisible and gets filled in by the claim flow. So this is tuned hard for
 * precision, and anything it cannot classify confidently goes to `unresolved` for a human.
 *
 * Extraction seeds fields, it does not bind to them. Fields are canonical and the bio is an
 * import source read once — nothing here may run on a write trigger or in a loop, because the
 * output is nondeterministic and a re-run would clobber a moderator's correction without even
 * failing the same way twice.
 */

// gemini-flash-lite-latest, not the 2.5-flash the poster pipeline pins. This is a text-only
// classification job over a few hundred short documents, run from a script rather than a
// request path.
const MODEL = 'gemini-flash-lite-latest';

export const EXTRACTION_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type ExtractionConfidence = (typeof EXTRACTION_CONFIDENCES)[number];

const ConfidenceSchema = z.enum(EXTRACTION_CONFIDENCES);

export const ExtractedGuruSchema = z.object({
  name: z.string().min(1),
  /**
   * Nullable, and that is the precision rule enforced in code rather than asserted in a prompt.
   *
   * The prompt tells the model to refuse rather than guess. Making this a required enum
   * punished it for obeying: a single `relationship: null` failed the parse for the **whole
   * document**, losing that artist's affiliations, credentials, works and — worst — their
   * `unresolved` rows, which are the most useful output. `toProposals` routes a null
   * relationship into `unresolved`, so refusing costs one row instead of the artist.
   */
  relationship: z.enum(GURU_RELATIONSHIPS).nullish(),
  startYear: z.number().int().min(1800).max(2100).nullish(),
  endYear: z.number().int().min(1800).max(2100).nullish(),
  discipline: z.string().nullish(),
  confidence: ConfidenceSchema,
  /** The sentence this came from, so a reviewer can judge without reopening the bio. */
  sourceSentence: z.string().nullish(),
});

export const ExtractedAffiliationSchema = z.object({
  organisationName: z.string().min(1),
  role: z.string().nullish(),
  discipline: z.string().nullish(),
  startYear: z.number().int().min(1800).max(2100).nullish(),
  endYear: z.number().int().min(1800).max(2100).nullish(),
  isCurrent: z.boolean().nullish(),
  confidence: ConfidenceSchema,
  sourceSentence: z.string().nullish(),
});

export const ExtractedCredentialSchema = z.object({
  qualification: z.string().min(1),
  institution: z.string().nullish(),
  year: z.number().int().min(1800).max(2100).nullish(),
  confidence: ConfidenceSchema,
  sourceSentence: z.string().nullish(),
});

export const ExtractedWorkSchema = z.object({
  title: z.string().min(1),
  role: z.string().nullish(),
  year: z.number().int().min(1800).max(2100).nullish(),
  confidence: ConfidenceSchema,
  sourceSentence: z.string().nullish(),
});

export const ExtractedArangetramSchema = z.object({
  year: z.number().int().min(1800).max(2100).nullish(),
  guruName: z.string().nullish(),
  venueName: z.string().nullish(),
  confidence: ConfidenceSchema,
  sourceSentence: z.string().nullish(),
});

/**
 * A claim the extractor deliberately declined to convert.
 *
 * This is the most useful part of the output, not an error channel: it hands a reviewer
 * exactly the sentences where the real judgment calls sit.
 */
export const UnresolvedSchema = z.object({
  text: z.string().min(1),
  reason: z.string().min(1),
});

export const BioExtractionSchema = z.object({
  gurus: z.array(ExtractedGuruSchema).default([]),
  affiliations: z.array(ExtractedAffiliationSchema).default([]),
  credentials: z.array(ExtractedCredentialSchema).default([]),
  works: z.array(ExtractedWorkSchema).default([]),
  arangetram: ExtractedArangetramSchema.nullish(),
  unresolved: z.array(UnresolvedSchema).default([]),
});

export type BioExtraction = z.infer<typeof BioExtractionSchema>;
export type ExtractedGuru = z.infer<typeof ExtractedGuruSchema>;
export type ExtractedAffiliation = z.infer<typeof ExtractedAffiliationSchema>;
export type ExtractedCredential = z.infer<typeof ExtractedCredentialSchema>;
export type ExtractedWork = z.infer<typeof ExtractedWorkSchema>;

const BIO_EXTRACTION_PROMPT = `You extract structured facts from the biography of an Indian classical arts performer.

Return ONLY JSON matching this shape:
{
  "gurus": [{ "name", "relationship", "startYear", "endYear", "discipline", "confidence", "sourceSentence" }],
  "affiliations": [{ "organisationName", "role", "discipline", "startYear", "endYear", "isCurrent", "confidence", "sourceSentence" }],
  "credentials": [{ "qualification", "institution", "year", "confidence", "sourceSentence" }],
  "works": [{ "title", "role", "year", "confidence", "sourceSentence" }],
  "arangetram": { "year", "guruName", "venueName", "confidence", "sourceSentence" },
  "unresolved": [{ "text", "reason" }]
}

Use null for anything not stated. "confidence" is "high", "medium" or "low".

CLASSIFY THE RELATIONSHIP. Do not merely pull names. Every guru MUST carry one of:
- "primary": the first or main teacher; where training began. "began training under X", "senior disciple of X".
- "advanced": later or higher training under a named teacher. "advanced training with X", "refined under X".
- "workshop": short-form exposure. "attended workshops with X", "masterclasses under X".
- "institutional": taught the artist during a degree or diploma, not a discipleship. "studied under Professor X at Y University".

These distinctions matter more than completeness. In this tradition, guru lineage is the
credential, so calling a workshop teacher a primary guru is a substantive false claim.

REFUSE rather than guess. Put it in "unresolved" with a reason when:
- The text describes influence or admiration, not instruction. "inspired by X", "influenced by the teachings of X", "in the tradition of X" are NOT guru edges — the person may have died long before the artist was born.
- A qualification or role is in progress with no completion. "currently pursuing a PhD at X".
- You cannot tell which of the four relationships applies.
- A name is ambiguous, or the sentence names a person without saying what they did.
Bias hard toward "unresolved". A missing fact is invisible and gets filled in later; a wrong
one renders on two pages and is very hard to detect.

OTHER RULES:
- "affiliations" are institutional ROLES: founder, artistic director, faculty, adjunct faculty. A school the artist merely trained at is a credential or a guru, not an affiliation.
- "works" are pieces the artist authored, choreographed or directed — productions, ballets. NOT pieces they performed from existing repertoire, and NOT festivals or venues they appeared at.
- Do NOT extract tours, festival appearances or concert venues at all. Those come from event data.
- Strip honorifics from every name: Sri, Smt., Guru, Vidushi, Vidhushi, Dr., Padma Shri, Kalaimamani.
- "arangetram" is the debut recital that ends formal training. Only fill it if the text names one.
- Copy "sourceSentence" verbatim from the bio. Never paraphrase it.

BIOGRAPHY:`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
}

const EMPTY_EXTRACTION: BioExtraction = {
  gurus: [],
  affiliations: [],
  credentials: [],
  works: [],
  arangetram: null,
  unresolved: [],
};

/**
 * Runs one biography through the model. Pure of any database access, so the caller controls
 * name resolution and nothing here can create an entity by accident.
 */
export async function extractFromBiography(biography: string): Promise<BioExtraction> {
  if (!biography.trim()) {
    return EMPTY_EXTRACTION;
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `${BIO_EXTRACTION_PROMPT}\n${biography}` }] }],
    config: {
      responseMimeType: 'application/json',
      // Same low temperature the poster pipeline uses: this is classification, and a model
      // free to be creative here invents relationships.
      temperature: 0.1,
    },
  });

  if (!response.text) {
    throw new Error('Empty response from Gemini API');
  }

  return BioExtractionSchema.parse(JSON.parse(response.text));
}

const REWRITE_PROMPT = `You rewrite the biography of an Indian classical arts performer for a reference work.

You are given the current biography and the facts that are now stored as structured fields on
the artist's page, each rendering in its own labelled section.

Rewrite the biography so that it keeps ONLY narrative and interpretation. Remove every fact
that now lives in a field — it is not being deleted, it is already displayed elsewhere on the
same page, and repeating it makes the prose longer without telling a reader anything new.

RULES:
- Target about 120 words. Never exceed 200.
- Neutral and factual, the register of an encyclopedia. Delete "distinguished", "esteemed",
  "prestigious", "renowned", "timeless traditions", "mesmerising", "inspiring audiences
  worldwide" and every phrase like them. They are what makes each bio read like every other.
- Do not restate: gurus, awards, affiliations, qualifications, productions, the arangetram,
  birth year, birth place, city, instrument, or active years. All of those are fields.
- Keep what a field cannot hold: what distinguishes this artist's practice, how their
  interests connect, notable circumstances a bare fact would miss.
- Invent nothing. Every claim must be traceable to the biography you were given.
- If after removing the fields there is nothing left worth saying, return an empty string
  rather than padding it out.
- Return ONLY the rewritten prose. No preamble, no headings, no quotation marks.

CURRENT BIOGRAPHY:`;

/**
 * The second pass: shortens a bio to narrative only, once its facts are safely in fields.
 *
 * Safe to run *because extraction ran first* — nothing is being lost, only relocated. Running
 * this against a profile whose fields are still empty would genuinely destroy information, so
 * the caller must confirm the fields are populated.
 *
 * The result lands as an `Edit` draft like any other change, so a moderator sees a diff before
 * anything is published, and the original text stays on the record for a better model to
 * re-read later.
 */
export async function rewriteBiography(
  biography: string,
  storedFacts: Record<string, unknown>
): Promise<string> {
  if (!biography.trim()) return '';

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${REWRITE_PROMPT}\n${biography}\n\nFACTS ALREADY STORED AS FIELDS:\n${JSON.stringify(storedFacts, null, 2)}`,
          },
        ],
      },
    ],
    // No responseMimeType here: this returns prose, not JSON. Temperature stays low — the job
    // is to cut, and a model given room to write invents.
    config: { temperature: 0.2 },
  });

  return (response.text ?? '').trim();
}

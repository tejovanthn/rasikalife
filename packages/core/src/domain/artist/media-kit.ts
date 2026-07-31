import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { GURU_RELATIONSHIP_PROSE } from './client';

/**
 * Generates promotional copy *from* an artist's structured fields — the inverse of
 * `bio-extract`, and deliberately the opposite direction of derivation.
 *
 * The platform reads as a reference work: neutral, factual, every claim in a field. But an
 * artist still needs a paragraph to send a sabha, and a programmer still needs something to put
 * in a concert listing. Left to themselves those are written as press-kit prose and eventually
 * pasted back into the biography, which is how the record filled up with "distinguished" and
 * "timeless traditions" in the first place.
 *
 * Generating the flowery version from the verified fields inverts that. Marketing copy becomes
 * an output, not the source, and it cannot introduce a fact nobody checked — the model is given
 * a fact list and nothing else, and is told in as many words that it may not add to it.
 *
 * **This never writes back to the biography.** It is cached on the record and read; the
 * `biography` field remains the neutral narrative the wizard's word counter argues for.
 */

/**
 * Bumped when the prompt or the fact set changes shape.
 *
 * Folded into the hash, so a change here invalidates every cached kit rather than leaving old
 * ones frozen with no way to refresh them but clearing the attribute by hand — the mistake the
 * OG card made before `CARD_VERSION` joined its cache key.
 */
export const MEDIA_KIT_VERSION = 1;

const MODEL = 'gemini-flash-lite-latest';

export const MediaKitBiosSchema = z.object({
  /** One or two sentences, for a programme note or a listing. */
  short: z.string().min(1),
  /** A paragraph, for a festival submission or a press release. */
  long: z.string().min(1),
});

export type MediaKitBios = z.infer<typeof MediaKitBiosSchema>;

/** Everything the copy may draw on. Nothing outside this reaches the model. */
export interface MediaKitFacts {
  name: string;
  title?: string;
  instrument?: string;
  city?: string;
  activeYears?: string;
  birthPlace?: string;
  specialisations: string[];
  gurus: Array<{ name: string; relationship?: string; fromYear?: number; toYear?: number }>;
  credentials: Array<{ qualification: string; institution?: string; year?: number }>;
  works: Array<{ title: string; role?: string; year?: number }>;
  affiliations: Array<{ organisationName: string; role?: string; startYear?: number }>;
  awards: Array<{ awardName: string; year?: number }>;
  arangetram?: { year?: number; guruName?: string; venueName?: string };
}

/**
 * The cache key: a hash of exactly the facts the copy is generated from.
 *
 * Same shape as the OG card's content hash and for the same reason — when a fact changes the
 * hash changes, the stored kit stops matching, and the next request regenerates. A kit whose
 * facts are untouched is never regenerated, so the cost is one call per artist per version of
 * their data rather than one per view.
 */
export function mediaKitFactsHash(facts: MediaKitFacts): string {
  // Field-by-field rather than stringifying whatever was handed in. The guarantee wanted here is
  // that only what the copy is written *from* can invalidate it — a new photo, a view counter, a
  // bumped updatedAt must not cost a model call. Hashing the argument wholesale makes that true
  // only for as long as every caller remembers to build a clean object, and the first one to
  // pass a whole artist record would break caching site-wide without failing anything.
  const canonical = {
    version: MEDIA_KIT_VERSION,
    name: facts.name,
    title: facts.title,
    instrument: facts.instrument,
    city: facts.city,
    activeYears: facts.activeYears,
    birthPlace: facts.birthPlace,
    specialisations: facts.specialisations,
    gurus: facts.gurus.map(g => [g.name, g.relationship, g.fromYear, g.toYear]),
    credentials: facts.credentials.map(c => [c.qualification, c.institution, c.year]),
    works: facts.works.map(w => [w.title, w.role, w.year]),
    affiliations: facts.affiliations.map(a => [a.organisationName, a.role, a.startYear]),
    awards: facts.awards.map(a => [a.awardName, a.year]),
    arangetram: facts.arangetram
      ? [facts.arangetram.year, facts.arangetram.guruName, facts.arangetram.venueName]
      : null,
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}

function factLines(facts: MediaKitFacts): string {
  const lines: string[] = [`Name: ${facts.name}`];
  if (facts.title) lines.push(`Honorific: ${facts.title}`);
  if (facts.instrument) lines.push(`Discipline: ${facts.instrument}`);
  if (facts.city) lines.push(`Based in: ${facts.city}`);
  if (facts.birthPlace) lines.push(`From: ${facts.birthPlace}`);
  if (facts.activeYears) lines.push(`Active: ${facts.activeYears}`);
  if (facts.specialisations.length) {
    lines.push(`Specialisations: ${facts.specialisations.join(', ')}`);
  }

  for (const guru of facts.gurus) {
    // The relationship is spelled out rather than passed as a bare enum, so the model cannot
    // read "workshop" as discipleship and write "a disciple of". The distinction is the whole
    // reason the field exists, and it would be undone by exactly this kind of copy.
    const kind = guru.relationship
      ? (GURU_RELATIONSHIP_PROSE[guru.relationship as keyof typeof GURU_RELATIONSHIP_PROSE] ??
        'studied with')
      : 'studied under';
    const years = [guru.fromYear, guru.toYear].filter(Boolean).join('–');
    lines.push(`Guru: ${kind} ${guru.name}${years ? ` (${years})` : ''}`);
  }

  if (facts.arangetram?.year || facts.arangetram?.guruName) {
    const parts = [
      facts.arangetram.year ? String(facts.arangetram.year) : '',
      facts.arangetram.guruName ? `under ${facts.arangetram.guruName}` : '',
      facts.arangetram.venueName ? `at ${facts.arangetram.venueName}` : '',
    ].filter(Boolean);
    lines.push(`Arangetram: ${parts.join(', ')}`);
  }

  for (const affiliation of facts.affiliations) {
    const since = affiliation.startYear ? ` since ${affiliation.startYear}` : '';
    lines.push(
      `Affiliation: ${affiliation.role ?? 'associated with'} at ${affiliation.organisationName}${since}`
    );
  }
  for (const credential of facts.credentials) {
    const where = credential.institution ? ` from ${credential.institution}` : '';
    const when = credential.year ? ` (${credential.year})` : '';
    lines.push(`Qualification: ${credential.qualification}${where}${when}`);
  }
  for (const work of facts.works) {
    const when = work.year ? ` (${work.year})` : '';
    lines.push(`Production: ${work.title}${work.role ? `, as ${work.role}` : ''}${when}`);
  }
  for (const award of facts.awards) {
    lines.push(`Award: ${award.awardName}${award.year ? ` (${award.year})` : ''}`);
  }

  return lines.join('\n');
}

const MEDIA_KIT_PROMPT = `You write promotional copy for an Indian classical arts performer, for their own media kit.

You are given a list of verified facts. Write two biographies from them.

Return ONLY JSON: { "short": "...", "long": "..." }

- "short": one or two sentences, about 50 words. For a concert programme or a listing.
- "long": one or two paragraphs, about 200 words. For a festival submission or a press release.

REGISTER: warm and admiring, the register of a programme note rather than an encyclopedia. This
copy exists to introduce the artist to an audience, so it may praise. Write in the third person.

THE ONE RULE THAT MATTERS: invent nothing. Every fact must come from the list. Do not add a year,
a place, a guru, an award, a title, or a claim about influence or standing that is not given.
Do not write "one of India's foremost" or "widely regarded as" — those are claims about
reputation, and no fact below supports them. Praise the work that IS listed; do not assert a
standing that is not.

Do not restate the relationship words mechanically. "Studied under X" and "attended workshops
with X" mean different things and the list distinguishes them — preserve that difference in
your prose. Never describe a workshop teacher or a university lecturer as a guru or a
discipleship.

If the facts are thin, write something short and honest rather than padding it with adjectives.
A two-sentence "long" biography is a correct answer when there are only two facts.

FACTS:`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
}

/** Generates both bios. Pure of storage — the caller decides where the result lives. */
export async function generateMediaKitBios(facts: MediaKitFacts): Promise<MediaKitBios> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `${MEDIA_KIT_PROMPT}\n${factLines(facts)}` }] }],
    config: {
      responseMimeType: 'application/json',
      // Higher than the extractor's 0.1: this one is writing prose rather than classifying, and
      // at 0.1 every artist's copy comes out with the same sentence shapes — which is the
      // sameness this whole effort is trying to get away from.
      temperature: 0.7,
    },
  });

  if (!response.text) {
    throw new Error('Empty response from Gemini API');
  }

  return MediaKitBiosSchema.parse(JSON.parse(response.text));
}

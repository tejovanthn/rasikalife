import { describe, expect, it } from 'vitest';

import { AddArtistAffiliationSchema } from '../artist-affiliation/schema';
import {
  ExtractedAffiliationSchema,
  ExtractedCredentialSchema,
  ExtractedGuruSchema,
  ExtractedWorkSchema,
} from './bio-extract';
import { CredentialSchema, GURU_RELATIONSHIPS, GuruSchema, WorkSchema } from './schema';

/**
 * The seam between what the extractor produces and what the database accepts.
 *
 * These are two deliberately different schemas: the extractor's rows carry `confidence` and
 * `sourceSentence`, are `.nullish()` throughout because a model emits `null` for "not stated",
 * and use `startYear`/`endYear` uniformly where the guru record says `fromYear`/`toYear`.
 * Collapsing them into one schema would force the database to accept a confidence score and
 * the extractor to invent a vocabulary it does not use.
 *
 * So the guard is here instead: take the extractor's output, apply the mapping the importer
 * applies, and assert the domain schema accepts the result. A field renamed or a bound widened
 * on either side fails here rather than one artist at a time during an import run.
 */

/** The mapping `importBioExtractions` performs, kept in one place so the test tests the real one. */
const toGuruRecord = (extracted: Record<string, unknown>) => ({
  name: extracted.name,
  relationship: extracted.relationship ?? undefined,
  fromYear: extracted.startYear ?? undefined,
  toYear: extracted.endYear ?? undefined,
  discipline: extracted.discipline ?? undefined,
  source: 'bio-extraction' as const,
});

describe('extractor → record contract', () => {
  describe('gurus', () => {
    it('maps a fully-populated extraction onto a valid guru record', () => {
      const extracted = ExtractedGuruSchema.parse({
        name: 'Radha Shridhar',
        relationship: 'advanced',
        startYear: 1998,
        endYear: 2010,
        discipline: 'Bharatanatyam',
        confidence: 'high',
        sourceSentence: 'She trained under Radha Shridhar.',
      });

      expect(() => GuruSchema.parse(toGuruRecord(extracted))).not.toThrow();
    });

    it('maps an extraction with every optional null onto a valid record', () => {
      const extracted = ExtractedGuruSchema.parse({
        name: 'Radha Shridhar',
        relationship: null,
        startYear: null,
        endYear: null,
        discipline: null,
        confidence: 'low',
        sourceSentence: null,
      });

      // null must become absent, not null — the record schema does not accept null.
      expect(() => GuruSchema.parse(toGuruRecord(extracted))).not.toThrow();
    });

    // The two schemas name these differently on purpose. Nothing but this test notices if the
    // importer's mapping stops agreeing with either side.
    it('pins the year field rename that the importer performs', () => {
      expect(Object.keys(ExtractedGuruSchema.shape)).toEqual(
        expect.arrayContaining(['startYear', 'endYear'])
      );
      expect(Object.keys(GuruSchema.shape)).toEqual(expect.arrayContaining(['fromYear', 'toYear']));
    });

    it('shares one relationship vocabulary with the record', () => {
      const extractorValues = ExtractedGuruSchema.shape.relationship;
      for (const relationship of GURU_RELATIONSHIPS) {
        expect(() => extractorValues.parse(relationship)).not.toThrow();
        expect(() => GuruSchema.parse({ name: 'X', relationship })).not.toThrow();
      }
    });

    // Both derive from YearSchema. If one is widened and the other is not, extraction accepts
    // a year the write then rejects — and the failure surfaces mid-import, per artist.
    it('agrees with the record on what counts as a year', () => {
      for (const year of [1799, 2101]) {
        expect(
          ExtractedGuruSchema.safeParse({ name: 'X', startYear: year, confidence: 'high' }).success
        ).toBe(false);
        expect(GuruSchema.safeParse({ name: 'X', fromYear: year }).success).toBe(false);
      }
      for (const year of [1800, 2100]) {
        expect(
          ExtractedGuruSchema.safeParse({ name: 'X', startYear: year, confidence: 'high' }).success
        ).toBe(true);
        expect(GuruSchema.safeParse({ name: 'X', fromYear: year }).success).toBe(true);
      }
    });
  });

  describe('credentials', () => {
    it('maps an extraction onto a valid credential record', () => {
      const extracted = ExtractedCredentialSchema.parse({
        qualification: 'MA Bharatanatyam',
        institution: 'SASTRA University',
        year: 2016,
        confidence: 'high',
      });

      expect(() =>
        CredentialSchema.parse({
          qualification: extracted.qualification,
          institution: extracted.institution ?? undefined,
          year: extracted.year ?? undefined,
          source: 'bio-extraction',
        })
      ).not.toThrow();
    });

    it('maps an extraction with no institution', () => {
      const extracted = ExtractedCredentialSchema.parse({
        qualification: 'MA Yoga Therapy',
        institution: null,
        year: null,
        confidence: 'medium',
      });

      expect(() =>
        CredentialSchema.parse({
          qualification: extracted.qualification,
          institution: extracted.institution ?? undefined,
          year: extracted.year ?? undefined,
        })
      ).not.toThrow();
    });
  });

  describe('works', () => {
    it('maps an extraction onto a valid work record', () => {
      const extracted = ExtractedWorkSchema.parse({
        title: 'Matrutvam',
        role: 'director',
        year: 2023,
        confidence: 'high',
      });

      expect(() =>
        WorkSchema.parse({
          title: extracted.title,
          role: extracted.role ?? undefined,
          year: extracted.year ?? undefined,
          source: 'bio-extraction',
        })
      ).not.toThrow();
    });
  });

  describe('affiliations', () => {
    it('maps an extraction onto a valid junction row once the organisation resolves', () => {
      const extracted = ExtractedAffiliationSchema.parse({
        organisationName: 'Trayag Natyalaya',
        role: 'founder, artistic director',
        startYear: 2017,
        isCurrent: true,
        confidence: 'high',
      });

      expect(() =>
        AddArtistAffiliationSchema.parse({
          artistId: 'art_1',
          artistName: 'Yagnika Madhusudan Iyengar',
          // The extractor never supplies this — it is what a human resolves. See the entity.
          organiserId: 'org_1',
          organisationName: extracted.organisationName,
          role: extracted.role ?? undefined,
          startYear: extracted.startYear ?? undefined,
          endYear: extracted.endYear ?? undefined,
          isCurrent: extracted.isCurrent ?? undefined,
          source: 'bio-extraction',
        })
      ).not.toThrow();
    });

    // The extractor can emit both; the junction refuses both. The importer must not pass an
    // endYear through alongside isCurrent, and this is what says so.
    it('refuses an extraction that claims a role is both ended and current', () => {
      const extracted = ExtractedAffiliationSchema.parse({
        organisationName: 'Christ University',
        endYear: 2015,
        isCurrent: true,
        confidence: 'medium',
      });

      expect(
        AddArtistAffiliationSchema.safeParse({
          artistId: 'art_1',
          artistName: 'X',
          organiserId: 'org_1',
          organisationName: extracted.organisationName,
          endYear: extracted.endYear ?? undefined,
          isCurrent: extracted.isCurrent ?? undefined,
        }).success
      ).toBe(false);
    });
  });

  // Every row the importer writes is stamped with this, so the record schema has to accept it.
  it('accepts the source the importer stamps on every row', () => {
    expect(() => GuruSchema.parse({ name: 'X', source: 'bio-extraction' })).not.toThrow();
    expect(() =>
      CredentialSchema.parse({ qualification: 'X', source: 'bio-extraction' })
    ).not.toThrow();
    expect(() => WorkSchema.parse({ title: 'X', source: 'bio-extraction' })).not.toThrow();
  });
});

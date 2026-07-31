import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({ models: { generateContent } })),
}));

import { BioExtractionSchema, extractFromBiography, rewriteBiography } from './bio-extract';

function respondsWith(payload: unknown) {
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) });
}

describe('bio-extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  describe('extractFromBiography', () => {
    it('returns an empty extraction for a blank bio without calling the model', async () => {
      const result = await extractFromBiography('   ');

      expect(generateContent).not.toHaveBeenCalled();
      expect(result.gurus).toEqual([]);
      expect(result.unresolved).toEqual([]);
    });

    it('uses the flash-lite model in JSON mode at a low temperature', async () => {
      respondsWith({ gurus: [] });

      await extractFromBiography('A biography.');

      const call = generateContent.mock.calls[0][0];
      expect(call.model).toBe('gemini-flash-lite-latest');
      expect(call.config.responseMimeType).toBe('application/json');
      expect(call.config.temperature).toBe(0.1);
    });

    it('parses a full extraction', async () => {
      respondsWith({
        gurus: [
          {
            name: 'Sneha Devanandan',
            relationship: 'primary',
            startYear: 1997,
            confidence: 'high',
            sourceSentence: 'She began her training under Sneha Devanandan.',
          },
        ],
        affiliations: [
          {
            organisationName: 'Trayag Natyalaya',
            role: 'founder',
            startYear: 2017,
            isCurrent: true,
            confidence: 'high',
          },
        ],
        credentials: [{ qualification: 'MA Bharatanatyam', confidence: 'high' }],
        works: [{ title: 'Matrutvam', confidence: 'high' }],
        unresolved: [{ text: 'influenced by X', reason: 'influence, not instruction' }],
      });

      const result = await extractFromBiography('A biography.');

      expect(result.gurus[0].relationship).toBe('primary');
      expect(result.affiliations[0].organisationName).toBe('Trayag Natyalaya');
      expect(result.credentials[0].qualification).toBe('MA Bharatanatyam');
      expect(result.works[0].title).toBe('Matrutvam');
      expect(result.unresolved[0].reason).toBe('influence, not instruction');
    });

    it('throws on an empty model response rather than returning nothing silently', async () => {
      generateContent.mockResolvedValueOnce({ text: '' });

      await expect(extractFromBiography('A biography.')).rejects.toThrow('Empty response');
    });
  });

  describe('BioExtractionSchema', () => {
    it('defaults every list so a sparse response still parses', () => {
      const parsed = BioExtractionSchema.parse({});

      expect(parsed).toMatchObject({
        gurus: [],
        affiliations: [],
        credentials: [],
        works: [],
        unresolved: [],
      });
    });

    // A relationship outside the closed set is dropped to "unclassified", which toProposals
    // routes to `unresolved`. It must never reach a record as an unusable value, and it must
    // never cost the rest of the document — the failure mode this schema keeps relearning.
    it('drops a relationship outside the closed set instead of failing the document', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [{ name: 'X', relationship: 'inspired-by', confidence: 'high' }],
        works: [{ title: 'Matrutvam', confidence: 'high' }],
      });

      expect(parsed.gurus[0].relationship).toBeFalsy();
      expect(parsed.works).toHaveLength(1);
    });

    // A model answering "Primary" has answered correctly in every sense that matters.
    it('accepts a relationship in any case', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [{ name: 'X', relationship: 'Primary', confidence: 'high' }],
      });

      expect(parsed.gurus[0].relationship).toBe('primary');
    });

    // The reported failure: Gemini returned "2017" and the strict schema lost the whole
    // extraction — every guru, work and unresolved row with it.
    it('reads a year the model sent as a string', () => {
      const parsed = BioExtractionSchema.parse({
        affiliations: [
          { organisationName: 'Trayag Natyalaya', startYear: '2017', confidence: 'high' },
        ],
      });

      expect(parsed.affiliations[0].startYear).toBe(2017);
    });

    it('reads a boolean the model sent as a string', () => {
      const parsed = BioExtractionSchema.parse({
        affiliations: [
          { organisationName: 'Trayag Natyalaya', isCurrent: 'true', confidence: 'high' },
        ],
      });

      expect(parsed.affiliations[0].isCurrent).toBe(true);
    });

    // The general rule behind all of the above: one malformed row is worth losing, the other
    // nineteen are not, and neither is the unresolved list.
    it('keeps the rows that parse when one row is unusable', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [
          { name: 'Radha Shridhar', relationship: 'advanced', confidence: 'high' },
          { relationship: 'primary', confidence: 'high' },
          'not even an object',
        ],
        unresolved: [{ text: 'influenced by X', reason: 'influence, not instruction' }],
      });

      expect(parsed.gurus).toHaveLength(1);
      expect(parsed.gurus[0].name).toBe('Radha Shridhar');
      expect(parsed.unresolved).toHaveLength(1);
    });

    // The prompt tells the model to refuse rather than guess. A required enum punished it for
    // obeying — one null relationship failed the parse for the whole document, losing that
    // artist's affiliations, works and unresolved rows. toProposals routes these to review.
    it('accepts a guru the model declined to classify', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [{ name: 'X', relationship: null, confidence: 'low' }],
      });

      expect(parsed.gurus[0].relationship).toBeFalsy();
    });

    it('accepts a guru with the relationship key absent entirely', () => {
      const parsed = BioExtractionSchema.parse({ gurus: [{ name: 'X', confidence: 'low' }] });

      expect(parsed.gurus[0].name).toBe('X');
    });

    // Confidence only drives a warning label, so a missing one falls back to the reading that
    // makes a reviewer look harder rather than costing the row.
    it('falls back to low confidence rather than dropping the row', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [{ name: 'X', relationship: 'primary' }],
      });

      expect(parsed.gurus[0].confidence).toBe('low');
    });

    it('drops an unresolved entry with no reason, keeping the rest', () => {
      const parsed = BioExtractionSchema.parse({
        unresolved: [{ text: 'something' }, { text: 'other', reason: 'influence' }],
      });

      expect(parsed.unresolved).toHaveLength(1);
      expect(parsed.unresolved[0].reason).toBe('influence');
    });

    it('accepts nulls for every optional, which is what the model emits', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [
          {
            name: 'X',
            relationship: 'workshop',
            startYear: null,
            endYear: null,
            discipline: null,
            confidence: 'medium',
            sourceSentence: null,
          },
        ],
        arangetram: null,
      });

      expect(parsed.gurus[0].name).toBe('X');
    });

    // Dropped, not stored and not thrown. What survives is always a real year or nothing, so
    // the record can never be handed something it would reject.
    it('drops a year outside the plausible range without losing the row', () => {
      const parsed = BioExtractionSchema.parse({
        gurus: [{ name: 'X', relationship: 'primary', startYear: 1500, confidence: 'high' }],
      });

      expect(parsed.gurus).toHaveLength(1);
      expect(parsed.gurus[0].startYear).toBeUndefined();
    });
  });

  describe('rewriteBiography', () => {
    it('returns an empty string for a blank bio without calling the model', async () => {
      expect(await rewriteBiography('   ', {})).toBe('');
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('asks for prose, not JSON, and passes the stored facts along', async () => {
      generateContent.mockResolvedValueOnce({ text: '  Rewritten prose.  ' });

      const result = await rewriteBiography('A long bio.', { gurus: [{ name: 'Radha Shridhar' }] });

      const call = generateContent.mock.calls[0][0];
      expect(call.config.responseMimeType).toBeUndefined();
      expect(call.contents[0].parts[0].text).toContain('Radha Shridhar');
      expect(call.contents[0].parts[0].text).toContain('A long bio.');
      expect(result).toBe('Rewritten prose.');
    });

    it('returns an empty string when the model says there is nothing left to keep', async () => {
      generateContent.mockResolvedValueOnce({ text: '' });

      expect(await rewriteBiography('A long bio.', {})).toBe('');
    });
  });
});

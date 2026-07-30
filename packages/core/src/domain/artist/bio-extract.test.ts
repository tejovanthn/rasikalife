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

    // The classification is the whole point. A model returning a relationship outside the
    // closed set must fail loudly here rather than reach the CSV as an unusable value.
    it('rejects a relationship outside the closed set', () => {
      expect(() =>
        BioExtractionSchema.parse({
          gurus: [{ name: 'X', relationship: 'inspired-by', confidence: 'high' }],
        })
      ).toThrow();
    });

    it('requires a relationship on every guru, so none can be left unclassified', () => {
      expect(() =>
        BioExtractionSchema.parse({ gurus: [{ name: 'X', confidence: 'high' }] })
      ).toThrow();
    });

    it('requires a confidence on every proposal', () => {
      expect(() =>
        BioExtractionSchema.parse({ gurus: [{ name: 'X', relationship: 'primary' }] })
      ).toThrow();
    });

    it('rejects an unresolved entry with no reason', () => {
      expect(() => BioExtractionSchema.parse({ unresolved: [{ text: 'something' }] })).toThrow();
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

    it('rejects a year outside the plausible range', () => {
      expect(() =>
        BioExtractionSchema.parse({
          gurus: [{ name: 'X', relationship: 'primary', startYear: 1500, confidence: 'high' }],
        })
      ).toThrow();
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

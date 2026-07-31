import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({ models: { generateContent } })),
}));

import type { MediaKitFacts } from './media-kit';
import { MediaKitBiosSchema, generateMediaKitBios, mediaKitFactsHash } from './media-kit';

function facts(overrides: Partial<MediaKitFacts> = {}): MediaKitFacts {
  return {
    name: 'Yagnika Madhusudan Iyengar',
    specialisations: [],
    gurus: [],
    credentials: [],
    works: [],
    affiliations: [],
    awards: [],
    ...overrides,
  };
}

describe('mediaKitFactsHash', () => {
  it('is stable for the same facts', () => {
    expect(mediaKitFactsHash(facts())).toBe(mediaKitFactsHash(facts()));
  });

  // The cache exists to avoid regenerating copy that would read the same. If a fact the copy
  // draws on changes, the stored hash must stop matching so the next request rewrites it.
  it('changes when a fact the copy draws on changes', () => {
    const before = mediaKitFactsHash(facts());

    expect(mediaKitFactsHash(facts({ city: 'Bangalore' }))).not.toBe(before);
    expect(
      mediaKitFactsHash(facts({ gurus: [{ name: 'Radha Shridhar', relationship: 'advanced' }] }))
    ).not.toBe(before);
    expect(mediaKitFactsHash(facts({ awards: [{ awardName: 'Kalaimamani' }] }))).not.toBe(before);
    expect(mediaKitFactsHash(facts({ works: [{ title: 'Matrutvam' }] }))).not.toBe(before);
  });

  // A guru relabelled from workshop to primary is a different claim, so it must be different
  // copy — this is the one field where a silent cache hit would preserve an overstatement.
  it('changes when a guru relationship is reclassified', () => {
    const asWorkshop = mediaKitFactsHash(
      facts({ gurus: [{ name: 'Bragha Bessell', relationship: 'workshop' }] })
    );
    const asPrimary = mediaKitFactsHash(
      facts({ gurus: [{ name: 'Bragha Bessell', relationship: 'primary' }] })
    );

    expect(asWorkshop).not.toBe(asPrimary);
  });

  // Editing a photo or bumping updatedAt must not invalidate copy that never mentioned them —
  // otherwise every unrelated save costs a model call.
  it('ignores fields the copy never sees', () => {
    const base = facts({ city: 'Bangalore' });
    const withNoise = { ...base, photoUrl: 'https://cdn/x.jpg', updatedAt: 'now' } as MediaKitFacts;

    expect(mediaKitFactsHash(withNoise)).toBe(mediaKitFactsHash(base));
  });
});

describe('generateMediaKitBios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('asks for JSON and parses both lengths', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ short: 'A short bio.', long: 'A longer bio.' }),
    });

    const result = await generateMediaKitBios(facts({ city: 'Bangalore' }));

    const call = generateContent.mock.calls[0][0];
    expect(call.config.responseMimeType).toBe('application/json');
    expect(result).toEqual({ short: 'A short bio.', long: 'A longer bio.' });
  });

  // Warmer than the extractor's 0.1. At that temperature every artist's copy comes out with the
  // same sentence shapes, which is the sameness this whole effort is undoing.
  it('runs warmer than the extractor, because it is writing rather than classifying', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ short: 'a', long: 'b' }) });

    await generateMediaKitBios(facts());

    expect(generateContent.mock.calls[0][0].config.temperature).toBeGreaterThan(0.1);
  });

  // The relationship is spelled out in prose before it reaches the model, so it cannot read a
  // bare "workshop" as discipleship and write "a disciple of".
  it('sends the relationship as words, not as the raw enum', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ short: 'a', long: 'b' }) });

    await generateMediaKitBios(
      facts({ gurus: [{ name: 'Bragha Bessell', relationship: 'workshop' }] })
    );

    const prompt = generateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(prompt).toContain('attended workshops with Bragha Bessell');
    expect(prompt).not.toMatch(/Guru: workshop/);
  });

  it('tells the model in the prompt that it may not invent facts', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ short: 'a', long: 'b' }) });

    await generateMediaKitBios(facts());

    const prompt = generateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(prompt).toContain('invent nothing');
    expect(prompt).toContain('one of India');
  });

  it('throws on an empty response rather than storing nothing', async () => {
    generateContent.mockResolvedValueOnce({ text: '' });

    await expect(generateMediaKitBios(facts())).rejects.toThrow('Empty response');
  });

  it('rejects a reply missing either length', () => {
    expect(() => MediaKitBiosSchema.parse({ short: 'only one' })).toThrow();
    expect(() => MediaKitBiosSchema.parse({ short: '', long: 'x' })).toThrow();
  });
});

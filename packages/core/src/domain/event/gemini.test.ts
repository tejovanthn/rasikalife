import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayInTimeZone } from '../../shared/timezone';
import { extractFromPoster } from './gemini';
import { DEFAULT_EVENT_TIMEZONE } from './schema';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

// Mock global fetch for image download
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockImageFetch() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  });
}

const singleEventClassification = {
  posterType: 'single-event',
  summary: 'Carnatic vocal concert by Vid. X',
  confidence: 0.95,
};

const festivalClassification = {
  posterType: 'festival',
  summary: '3-day Thyagaraja Aradhana festival',
  confidence: 0.9,
};

const multiEventClassification = {
  posterType: 'multi-event',
  summary: 'Two concerts: morning and evening',
  confidence: 0.85,
};

const singleEventExtraction = {
  isFestival: false,
  festival: null,
  events: [
    {
      title: 'Vocal Concert by Vid. X',
      startDateTime: '2026-02-15T18:00:00+05:30',
      artists: [{ title: 'Vid.', name: 'X', role: 'vocal' }],
      tags: ['carnatic', 'concert'],
      entryType: 'free',
    },
  ],
  confidence: 0.9,
};

const festivalExtraction = {
  isFestival: true,
  festival: {
    name: 'Thyagaraja Aradhana',
    description: 'Annual aradhana festival',
    startDate: '2026-01-20',
    endDate: '2026-01-22',
    tags: ['aradhana', 'carnatic'],
  },
  events: [
    {
      title: 'Day 1 - Vocal Concert',
      startDateTime: '2026-01-20T18:00:00+05:30',
      artists: [{ name: 'Artist A', role: 'vocal' }],
      tags: ['carnatic', 'concert'],
      entryType: 'free',
    },
    {
      title: 'Day 2 - Veena Recital',
      startDateTime: '2026-01-21T18:00:00+05:30',
      artists: [{ name: 'Artist B', role: 'veena' }],
      tags: ['carnatic', 'concert'],
      entryType: 'free',
    },
  ],
  confidence: 0.88,
};

const multiEventExtraction = {
  isFestival: false,
  festival: null,
  events: [
    {
      title: 'Morning Veena Recital',
      startDateTime: '2026-02-15T10:00:00+05:30',
      artists: [{ name: 'Artist A', role: 'veena' }],
      tags: ['carnatic', 'concert'],
      entryType: 'free',
    },
    {
      title: 'Evening Vocal Concert',
      startDateTime: '2026-02-15T18:00:00+05:30',
      artists: [{ name: 'Artist B', role: 'vocal' }],
      tags: ['carnatic', 'concert'],
      entryType: 'free',
    },
  ],
  confidence: 0.85,
};

describe('extractFromPoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should classify then extract for single-event poster', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

    const result = await extractFromPoster('https://example.com/poster.jpg');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.isFestival).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe('Vocal Concert by Vid. X');
  });

  it('should classify then extract for festival poster', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(festivalClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(festivalExtraction) });

    const result = await extractFromPoster('https://example.com/festival.jpg');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.isFestival).toBe(true);
    expect(result.festival?.name).toBe('Thyagaraja Aradhana');
    expect(result.events).toHaveLength(2);
  });

  it('should classify then extract for multi-event poster', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(multiEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(multiEventExtraction) });

    const result = await extractFromPoster('https://example.com/multi.jpg');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.isFestival).toBe(false);
    expect(result.festival).toBeNull();
    expect(result.events).toHaveLength(2);
  });

  it('should use the correct prompt for each poster type', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    // First call = classification prompt
    const classifyPrompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0].text;
    expect(classifyPrompt).toContain('classify it into one of three categories');

    // Second call = single-event prompt
    const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
    expect(extractPrompt).toContain('SINGLE EVENT SPECIFIC INSTRUCTIONS');
  });

  it('should use festival prompt when classified as festival', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(festivalClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(festivalExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
    expect(extractPrompt).toContain('FESTIVAL SPECIFIC INSTRUCTIONS');
  });

  it('should use multi-event prompt when classified as multi-event', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(multiEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(multiEventExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
    expect(extractPrompt).toContain('MULTI-EVENT SPECIFIC INSTRUCTIONS');
  });

  it('tells the model what today is, so it cannot invent the year', async () => {
    // A poster that prints "AUG 14 | 5:45 PM" and no year gave the model nothing to work from,
    // and it dated a 2026 concert to 2024 — which then could not be corrected, because the
    // edit form could not save a date either. The date has to be in the prompt.
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
    const today = todayInTimeZone(DEFAULT_EVENT_TIMEZONE);
    expect(extractPrompt).toContain(`TODAY'S DATE IS ${today}`);
    expect(extractPrompt).toContain('next occurrence');
  });

  it('reads the date per call, not once when the module loaded', async () => {
    // These prompts are built inside a Lambda container that can stay warm for days. A date
    // captured at module load would quietly date every later poster to the day it booted.
    // The suite pins the clock in `test/setup.ts`; move it and put it back.
    try {
      vi.setSystemTime(new Date('2027-03-05T12:00:00.000Z'));
      mockImageFetch();
      mockGenerateContent
        .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
        .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

      await extractFromPoster('https://example.com/poster.jpg');

      const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
      expect(extractPrompt).toContain("TODAY'S DATE IS 2027-03-05");
    } finally {
      vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    }
  });

  it('does not tell the model to invent a time for a performance that has none', async () => {
    // The old festival prompt said to "use reasonable defaults (e.g. evening concerts at
    // 18:00)", and it duly staggered three dancers billed at one 5:45 PM start into 5:45,
    // 7:00 and 8:00 — a running order that was on no poster.
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(festivalClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(festivalExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    const extractPrompt = mockGenerateContent.mock.calls[1][0].contents[0].parts[0].text;
    expect(extractPrompt).not.toContain('reasonable defaults');
    expect(extractPrompt).toContain('Do NOT invent a time');
  });

  it('should fetch the image only once for both calls', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    // fetch called once for the image (not twice)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/poster.jpg');
  });

  it('should pass the same image data to both Gemini calls', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventExtraction) });

    await extractFromPoster('https://example.com/poster.jpg');

    const call1Image = mockGenerateContent.mock.calls[0][0].contents[0].parts[1].inlineData;
    const call2Image = mockGenerateContent.mock.calls[1][0].contents[0].parts[1].inlineData;
    expect(call1Image.data).toBe(call2Image.data);
    expect(call1Image.mimeType).toBe(call2Image.mimeType);
  });

  it('should throw when GEMINI_API_KEY is not set', async () => {
    process.env.GEMINI_API_KEY = '';

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow(
      'GEMINI_API_KEY environment variable is not set'
    );
  });

  it('should throw when image fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(extractFromPoster('https://example.com/missing.jpg')).rejects.toThrow(
      'Failed to fetch image: 404 Not Found'
    );
  });

  it('should throw when classification returns empty response', async () => {
    mockImageFetch();
    mockGenerateContent.mockResolvedValueOnce({ text: '' });

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow(
      'Empty response from Gemini API'
    );
  });

  it('should throw when classification returns invalid JSON', async () => {
    mockImageFetch();
    mockGenerateContent.mockResolvedValueOnce({ text: 'not json' });

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow();
  });

  it('should throw when classification returns invalid posterType', async () => {
    mockImageFetch();
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ posterType: 'unknown', summary: 'test', confidence: 0.5 }),
    });

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow();
  });

  it('should throw when extraction returns empty response', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockResolvedValueOnce({ text: '' });

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow(
      'Empty response from Gemini API'
    );
  });

  it('should throw when Gemini API call fails', async () => {
    mockImageFetch();
    mockGenerateContent.mockRejectedValueOnce(new Error('API rate limit'));

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow(
      'API rate limit'
    );
  });

  it('should throw when extraction API call fails after successful classification', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(singleEventClassification) })
      .mockRejectedValueOnce(new Error('API error'));

    await expect(extractFromPoster('https://example.com/poster.jpg')).rejects.toThrow('API error');
  });

  it('should apply Zod defaults for missing fields', async () => {
    mockImageFetch();
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ posterType: 'single-event', summary: 'A concert' }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          events: [
            {
              title: 'Concert',
              startDateTime: '2026-02-15T18:00:00+05:30',
              tags: ['carnatic'],
              entryType: 'free',
            },
          ],
        }),
      });

    const result = await extractFromPoster('https://example.com/poster.jpg');

    // Defaults applied by Zod
    expect(result.isFestival).toBe(false);
    expect(result.confidence).toBe(0.5);
    expect(result.events[0].artists).toEqual([]);
  });
});

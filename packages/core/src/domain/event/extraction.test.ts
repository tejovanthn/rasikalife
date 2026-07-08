import { describe, expect, it } from 'vitest';
import { ClassificationResultSchema, ExtractionResultSchema, PosterTypeEnum } from './extraction';

describe('ExtractionResultSchema', () => {
  it('applies defaults when only required-ish fields are given', () => {
    const parsed = ExtractionResultSchema.parse({});

    expect(parsed).toEqual({ isFestival: false, events: [], confidence: 0.5 });
  });

  it('parses a single-event extraction with a coerced start date', () => {
    const parsed = ExtractionResultSchema.parse({
      events: [
        {
          title: 'Margazhi Concert',
          artists: [{ name: 'Sanjay Subrahmanyan' }],
          startDateTime: '2026-01-01T18:00:00.000Z',
        },
      ],
    });

    expect(parsed.events[0].title).toBe('Margazhi Concert');
    expect(parsed.events[0].startDateTime).toBe('2026-01-01T18:00:00.000Z');
  });

  it('coerces a Date-like startDateTime into a string, unlike the strict CreateEventSchema', () => {
    const parsed = ExtractionResultSchema.parse({
      events: [
        {
          title: 'Concert',
          artists: [],
          startDateTime: new Date('2026-01-01T18:00:00.000Z'),
        },
      ],
    });

    expect(typeof parsed.events[0].startDateTime).toBe('string');
  });

  it('allows a nested festival with relaxed organiser contact fields', () => {
    const parsed = ExtractionResultSchema.parse({
      isFestival: true,
      festival: {
        name: 'Margazhi Season',
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        organiser: { name: 'Madras Music Academy' },
      },
    });

    expect(parsed.festival?.name).toBe('Margazhi Season');
    expect(parsed.festival?.organiser?.contactPhone).toBeUndefined();
  });

  it('allows event artists with only a name (title/role nullish)', () => {
    const parsed = ExtractionResultSchema.parse({
      events: [{ title: 'Concert', artists: [{ name: 'Some Artist' }] }],
    });

    expect(parsed.events[0].artists).toEqual([{ name: 'Some Artist' }]);
  });

  it('defaults an event artists array to empty when omitted', () => {
    const parsed = ExtractionResultSchema.parse({ events: [{ title: 'Concert' }] });

    expect(parsed.events[0].artists).toEqual([]);
  });

  it('rejects an event artist missing the required name field', () => {
    expect(() =>
      ExtractionResultSchema.parse({
        events: [{ title: 'Concert', artists: [{ role: 'vocalist' }] }],
      })
    ).toThrow();
  });
});

describe('PosterTypeEnum / ClassificationResultSchema', () => {
  it('accepts each known poster type', () => {
    for (const type of ['single-event', 'festival', 'multi-event'] as const) {
      expect(PosterTypeEnum.parse(type)).toBe(type);
    }
  });

  it('rejects an unknown poster type', () => {
    expect(() => PosterTypeEnum.parse('unknown-type')).toThrow();
  });

  it('defaults confidence to 0.5 when omitted', () => {
    const parsed = ClassificationResultSchema.parse({
      posterType: 'single-event',
      summary: 'A concert poster',
    });

    expect(parsed.confidence).toBe(0.5);
  });

  it('requires posterType and summary', () => {
    expect(() => ClassificationResultSchema.parse({ summary: 'Missing poster type' })).toThrow();
  });
});

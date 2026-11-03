import { describe, expect, it } from 'vitest';
import { ragaPageModel } from './raga-page';

const ssp = (field: string, locator: string, tradition?: string) =>
  ({ field, sourceSlug: 'ssp-1963-tamil', locator, tradition }) as never;

const bhairavi = {
  arohanam: 'S R2 G2 M1 P D2 N2 S',
  avarohanam: 'S N2 D1 P M1 G2 R2 S',
};

describe('ragaPageModel', () => {
  it('asks for help once, at the first empty section', () => {
    expect(ragaPageModel(bhairavi).helpSection).toBe('movement');
    expect(
      ragaPageModel({
        ...bhairavi,
        jivaSwaras: ['R', 'G'],
        citations: [ssp('jivaSwaras', 'p. 375')],
      }).helpSection
    ).toBe('learn');
  });

  it('asks for nothing when every section holds data', () => {
    const model = ragaPageModel({
      ...bhairavi,
      movement: 'x',
      keyCompositionIds: ['c'],
      timeOfDay: 'evening',
    });
    expect(model.helpSection).toBeUndefined();
  });

  it("reads bare jiva letters as the raga's own variants, and leaves an ambiguous one bare", () => {
    const model = ragaPageModel({ ...bhairavi, jivaSwaras: ['R', 'G', 'M', 'N', 'D'] });
    expect(model.swaras.jiva).toEqual(['R2', 'G2', 'M1', 'N2', 'D']);
  });

  it('numbers references in page order and keeps the tradition for the time', () => {
    const model = ragaPageModel({
      ...bhairavi,
      timeOfDay: 'evening',
      jivaSwaras: ['R'],
      citations: [ssp('jivaSwaras', 'p. 375'), ssp('timeOfDay', 'p. 375', 'Dikshitar school')],
    });
    // The time is one school's reading of the page, so it prints as its own reference.
    expect(model.references).toHaveLength(2);
    expect(model.footnotes).toEqual({ jivaSwaras: [1], timeOfDay: [2] });
    expect(model.traditionOf.timeOfDay).toBe('Dikshitar school');
  });

  it('keeps both readings of a field from two traditions, each with its own tradition and note', () => {
    const model = ragaPageModel({
      ...bhairavi,
      timeOfDay: 'evening',
      citations: [
        { ...ssp('timeOfDay', 'p. 375', 'Dikshitar school'), note: 'sung at dusk' },
        { ...ssp('timeOfDay', 'p. 375', 'Tyagaraja school'), note: 'sung at dawn' },
      ] as never,
    });
    expect(model.references).toHaveLength(2);
    expect(model.references.map(r => [r.tradition, r.note])).toEqual([
      ['Dikshitar school', 'sung at dusk'],
      ['Tyagaraja school', 'sung at dawn'],
    ]);
    expect(model.footnotes.timeOfDay).toEqual([1, 2]);
    // Two readings: neither is named inline as if it were the only one.
    expect(model.traditionOf.timeOfDay).toBeUndefined();
  });

  describe('alternateScales citations', () => {
    const alt = ['S R2 G2 M1 P D2 S', 'S R2 M1 P D2 S'];
    const entry = (note: string | undefined, tradition?: string) =>
      ({ ...ssp('alternateScales', 'p. 9', tradition), note }) as never;

    it('marks only the entry whose note equals it', () => {
      const model = ragaPageModel({
        ...bhairavi,
        alternateScales: alt,
        citations: [entry(alt[1], 'Dikshitar school')],
      });
      expect(model.alternateScales).toEqual([
        { scale: alt[0], numbers: [], tradition: undefined },
        { scale: alt[1], numbers: [1], tradition: 'Dikshitar school' },
      ]);
      expect(model.footnotes.alternateScales).toBeUndefined();
      expect(model.references).toHaveLength(1);
      // The entry string is a marker, not a remark about the source.
      expect(model.references[0].note).toBeUndefined();
    });

    it('shares one reference between entries cited from the same place', () => {
      const model = ragaPageModel({
        ...bhairavi,
        alternateScales: alt,
        citations: [entry(alt[0]), entry(alt[1])],
      });
      expect(model.references).toHaveLength(1);
      expect(model.alternateScales.map(r => r.numbers)).toEqual([[1], [1]]);
    });

    it('keeps the field-level footnote for a citation with no matching note', () => {
      const model = ragaPageModel({
        ...bhairavi,
        alternateScales: alt,
        citations: [entry(undefined), entry('something else')],
      });
      expect(model.alternateScales.every(r => r.numbers.length === 0)).toBe(true);
      expect(model.footnotes.alternateScales).toEqual([1]);
    });
  });

  it('numbers the sloka in the references', () => {
    const model = ragaPageModel({
      ...bhairavi,
      slokas: [{ text: 'verse' }],
      citations: [ssp('slokas', 'p. 375')],
    });
    expect(model.footnotes.slokas).toEqual([1]);
  });
});

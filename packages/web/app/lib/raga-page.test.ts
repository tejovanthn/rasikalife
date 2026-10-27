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
      citations: [ssp('timeOfDay', 'p. 375', 'Dikshitar school'), ssp('jivaSwaras', 'p. 375')],
    });
    expect(model.references).toHaveLength(1);
    expect(model.footnotes).toEqual({ jivaSwaras: [1], timeOfDay: [1] });
    expect(model.traditionOf.timeOfDay).toBe('Dikshitar school');
  });
});

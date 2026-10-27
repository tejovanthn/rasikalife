import { describe, expect, it } from 'vitest';
import { CreateRagaSchema } from './schema';
import { type Citation, numberReferences, pruneCitations, shownRaga } from './sourced';

const ssp = (field: Citation['field'], locator = 'pp. 375–376'): Citation => ({
  field,
  sourceSlug: 'ssp-1963-tamil',
  locator,
});

describe('shownRaga', () => {
  it('hides an uncited time of day, as Bhairavi\'s "universal" was', () => {
    const shown = shownRaga({ id: 'r', name: 'bhairavi', timeOfDay: 'universal', rasa: 'karuna' });
    expect(shown).not.toHaveProperty('timeOfDay');
    expect(shown).not.toHaveProperty('rasa');
  });

  it('shows a cited time of day', () => {
    const shown = shownRaga({
      id: 'r',
      timeOfDay: 'evening',
      citations: [ssp('timeOfDay', 'p. 375')],
    });
    expect(shown.timeOfDay).toBe('evening');
  });

  it('keeps the legacy scale and description while uncited', () => {
    const shown = shownRaga({ id: 'r', arohanam: 'S R2 G2 M1 P D2 N2 S', description: 'x' });
    expect(shown.arohanam).toBe('S R2 G2 M1 P D2 N2 S');
    expect(shown.description).toBe('x');
  });

  it('hides uncited phrases', () => {
    expect(shownRaga({ id: 'r', prayogas: [{ notation: 'R2 G2 M1 P D1 P' }] })).not.toHaveProperty(
      'prayogas'
    );
  });
});

describe('numberReferences', () => {
  it('numbers each source and page once, in page order', () => {
    const raga = {
      citations: [
        ssp('prayogas', 'p. 376'),
        ssp('jivaSwaras', 'p. 375'),
        ssp('timeOfDay', 'p. 375'),
        { field: 'prayogas' as const, sourceSlug: 'ishwar-2013', locator: 'Table 2' },
      ],
    };
    const { references, footnotes } = numberReferences(raga, [
      'jivaSwaras',
      'prayogas',
      'timeOfDay',
    ]);
    expect(references.map(r => `${r.number} ${r.sourceSlug} ${r.locator}`)).toEqual([
      '1 ssp-1963-tamil p. 375',
      '2 ssp-1963-tamil p. 376',
      '3 ishwar-2013 Table 2',
    ]);
    expect(footnotes).toEqual({ jivaSwaras: [1], prayogas: [2, 3], timeOfDay: [1] });
  });
});

describe('pruneCitations', () => {
  it('drops the citation of a field that is now blank', () => {
    const kept = pruneCitations({
      rasa: '',
      timeOfDay: 'evening',
      citations: [ssp('rasa'), ssp('timeOfDay')],
    });
    expect(kept.map(c => c.field)).toEqual(['timeOfDay']);
  });

  it('keeps a citation for false, which is a value', () => {
    expect(pruneCitations({ isBhashanga: false, citations: [ssp('isBhashanga')] })).toHaveLength(1);
  });
});

describe('CreateRagaSchema', () => {
  it('accepts a cited Bhairavi with phrases and swara sets', () => {
    const parsed = CreateRagaSchema.safeParse({
      name: 'bhairavi',
      isBhashanga: true,
      scaleType: 'sampurna',
      jivaSwaras: ['R', 'G', 'M', 'N'],
      anyaSwaras: ['D2'],
      prayogas: [{ notation: 'P D2 N2 D2 N2 S' }],
      keyCompositionIds: ['comp1'],
      citations: [ssp('jivaSwaras', 'p. 375'), ssp('prayogas', 'p. 376')],
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses a citation to a slug that is not one', () => {
    const parsed = CreateRagaSchema.safeParse({
      name: 'x',
      citations: [{ field: 'rasa', sourceSlug: 'Raga Nidhi', locator: 'p. 1' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuses a phrase that is prose', () => {
    const parsed = CreateRagaSchema.safeParse({
      name: 'x',
      prayogas: [{ notation: 'zig-zags between ga and ri' }],
    });
    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  assessRagaDuplicate,
  compareSurvivors,
  mergeFillPatch,
  ragaExactKey,
  ragaVariantKey,
  swaraKey,
} from './dedup';

describe('ragaExactKey', () => {
  it('ignores case', () => {
    expect(ragaExactKey('Todi')).toBe(ragaExactKey('todi'));
  });

  it('ignores diacritics, so the two Kalyani records collide', () => {
    expect(ragaExactKey('kalyāṇi')).toBe(ragaExactKey('kalyani'));
  });

  it('drops the alias bracket', () => {
    expect(ragaExactKey('kalyani (meca kalyani, shantakalyani)')).toBe('kalyani');
    expect(ragaExactKey('navaroj (navroj)')).toBe('navaroj');
  });

  it('ignores hyphens and spaces', () => {
    expect(ragaExactKey('hamir-kalyani')).toBe(ragaExactKey('hamir kalyani'));
  });

  it('keeps genuinely different ragas apart', () => {
    expect(ragaExactKey('ranjani')).not.toBe(ragaExactKey('rasikaranjani'));
    expect(ragaExactKey('abheri')).not.toBe(ragaExactKey('aabheri'));
  });

  it('handles empty string', () => {
    expect(ragaExactKey('')).toBe('');
  });
});

describe('ragaVariantKey', () => {
  it('collapses doubled vowels marking length', () => {
    expect(ragaVariantKey('aabheri')).toBe(ragaVariantKey('abheri'));
    expect(ragaVariantKey('bahudaari')).toBe(ragaVariantKey('bahudari'));
    expect(ragaVariantKey('behaag')).toBe(ragaVariantKey('behag'));
  });

  it('collapses c/k and sh/s spellings', () => {
    expect(ragaVariantKey('carukeshi')).toBe(ragaVariantKey('karukesi'));
    expect(ragaVariantKey('bhaageshri')).toBe(ragaVariantKey('bhageshri'));
  });

  it('collapses the -am and -a endings of one name', () => {
    expect(ragaVariantKey('margahindolam')).toBe(ragaVariantKey('margahindola'));
    expect(ragaVariantKey('hindolam')).toBe(ragaVariantKey('hindola'));
  });

  it('matches the hyphenation variants seen in the corpus', () => {
    expect(ragaVariantKey('hamirkalyani')).toBe(ragaVariantKey('hamir-kalyani'));
    expect(ragaVariantKey('amrita-behaag')).toBe(ragaVariantKey('amrita-behag'));
    expect(ragaVariantKey('ananda-bhairavi')).toBe(ragaVariantKey('anandabhairavi'));
  });

  it('still separates ragas that merely share a stem', () => {
    expect(ragaVariantKey('ranjani')).not.toBe(ragaVariantKey('rasikaranjani'));
    expect(ragaVariantKey('bhairavi')).not.toBe(ragaVariantKey('anandabhairavi'));
  });

  it('matches long vowels written doubled, and dropped aspirates', () => {
    expect(ragaVariantKey('gaanamoorti')).toBe(ragaVariantKey('ganamurti'));
    expect(ragaVariantKey('eesamanohari')).toBe(ragaVariantKey('ishamanohari'));
    expect(ragaVariantKey('hamsadhvani')).toBe(ragaVariantKey('hamsadwani'));
    expect(ragaVariantKey('gambheeravani')).toBe(ragaVariantKey('gambhiravani'));
  });

  it('handles empty string', () => {
    expect(ragaVariantKey('')).toBe('');
  });
});

describe('swaraKey', () => {
  it('ignores case and spacing', () => {
    expect(swaraKey('S R2 G3 P D2 S')).toBe(swaraKey('s r2  g3 p d2 s'));
    expect(swaraKey(null)).toBe('');
  });
});

describe('assessRagaDuplicate', () => {
  const mohanam = { arohanam: 'S R2 G3 P D2 S', avarohanam: 'S D2 P G3 R2 S', melaNumber: 28 };

  it('is high when both scales agree', () => {
    const r = assessRagaDuplicate(
      'variant',
      { name: 'mohanam', ...mohanam, parentRaga: { name: 'harikambhoji' } },
      { name: 'mohana', ...mohanam, parentRaga: { name: 'harikaambhoji' } }
    );
    expect(r.confidence).toBe('high');
  });

  it('is high on an exact-tier match with nothing contradicting', () => {
    expect(assessRagaDuplicate('exact', { name: 'Todi' }, { name: 'todi' }).confidence).toBe(
      'high'
    );
  });

  it('is medium when a variant match has no scale on one side', () => {
    const r = assessRagaDuplicate('variant', { name: 'mohanam', ...mohanam }, { name: 'mohana' });
    expect(r.confidence).toBe('medium');
  });

  it('is low when the scales differ', () => {
    const r = assessRagaDuplicate(
      'variant',
      { name: 'a', arohanam: 'S R1 G3 M1 P D1 N3 S' },
      { name: 'b', arohanam: 'S R2 G3 M1 P D2 N3 S' }
    );
    expect(r.confidence).toBe('low');
    expect(r.reason).toContain('arohanam differs');
  });

  it('is low when the mela or parent differs, or one is the melakarta itself', () => {
    expect(
      assessRagaDuplicate('variant', { name: 'a', melaNumber: 15 }, { name: 'b', melaNumber: 16 })
        .confidence
    ).toBe('low');
    expect(
      assessRagaDuplicate(
        'variant',
        { name: 'a', parentRaga: { name: 'kalyani' } },
        { name: 'b', parentRaga: { name: 'todi' } }
      ).confidence
    ).toBe('low');
    expect(
      assessRagaDuplicate(
        'variant',
        { name: 'a', melaNumber: 22 },
        { name: 'b', melaNumber: 22, parentRaga: { name: 'kharaharapriya' } }
      ).reason
    ).toContain('one melakarta, one janya');
  });
});

describe('compareSurvivors', () => {
  const base = {
    impressions: 0,
    compositions: 0,
    performances: 0,
    filledFields: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('keeps the page with more impressions, even with fewer compositions', () => {
    const a = { ...base, id: 'a', impressions: 1060, compositions: 2 };
    const b = { ...base, id: 'b', impressions: 382, compositions: 9 };
    expect([b, a].sort(compareSurvivors)[0].id).toBe('a');
  });

  it('falls back to compositions and performances, then fields, then age', () => {
    const a = { ...base, id: 'a', compositions: 1, performances: 3 };
    const b = { ...base, id: 'b', compositions: 2 };
    expect([b, a].sort(compareSurvivors)[0].id).toBe('a');
    const c = { ...base, id: 'c', filledFields: 5 };
    const d = { ...base, id: 'd', filledFields: 2 };
    expect([d, c].sort(compareSurvivors)[0].id).toBe('c');
    const e = { ...base, id: 'e', createdAt: '2025-01-01T00:00:00Z' };
    const f = { ...base, id: 'f' };
    expect([f, e].sort(compareSurvivors)[0]).toBe(e);
  });
});

describe('mergeFillPatch', () => {
  it('copies only what the survivor lacks', () => {
    const patch = mergeFillPatch(
      { arohanam: 'S R2 G2 M1 P D1 N3 S', description: '' },
      {
        arohanam: 'different',
        avarohanam: 'S N3 D1 P M1 G2 R2 S',
        description: 'Melakarta 21.',
        melaNumber: 21,
      }
    );
    expect(patch).toEqual({
      avarohanam: 'S N3 D1 P M1 G2 R2 S',
      description: 'Melakarta 21.',
      melaNumber: 21,
    });
  });

  it('treats empty lists and blank strings as missing, and copies nothing blank', () => {
    expect(mergeFillPatch({ alternateScales: [] }, { alternateScales: ['S R1 S'] })).toEqual({
      alternateScales: ['S R1 S'],
    });
    expect(mergeFillPatch({}, { rasa: '  ', alternateScales: [] })).toEqual({});
  });

  it('brings the citations of the fields it copies, and only those', () => {
    const own = { field: 'arohanam', sourceSlug: 'karnatik-ragas', locator: 'u' };
    const patch = mergeFillPatch(
      { arohanam: 'S R2 G2 M1 P D2 N2 S', citations: [own] },
      {
        timeOfDay: 'evening',
        arohanam: 'other',
        citations: [
          { field: 'timeOfDay', sourceSlug: 'ssp-1963-tamil', locator: 'p. 375' },
          { field: 'arohanam', sourceSlug: 'raga-pravaham', locator: 'p. 122' },
        ],
      }
    );
    expect(patch).toEqual({
      timeOfDay: 'evening',
      citations: [own, { field: 'timeOfDay', sourceSlug: 'ssp-1963-tamil', locator: 'p. 375' }],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { ragaMetaDescription } from './raga-description';

describe('ragaMetaDescription', () => {
  it('includes arohanam and avarohanam when stored', () => {
    const result = ragaMetaDescription({
      name: 'Mukhari',
      arohanam: 'S G2 M1 P N2 S',
      avarohanam: 'S N2 D1 P M1 G2 R2 S',
    });
    expect(result).toContain('Arohanam: S G2 M1 P N2 S.');
    expect(result).toContain('Avarohanam: S N2 D1 P M1 G2 R2 S.');
  });

  it('reports the parent mela on a janya raga, not its own', () => {
    // A janya stores its parent's mela number. Asserting it bare would read
    // as this raga being one of the 72 melakartas, which it is not.
    const result = ragaMetaDescription({
      name: 'Mukhari',
      melaNumber: 22,
      parentRaga: { name: 'Kharaharapriya' },
    });
    expect(result).toContain('Janya raga derived from Kharaharapriya (melakarta 22).');
    expect(result).not.toContain('Melakarta 22.');
  });

  it('reports its own mela number on a melakarta raga', () => {
    const result = ragaMetaDescription({ name: 'Kharaharapriya', melaNumber: 22 });
    expect(result).toContain('Melakarta 22.');
  });

  it('names logged performances and top compositions', () => {
    const result = ragaMetaDescription({
      name: 'Mukhari',
      performanceCount: 47,
      topCompositions: [
        { title: 'Karuna Nidhi Ilalo' },
        { title: 'Enna Thavam Seidhanai' },
        { title: 'A third composition' },
      ],
    });
    expect(result).toContain(
      'Performed 47 times in concert, including Karuna Nidhi Ilalo and Enna Thavam Seidhanai.'
    );
    // Caps at two so the description doesn't run on.
    expect(result).not.toContain('A third composition');
  });

  it('uses singular "time" for a single performance', () => {
    const result = ragaMetaDescription({
      name: 'Rare Raga',
      performanceCount: 1,
      topCompositions: [{ title: 'Only One' }],
    });
    expect(result).toContain('Performed 1 time in concert, including Only One.');
  });

  it('omits the performance sentence when there are no logged performances', () => {
    const result = ragaMetaDescription({ name: 'Rare Raga', performanceCount: 0 });
    expect(result).not.toContain('Performed');
  });

  it('omits the performance sentence when compositions are missing despite a count', () => {
    // Defensive: a count without titles would produce "including ." — a
    // mismatch between the two fields should never reach the page.
    const result = ragaMetaDescription({ name: 'Rare Raga', performanceCount: 5 });
    expect(result).not.toContain('Performed');
  });
});

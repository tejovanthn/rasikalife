import { describe, expect, it } from 'vitest';
import { ragaMetaDescription, ragaMetaTitle } from './raga-description';

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

  it('names listed compositions when no performance is logged', () => {
    const result = ragaMetaDescription({
      name: 'Bindumalini',
      compositions: [{ title: 'Entamuddo Enta' }, { title: 'Second' }, { title: 'Third' }],
    });
    expect(result).toContain('Compositions include Entamuddo Enta and Second.');
    expect(result).not.toContain('Third');
  });

  it('prefers logged performances over the listed compositions', () => {
    const result = ragaMetaDescription({
      name: 'Mukhari',
      performanceCount: 3,
      topCompositions: [{ title: 'Karuna Nidhi Ilalo' }],
      compositions: [{ title: 'Something Else' }],
    });
    expect(result).toContain('Performed 3 times');
    expect(result).not.toContain('Compositions include');
  });

  it('drops whole trailing sentences to stay within 155 characters', () => {
    const result = ragaMetaDescription({
      name: 'Kharaharapriya',
      arohanam: 'S R2 G2 M1 P D2 N2 S',
      avarohanam: 'S N2 D2 P M1 G2 R2 S',
      melaNumber: 22,
      performanceCount: 40,
      topCompositions: [{ title: 'Chakkani Raja Margamu' }, { title: 'Rama Nee Samanamevaru' }],
    });
    expect(result.length).toBeLessThanOrEqual(155);
    expect(result).toContain('Melakarta 22.');
    expect(result.endsWith('.')).toBe(true);
  });
});

describe('ragaMetaTitle', () => {
  it('leads with "<name> Raga" and names only what is stored', () => {
    expect(ragaMetaTitle({ name: 'Abhogi' })).toBe('Abhogi Raga | Rasika.life');
  });

  it('claims the scale only when it is stored', () => {
    const title = ragaMetaTitle({ name: 'Abhogi', arohanam: 'S R2 G2 M1 D2 S' });
    expect(title).toBe('Abhogi Raga: Arohanam, Avarohanam | Rasika.life');
  });

  it('adds compositions when the page lists any, dropping the brand to fit', () => {
    const title = ragaMetaTitle({
      name: 'Abhogi',
      arohanam: 'S R2 G2 M1 D2 S',
      avarohanam: 'S D2 M1 G2 R2 S',
      hasCompositions: true,
    });
    expect(title).toBe('Abhogi Raga: Arohanam, Avarohanam, Compositions');
  });

  it('gives a melakarta its own number', () => {
    const title = ragaMetaTitle({
      name: 'Kalyani',
      arohanam: 'S R2 G3 M2 P D2 N3 S',
      melaNumber: 65,
    });
    expect(title).toBe('Kalyani Raga (Melakarta 65): Arohanam, Avarohanam');
  });

  it("never puts a janya raga's parent number in its title", () => {
    const title = ragaMetaTitle({
      name: 'Mukhari',
      melaNumber: 22,
      parentRaga: { name: 'Kharaharapriya' },
    });
    expect(title).not.toContain('Melakarta');
  });

  it('stays within 60 characters by dropping detail, longest name included', () => {
    const names = ['Kharaharapriya', 'Sankrandanapriya (Shankarantapriya)', 'Bindumalini'];
    for (const name of names) {
      const title = ragaMetaTitle({
        name,
        arohanam: 'S R1 G3 M1 P N2 S',
        melaNumber: 22,
        hasCompositions: true,
      });
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title.startsWith(`${name} Raga`)).toBe(true);
    }
  });
});

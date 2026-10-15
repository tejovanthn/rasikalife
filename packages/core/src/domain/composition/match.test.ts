import { describe, expect, it } from 'vitest';
import {
  canonicalTala,
  composerAgrees,
  looseKey,
  matchComposition,
  ragaAgrees,
  resolveName,
} from './match';

describe('looseKey and ragaAgrees', () => {
  it.each([
    ['Kedaragowla', 'kEdAragauLa'],
    ['Kedaram', 'kEdAra'],
    ['Mohanam', 'mOhana'],
    ['Hindolam', 'hindOLa'],
    ['Thodi', 'tODi'],
    ['Durbar', 'darbAr'],
    ['Madhyamavathi', 'madhyamAvati'],
    ['Shankarabharanam', 'dhIra shankarAbharaNam'],
  ])('%s is %s', (theirs, ours) => {
    expect(ragaAgrees(theirs, ours)).toBe(true);
  });

  it.each([
    ['Ranjani', 'mEgharanjani'],
    ['Bhairavi', 'sindhu bhairavi'],
    ['Kalyani', 'mOhana kalyANi'],
  ])('keeps %s apart from %s', (theirs, ours) => {
    // A qualifier that names a different raga must not be read as a variant spelling.
    expect(looseKey(theirs) === looseKey(ours)).toBe(false);
  });
});

describe('composerAgrees', () => {
  it.each([
    ['Dikshitar', 'Muttuswaamee Dikshitar'],
    ['Tyagaraja', 'Tyaagaraaja'],
    ['Shyama Shastry', 'Shyaamaa Shaastree'],
    ['OothukaDu Venkata Subbaiyer', 'OotukkaaDu VenkaTasubbaiyyar'],
  ])('%s is %s', (theirs, ours) => {
    expect(composerAgrees(theirs, ours)).toBe(true);
  });

  it('tells two composers apart', () => {
    expect(composerAgrees('Tyagaraja', 'Muttuswaamee Dikshitar')).toBe(false);
    expect(composerAgrees('Arunachala Kavi', 'Kabir')).toBe(false);
  });
});

describe('canonicalTala', () => {
  it.each([
    ['Adi (2 kalai)', 'Adi'],
    ['Khanda Chapu', 'cApu'],
    ['Misra Chapu', 'cApu'],
    ['Rupakam', 'rUpaka'],
    ['Ata', 'aTa'],
    ['Desadi', 'dEshaadi'],
    ['chaapu', 'cApu'],
    ['khaNDa caapu', 'cApu'],
    ['aadi', 'Adi'],
    ['Adhi', 'Adi'],
    ['Jampa', 'jhampa'],
    ['Jambha', 'jhampa'],
    ['Roopakam', 'rUpaka'],
    ['Thriputa', 'tripuTa'],
  ])('%s → %s', (theirs, ours) => {
    expect(canonicalTala(theirs)).toBe(ours);
  });
});

describe('resolveName', () => {
  it('takes the most used of our names that agree', () => {
    const ours = [
      { name: 'kalyANi', uses: 300 },
      { name: 'kalyaaNi', uses: 4 },
      { name: 'tODi', uses: 200 },
    ];
    expect(resolveName('Kalyani', ours, ragaAgrees)).toBe('kalyANi');
    expect(resolveName('Bilahari', ours, ragaAgrees)).toBeUndefined();
  });

  it('prefers a name with the same key over a commoner one it is a suffix of', () => {
    const ours = [
      { name: 'punnAgavarALi', uses: 90 },
      { name: 'varALi', uses: 40 },
    ];
    expect(resolveName('Varali', ours, ragaAgrees)).toBe('varALi');
  });
});

describe('matchComposition', () => {
  const abhayambika = {
    id: 'c1',
    title: 'abhayAmbikAyAha anyam na jAnE',
    composer: 'Muttuswaamee Dikshitar',
    ragas: ['kEdAragauLa'],
  };

  it('attaches when title, raga and composer agree', () => {
    const result = matchComposition(
      { title: 'Abhayambikaya', raga: 'Kedaragowla', composer: 'Dikshitar' },
      [abhayambika]
    );
    expect(result).toMatchObject({ suggestion: 'attach', confidence: 'high', match: abhayambika });
  });

  it('creates when no title agrees', () => {
    expect(
      matchComposition({ title: 'Dheem Dheem', raga: 'Revathi' }, [abhayambika])
    ).toMatchObject({ suggestion: 'create' });
  });

  it('sends a raga that differs to review', () => {
    const result = matchComposition(
      { title: 'Abhayambikaya', raga: 'Bhairavi', composer: 'Dikshitar' },
      [abhayambika]
    );
    expect(result).toMatchObject({ suggestion: 'review', confidence: 'low' });
  });

  it('sends a composer that differs to review', () => {
    const result = matchComposition(
      { title: 'Abhayambikaya', raga: 'Kedaragowla', composer: 'Tyagaraja' },
      [abhayambika]
    );
    expect(result).toMatchObject({ suggestion: 'review', confidence: 'medium' });
  });

  it('accepts a raga by another name when the caller says so', () => {
    const result = matchComposition(
      { title: 'Siva Siva Siva', raga: 'Panthuvarali', composer: 'Tyagaraja' },
      [
        {
          id: 'c2',
          title: 'shiva shiva shiva enarAdA',
          composer: 'Tyaagaraaja',
          ragas: ['kAmavardhani'],
        },
      ],
      { ragaAgrees: (theirs, ours) => theirs === 'Panthuvarali' && ours === 'kAmavardhani' }
    );
    expect(result.suggestion).toBe('attach');
  });

  it('picks the fullest of our own copies of one song', () => {
    const thin = { ...abhayambika, id: 'thin', weight: 10 };
    const full = { ...abhayambika, id: 'full', weight: 900 };
    const result = matchComposition(
      { title: 'Abhayambikaya', raga: 'Kedaragowla', composer: 'Dikshitar' },
      [thin, full]
    );
    expect(result).toMatchObject({ suggestion: 'attach', confidence: 'medium' });
    expect(result.match?.id).toBe('full');
  });
});

import { describe, expect, it } from 'vitest';
import {
  type ArtistCitation,
  numberArtistReferences,
  pruneArtistCitations,
  shownArtist,
} from './sourced';

const ssp = (field: ArtistCitation['field'], locator = 'p. 14'): ArtistCitation => ({
  field,
  sourceSlug: 'ssp-2008-english',
  locator,
});

describe('shownArtist', () => {
  it('leaves an ordinary artist untouched, cited or not', () => {
    const artist = { id: 'a', birthYear: 1985, birthPlace: 'Chennai', instrument: 'vocal' };
    expect(shownArtist(artist)).toBe(artist);
  });

  it('hides the uncited facts of a historical artist', () => {
    const shown = shownArtist({
      id: 'a',
      isHistorical: true,
      birthYear: 1775,
      deathYear: 1835,
      mudra: 'guruguha',
      citations: [ssp('deathYear')],
    });
    expect(shown.deathYear).toBe(1835);
    expect(shown).not.toHaveProperty('birthYear');
    expect(shown).not.toHaveProperty('mudra');
  });

  it('keeps the uncited legacy facts a historical artist already had', () => {
    // Tyagaraja's record, as stored before SSP: birthplace and specialisations, no citations.
    const shown = shownArtist({
      id: 'a',
      isHistorical: true,
      birthPlace: 'Thiruvarur',
      specialisations: ['Telugu kritis'],
      mudra: 'tyagaraja',
    });
    expect(shown.birthPlace).toBe('Thiruvarur');
    expect(shown.specialisations).toEqual(['Telugu kritis']);
    expect(shown).not.toHaveProperty('mudra');
  });

  it('keeps fields outside the citable set', () => {
    const shown = shownArtist({ id: 'a', name: 'X', isHistorical: true, biography: 'text' });
    expect(shown.name).toBe('X');
    expect(shown.biography).toBe('text');
  });
});

describe('numberArtistReferences', () => {
  it('numbers one reference per source and page, in page order', () => {
    const artist = {
      citations: [ssp('mudra', 'p. 20'), ssp('birthYear', 'p. 14'), ssp('birthPlace', 'p. 14')],
    };
    const { references, footnotes } = numberArtistReferences(artist, [
      'birthYear',
      'birthPlace',
      'mudra',
    ]);
    expect(references.map(r => r.locator)).toEqual(['p. 14', 'p. 20']);
    expect(footnotes.birthYear).toEqual([1]);
    expect(footnotes.birthPlace).toEqual([1]);
    expect(footnotes.mudra).toEqual([2]);
  });
});

describe('pruneArtistCitations', () => {
  it('drops the citation of a cleared field', () => {
    const kept = pruneArtistCitations({
      mudra: 'guruguha',
      citations: [ssp('mudra'), ssp('birthPlace')],
    });
    expect(kept.map(c => c.field)).toEqual(['mudra']);
  });
});

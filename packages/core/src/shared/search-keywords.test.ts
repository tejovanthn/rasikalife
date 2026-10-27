import { describe, expect, it } from 'vitest';
import {
  bestVolume,
  compositionKeywords,
  foldVowels,
  ragaKeywords,
  romanPhrase,
} from './search-keywords';

describe('romanPhrase', () => {
  it('reads ITRANS as a person types it, without the qualifier', () => {
    expect(romanPhrase('viriboNi (varNam)')).toBe('viriboni');
  });
});

describe('foldVowels', () => {
  it('writes long vowels and doubled letters once', () => {
    expect(foldVowels('raaga seetha kolluu')).toBe('raga sitha kolu');
  });
});

describe('compositionKeywords', () => {
  it('includes the joined spelling people search for', () => {
    // "chintaya ma" has no volume; "chintayama" is what is typed.
    expect(compositionKeywords({ title: 'cintaya mA' })).toContain('chintayama');
  });

  it('adds the form for a varnam', () => {
    expect(compositionKeywords({ title: 'viriboNi', compositionType: 'varnam' })).toContain(
      'viriboni varnam'
    );
  });

  it('drops a phrase too long for Keyword Planner', () => {
    const long = Array.from({ length: 12 }, () => 'rAma').join(' ');
    expect(compositionKeywords({ title: long }).every(p => p.split(' ').length <= 10)).toBe(true);
  });
});

describe('ragaKeywords', () => {
  it('asks for raga and ragam', () => {
    expect(ragaKeywords('kalyANi')).toEqual(['kalyani raga', 'kalyani ragam']);
  });
});

describe('bestVolume', () => {
  it('takes the highest, never the sum', () => {
    const volumes = new Map([
      ['chintaya ma', 0],
      ['chintayama', 90],
      ['chintayama kriti', 20],
    ]);
    expect(bestVolume(['chintaya ma', 'Chintayama', 'chintayama kriti'], volumes)).toBe(90);
  });
});

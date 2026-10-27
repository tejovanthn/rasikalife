import { describe, expect, it } from 'vitest';
import {
  bestVolume,
  compositionKeywords,
  foldVowels,
  parsePlannerVolumes,
  plannerNumber,
  ragaKeywords,
  romanPhrase,
  typedSpelling,
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

  it('spells ś as people type it', () => {
    expect(ragaKeywords('shankarAbharaNam')).toContain('shankarabharanam raga');
  });

  it('asks for a bracketed alias as a name of its own', () => {
    expect(ragaKeywords('Ahiri bhairavi (Ahir bhairav)')).toContain('ahir bhairav raga');
  });
});

describe('typedSpelling', () => {
  it('writes sh, ch and ri where the roman view merged them', () => {
    expect(typedSpelling('ShaNmukhapriyA')).toBe('shanmukhapriya');
    expect(typedSpelling('R^itigauLa')).toBe('ritigaula');
    expect(typedSpelling('cintaya mA')).toBe('chintaya ma');
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

describe('plannerNumber', () => {
  it('reads plain, abbreviated and ranged volumes', () => {
    expect(plannerNumber('1,300')).toBe(1300);
    expect(plannerNumber('12100')).toBe(12100);
    expect(plannerNumber('1K – 10K')).toBe(1000);
    expect(plannerNumber('10K-100K')).toBe(10000);
    expect(plannerNumber('')).toBeUndefined();
  });
});

describe('parsePlannerVolumes', () => {
  it("reads Keyword Planner's own download, title lines and all", () => {
    const text = [
      '\uFEFFKeyword Stats 2026-10-27 at 12_00_00',
      'October 1, 2025 - September 30, 2026',
      'Keyword\tCurrency\tAvg. monthly searches\tThree month change',
      'bhairavi raga\tINR\t10K – 100K\t0%',
      'kalyani raga\tINR\t1K – 10K\t0%',
      'chintaya ma\tINR\t0\t',
    ].join('\n');
    expect([...parsePlannerVolumes(text)]).toEqual([
      ['bhairavi raga', 10000],
      ['kalyani raga', 1000],
      ['chintaya ma', 0],
    ]);
  });

  it('reads the plain CSV too', () => {
    const volumes = parsePlannerVolumes('keyword,avg_monthly_searches\nviriboni varnam,210\n');
    expect(volumes.get('viriboni varnam')).toBe(210);
  });
});

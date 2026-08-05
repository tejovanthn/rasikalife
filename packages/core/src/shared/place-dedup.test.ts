import { describe, expect, it } from 'vitest';

import {
  collapseSpelling,
  editDistance,
  isNearMatch,
  placeExactKey,
  placeVariantKey,
  placeWords,
  wordsSubsetOf,
} from './place-dedup';

/**
 * Every case here is a real pair from the production table, because the point of these
 * keys is not that they are principled but that they gather the rows that are actually
 * split. The negative cases matter more than the positive ones: a key that merges
 * `Sri Vani Vidya Kendra` into `Sri Vanikala Kendra` costs a real venue its page.
 */

describe('placeExactKey', () => {
  it('ignores spacing and full stops in an initialism', () => {
    expect(placeExactKey('A. D. A. Ranga Mandira')).toBe(placeExactKey('ADA Rangamandira'));
  });

  it('ignores whether the registration bracket is spaced', () => {
    expect(placeExactKey('Kanchana Shree Lakshminarayana Music Academy Trust (R)')).toBe(
      placeExactKey('Kanchana Shree Lakshminarayana Music Academy Trust(R)')
    );
  });

  it('ignores a registration mark and case', () => {
    expect(placeExactKey('SWARA SOURABHA ® & ACADEMY OF MUSIC ®')).toBe(
      placeExactKey('Swara Sourabha & Academy Of Music')
    );
  });

  it('treats an ampersand and the word as the same', () => {
    expect(placeExactKey('Shree Sharada Samskruthika Sabha & SBI Officers Colony')).toBe(
      placeExactKey('Shree Sharada Samskruthika Sabha and SBI Officers Colony')
    );
  });

  it('ignores an apostrophe, a trailing stop and a trailing space', () => {
    expect(placeExactKey("SBI Officer's Colony Hall")).toBe(
      placeExactKey('SBI Officers Colony Hall')
    );
    expect(placeExactKey('Meenakshi Rangamancha Auditorium.')).toBe(
      placeExactKey('Meenakshi Rangamancha Auditorium')
    );
    expect(placeExactKey('Indiranagar Sangeetha Sabha ')).toBe(
      placeExactKey('Indiranagar Sangeetha Sabha')
    );
  });

  it('ignores a word break', () => {
    expect(placeExactKey('Naadashree Art Space')).toBe(placeExactKey('Naadashree Artspace'));
  });

  it('keeps genuinely different names apart', () => {
    expect(placeExactKey('Sri Vani Vidya Kendra')).not.toBe(placeExactKey('Sri Vanikala Kendra'));
    expect(placeExactKey('Chowdaiah Memorial Hall')).not.toBe(
      placeExactKey('Chowdiah Memorial Hall')
    );
  });
});

describe('placeWords', () => {
  it('drops a leading honorific but keeps one inside the name', () => {
    expect(placeWords('Sri Rama Lalitha Kala Mandira')).toEqual([
      'rama',
      'lalitha',
      'kala',
      'mandira',
    ]);
    expect(placeWords('Kanchana Shree Lakshminarayana Music Academy Trust')).toContain('shree');
  });

  it('drops the city wherever it sits', () => {
    expect(placeWords('Shri Chitrapur Math, Bengaluru')).toEqual(['chitrapur', 'math']);
    expect(placeWords('Bangalore Gayana Samaja')).toEqual(['gayana', 'samaja']);
  });

  it('drops a registration word left loose by the bracket strip', () => {
    expect(placeWords('Sri Thyagaraja Gana Sabha Trust (R.)')).toEqual([
      'thyagaraja',
      'gana',
      'sabha',
      'trust',
    ]);
  });
});

describe('collapseSpelling', () => {
  it('collapses an aspirate written with and without its h', () => {
    expect(collapseSpelling('samskruthika')).toBe(collapseSpelling('samskrutika'));
    expect(collapseSpelling('pratishthana')).toBe(collapseSpelling('pratishtana'));
    expect(collapseSpelling('kalakshethra')).toBe(collapseSpelling('kalakshetra'));
  });

  it('collapses a doubled vowel marking length', () => {
    expect(collapseSpelling('samaaja')).toBe(collapseSpelling('samaja'));
  });

  it('collapses a trailing a', () => {
    expect(collapseSpelling('mandir')).toBe(collapseSpelling('mandira'));
    expect(collapseSpelling('sevasadan')).toBe(collapseSpelling('sevasadana'));
  });
});

describe('placeVariantKey', () => {
  it('gathers all six spellings of the one hall', () => {
    const names = [
      'The Bangalore Gayana Samaja (R)',
      'Gayana Samaja',
      'Gayana Samaaja',
      'Bangalore Gayana Samaja',
      'The Bangalore Gayana Samaja Hall',
      'Bengaluru Gayana Samaaja',
    ];
    const keys = new Set(names.map(placeVariantKey));
    expect(keys.size).toBe(1);
  });

  it('gathers the four spellings of Seva Sadan', () => {
    const keys = new Set(
      ['Seva Sadan', 'Seva Sadan Auditorium', 'Seva Sadana', 'Sevasadan'].map(placeVariantKey)
    );
    expect(keys.size).toBe(1);
  });

  it('matches across a dropped generic word', () => {
    expect(placeVariantKey('Sri Rama Lalitha Kala Mandir Hall')).toBe(
      placeVariantKey('Sri Rama Lalitha Kala Mandira')
    );
  });

  it('matches across a dropped honorific', () => {
    expect(placeVariantKey('Karanji Anjaneya Swamy Temple')).toBe(
      placeVariantKey('Sri Karanji Anjaneyaswamy Temple')
    );
    expect(placeVariantKey('Sri Veeranjaneya Swamy Temple')).toBe(
      placeVariantKey('Veeranjaneya Swamy Temple')
    );
  });

  it('matches across a dropped city', () => {
    expect(placeVariantKey('Shri Chitrapur Math')).toBe(
      placeVariantKey('Shri Chitrapur Math, Bengaluru')
    );
  });

  it('matches the two Ravindra Kalakshetra spellings', () => {
    expect(placeVariantKey('Ravindra Kala Kshethra')).toBe(placeVariantKey('Ravindra Kalakshetra'));
  });

  it('matches the two Pratishthana spellings', () => {
    expect(placeVariantKey('Ninnaolumeinda Pratishtana')).toBe(
      placeVariantKey('Ninnaolumeinda Pratishthana')
    );
  });

  it('keeps a name that is only generic words from collapsing to nothing', () => {
    expect(placeVariantKey('Main Auditorium')).not.toBe('');
    expect(placeVariantKey('Main Auditorium')).not.toBe(placeVariantKey('Shukra Auditorium'));
  });

  it('keeps genuinely different places apart', () => {
    expect(placeVariantKey('Sri Vani Vidya Kendra')).not.toBe(
      placeVariantKey('Sri Vanikala Kendra')
    );
    expect(placeVariantKey('MES Kalavedi')).not.toBe(placeVariantKey('MES Kishora Kendra'));
    expect(placeVariantKey('Nadabindu')).not.toBe(placeVariantKey('Nada Sambhrama'));
    expect(placeVariantKey('Sri Krishna Sangeetha Sabha')).not.toBe(
      placeVariantKey('Indiranagar Sangeetha Sabha')
    );
  });
});

describe('editDistance', () => {
  it('counts a single substitution', () => {
    expect(editDistance('chowdaiah', 'chowdiiah', 2)).toBe(1);
  });

  it('gives up rather than counting past the cap', () => {
    expect(editDistance('completely', 'different', 2)).toBeGreaterThan(2);
  });
});

describe('isNearMatch', () => {
  it('catches the hall spelled by ear', () => {
    expect(
      isNearMatch(placeExactKey('Chowdaiah Memorial Hall'), placeExactKey('Chowdiah Memorial Hall'))
    ).toBe(true);
  });

  it('refuses short names, where two letters is most of the word', () => {
    expect(isNearMatch('annapurn', 'annapura')).toBe(true);
    expect(isNearMatch('arohy', 'aroha')).toBe(false);
  });

  it('refuses names that disagree at the first letter', () => {
    expect(isNearMatch('seshadripuram', 'heshadripuram')).toBe(false);
  });
});

describe('wordsSubsetOf', () => {
  it('finds a hall named inside its building', () => {
    expect(wordsSubsetOf(placeWords('Arohy'), placeWords('Arohy, Shaale Building'))).toBe(true);
    expect(
      wordsSubsetOf(
        placeWords('Indian Institute of World Culture'),
        placeWords('Wadia Auditorium, Indian Institute of World Culture')
      )
    ).toBe(true);
    expect(
      wordsSubsetOf(placeWords('Viveka Auditorium'), placeWords('Viveka Auditorium, Yuvapatha'))
    ).toBe(true);
  });

  it('refuses when the outer name adds a whole other institution', () => {
    expect(
      wordsSubsetOf(
        placeWords('Kuteera Hall, Sri Yadugiri Yathiraja Mutt'),
        placeWords(
          'Adishesha Vilasa Sabha Bhavana (Above Kuteera Hall), Sri Yadugiri Yathiraja Mutt'
        )
      )
    ).toBe(false);
  });

  it('refuses a subset too short to mean anything', () => {
    expect(wordsSubsetOf(['zoom'], ['zoom', 'meeting', 'room'])).toBe(false);
  });
});

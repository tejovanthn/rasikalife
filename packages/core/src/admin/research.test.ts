import { describe, expect, it } from 'vitest';

import {
  checkProse,
  deriveMelaNumbers,
  foreignNotes,
  melakartaScale,
  mergeResearch,
  selectRecords,
  validateResearchField,
  validateSocialLinks,
  validateSwaras,
  withoutRedundantSpecialisations,
} from './research';

/**
 * These tests are the reason the research itself can run on a cheap model. Every rule an
 * agent is told in prose is asserted here, so the pipeline's safety does not depend on the
 * agent having obeyed. The negative cases matter more than the positive ones.
 */

describe('validateSwaras', () => {
  it('accepts the notation the corpus stores, normalising case and spacing', () => {
    expect(validateSwaras('  s r1 g2   m1 p d1 n3 s ')).toEqual({
      ok: true,
      value: 'S R1 G2 M1 P D1 N3 S',
    });
  });

  it('accepts bare letters, which is how Hindustani sources write them', () => {
    expect(validateSwaras('S R G M P D N S').ok).toBe(true);
  });

  it('accepts an octave mark riding along', () => {
    expect(validateSwaras("S R2 G3 M1 P D2 N3 S'").ok).toBe(true);
  });

  it('refuses prose that describes a scale instead of stating it', () => {
    const result = validateSwaras('ascends through the fifth, omitting the third');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not swara notation');
  });

  it('refuses a transliterated scale, the bug that cost the raga pages their clicks', () => {
    // `fromItrans` over notation renders S as ṣ and D as ḍ; that must never come back as data.
    expect(validateSwaras('ṣ ṟ2 ġ2 ṃ1 P ḍ1 ṇ2 ṣ').ok).toBe(false);
  });

  it('refuses swaras spelled as words', () => {
    expect(validateSwaras('sa ri ga ma pa dha ni sa').ok).toBe(false);
  });

  it('refuses a line with no tonic', () => {
    expect(validateSwaras('R2 G3 M1 P').reason).toBe('no S in the line');
  });

  it('refuses something too short to be a scale', () => {
    expect(validateSwaras('S R2').ok).toBe(false);
  });
});

describe('checkProse', () => {
  it('catches praise', () => {
    expect(checkProse('A renowned raga of the evening')).toBe('renowned');
  });

  it('catches a bare superlative as well as a hedged one', () => {
    expect(checkProse('the most popular janya of Kharaharapriya')).toBeTruthy();
    expect(checkProse('one of the greatest ragas')).toBeTruthy();
  });

  it('catches the agent reasoning out loud', () => {
    expect(checkProse('This is likely a janya of Mayamalavagowla')).toBe('likely');
    expect(checkProse('Sources are unclear on its origin')).toBe('unclear');
  });

  it('catches the praise the first melakarta run got past the pattern', () => {
    // Both shipped from a run that refused nothing at all, on real raga pages.
    expect(checkProse('It is a mellifluous raga offering wide scope for composition.')).toBe(
      'mellifluous'
    );
    expect(checkProse('It is popular with musicians, who sing it early in a concert.')).toBe(
      'popular'
    );
  });

  it('lets a name translation through, since it is a fact about the word', () => {
    // `beautiful` is deliberately not puffery: this sentence is true and worth keeping.
    expect(checkProse('Rupavati is a raga whose name means the beautiful one.')).toBeUndefined();
  });

  it('passes plain factual prose', () => {
    expect(
      checkProse('A janya of Kharaharapriya, sung in the evening and associated with karuna rasa.')
    ).toBeUndefined();
    expect(
      checkProse('Charukesi is widely used in Tamil, Hindi and Telugu film music.')
    ).toBeUndefined();
  });
});

describe('validateResearchField — raga', () => {
  it('never accepts melaNumber, however plausible', () => {
    const result = validateResearchField('raga', 'melaNumber', 29);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('derived');
  });

  it('holds the timeOfDay enum', () => {
    expect(validateResearchField('raga', 'timeOfDay', 'Evening')).toEqual({
      ok: true,
      value: 'evening',
    });
    expect(validateResearchField('raga', 'timeOfDay', 'dawn').ok).toBe(false);
  });

  it('holds the tradition enum', () => {
    expect(validateResearchField('raga', 'tradition', 'Carnatic').value).toBe('carnatic');
    expect(validateResearchField('raga', 'tradition', 'folk').ok).toBe(false);
  });

  it('treats "not stated" as blank rather than as text', () => {
    expect(validateResearchField('raga', 'rasa', 'not stated').ok).toBe(false);
  });

  it('refuses a description that spells swaras as words', () => {
    const result = validateResearchField(
      'raga',
      'description',
      'The scale runs sa ri ga ma pa and back down.'
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('spells swaras');
  });

  it('refuses a description carrying inflation', () => {
    expect(
      validateResearchField('raga', 'description', 'One of the greatest ragas in the tradition.').ok
    ).toBe(false);
  });

  it('validates every alternate scale, not just the first', () => {
    expect(
      validateResearchField('raga', 'alternateScales', ['S R2 G3 P D2 S', 'nonsense']).ok
    ).toBe(false);
    expect(
      validateResearchField('raga', 'alternateScales', ['S R2 G3 P D2 S', 'S N3 D2 P G3 S']).value
    ).toBe('S R2 G3 P D2 S|S N3 D2 P G3 S');
  });
});

describe('validateSocialLinks', () => {
  it('keeps a link whose host matches its platform', () => {
    const { value, rejected } = validateSocialLinks([
      { platform: 'instagram', url: 'https://www.instagram.com/x' },
    ]);
    expect(value).toBe('instagram:https://www.instagram.com/x');
    expect(rejected).toEqual([]);
  });

  it('refuses a platform pointing at the wrong host', () => {
    const { value, rejected } = validateSocialLinks([
      { platform: 'instagram', url: 'https://example.com/x' },
    ]);
    expect(value).toBeUndefined();
    expect(rejected[0]).toContain('points at');
  });

  it('accepts x.com as twitter', () => {
    expect(validateSocialLinks([{ platform: 'twitter', url: 'https://x.com/x' }]).value).toContain(
      'twitter:'
    );
  });
});

describe('mergeResearch: artist names', () => {
  it('refuses a result that renames the record, since it is about someone else', () => {
    const rows = [{ id: 'a1', name: 'Amrutha Venkatesh', city: '', instrument: 'vocal' }];
    const report = mergeResearch('artist', rows, [
      { id: 'a1', name: 'Amritha Murali', fields: { city: 'Chennai' } },
    ]);

    expect(rows[0].city).toBe('');
    expect(report.rejections[0].reason).toContain('Amritha Murali');
  });

  it('accepts the same name spelled with a different romanisation', () => {
    const rows = [{ id: 'a1', name: 'Tyaagaraaja', city: '', instrument: '' }];
    mergeResearch('artist', rows, [
      { id: 'a1', name: 'tyagaraja', fields: { city: 'Thiruvaiyaru' } },
    ]);

    expect(rows[0].city).toBe('Thiruvaiyaru');
  });
});

describe('mergeResearch', () => {
  const rowsFor = () => [
    { id: 'r1', name: 'kalyANi', description: '', arohanam: '', melaNumber: '65', parentRaga: '' },
    {
      id: 'r2',
      name: 'hamsadhwani',
      description: 'existing text',
      arohanam: '',
      melaNumber: '',
      parentRaga: '',
    },
  ];

  it('fills empty cells and never overwrites a stored one', () => {
    const rows = rowsFor();
    const report = mergeResearch('raga', rows, [
      { id: 'r1', fields: { arohanam: 'S R2 G3 M2 P D2 N3 S' } },
      { id: 'r2', fields: { description: 'a replacement' } },
    ]);

    expect(rows[0].arohanam).toBe('S R2 G3 M2 P D2 N3 S');
    expect(rows[1].description).toBe('existing text');
    expect(report.filled).toBe(1);
    expect(report.keptExisting).toBe(1);
  });

  it('records why each refused value was refused', () => {
    const rows = rowsFor();
    const report = mergeResearch('raga', rows, [
      { id: 'r1', fields: { arohanam: 'ascends past the fifth', melaNumber: 29 } },
    ]);

    expect(rows[0].arohanam).toBe('');
    expect(report.rejections.map(r => r.field).sort()).toEqual(['arohanam', 'melaNumber']);
    expect(report.rejections.find(r => r.field === 'melaNumber')?.reason).toContain('derived');
  });

  it('ignores a record whose id is not in the sheet', () => {
    const rows = rowsFor();
    const report = mergeResearch('raga', rows, [{ id: 'ghost', fields: { rasa: 'karuna' } }]);
    expect(report.filled).toBe(0);
  });
});

describe('deriveMelaNumbers', () => {
  it("takes a janya's mela from its parent rather than from the agent", () => {
    const rows = [
      { id: 'r1', name: 'kharaharapriyA', melaNumber: '22', parentRaga: '' },
      { id: 'r2', name: 'shrIranjani', melaNumber: '', parentRaga: 'kharaharapriyA' },
    ];
    expect(deriveMelaNumbers(rows)).toBe(1);
    expect(rows[1].melaNumber).toBe('22');
  });

  it('matches a parent across spelling and the alias bracket', () => {
    const rows = [
      { id: 'r1', name: 'kalyANi (meca kalyani, shantakalyani)', melaNumber: '65', parentRaga: '' },
      { id: 'r2', name: 'yamunAkalyANi', melaNumber: '', parentRaga: 'Kalyani' },
    ];
    deriveMelaNumbers(rows);
    expect(rows[1].melaNumber).toBe('65');
  });

  it('leaves the field empty when the parent is not in the corpus', () => {
    const rows = [{ id: 'r2', name: 'x', melaNumber: '', parentRaga: 'nowhere' }];
    expect(deriveMelaNumbers(rows)).toBe(0);
    expect(rows[0].melaNumber).toBe('');
  });

  it('never overwrites a mela number already stored', () => {
    const rows = [
      { id: 'r1', name: 'kharaharapriyA', melaNumber: '22', parentRaga: '' },
      { id: 'r2', name: 'shrIranjani', melaNumber: '20', parentRaga: 'kharaharapriyA' },
    ];
    deriveMelaNumbers(rows);
    expect(rows[1].melaNumber).toBe('20');
  });
});

describe('selectRecords', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('returns everything when no list is given', () => {
    expect(selectRecords(rows).records.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('selects and reorders to the list, not the scan order', () => {
    const { records } = selectRecords(rows, { wanted: ['c', 'a'] });
    expect(records.map(r => r.id)).toEqual(['c', 'a']);
  });

  it('counts ids that name nothing rather than throwing', () => {
    // The list is generated from an older export, so a merged-away raga is ordinary.
    const { records, unmatched } = selectRecords(rows, { wanted: ['a', 'gone', 'b'] });
    expect(records.map(r => r.id)).toEqual(['a', 'b']);
    expect(unmatched).toBe(1);
  });

  it('researches a repeated id once', () => {
    expect(selectRecords(rows, { wanted: ['a', 'b', 'a'] }).records.map(r => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('drops what an earlier pass covered, with or without a list', () => {
    expect(selectRecords(rows, { wanted: ['a', 'b'], excluded: ['b'] }).records).toEqual([
      { id: 'a' },
    ]);
    expect(selectRecords(rows, { excluded: ['a', 'd'] }).records.map(r => r.id)).toEqual([
      'b',
      'c',
    ]);
  });

  it('does not count an excluded id as unmatched', () => {
    const { records, unmatched } = selectRecords(rows, { wanted: ['a', 'b'], excluded: ['b'] });
    expect(records.map(r => r.id)).toEqual(['a']);
    expect(unmatched).toBe(0);
  });
});

describe('melakartaScale', () => {
  it('computes the four corners of the scheme', () => {
    expect(melakartaScale(1).arohanam).toBe('S R1 G1 M1 P D1 N1 S');
    expect(melakartaScale(36).arohanam).toBe('S R3 G3 M1 P D3 N3 S');
    expect(melakartaScale(37).arohanam).toBe('S R1 G1 M2 P D1 N1 S');
    expect(melakartaScale(72).arohanam).toBe('S R3 G3 M2 P D3 N3 S');
  });

  it('agrees with the scales the corpus already stored', () => {
    // These three were the only melakartas carrying a scale before the run, and matching
    // them is what verifies the mela-number-to-record map in MELAKARTA_LINKS.
    expect(melakartaScale(15).arohanam).toBe('S R1 G3 M1 P D1 N3 S');
    expect(melakartaScale(29).arohanam).toBe('S R2 G3 M1 P D2 N3 S');
    expect(melakartaScale(65).arohanam).toBe('S R2 G3 M2 P D2 N3 S');
  });

  it('descends by reversing the ascent', () => {
    expect(melakartaScale(22).avarohanam).toBe('S N2 D2 P M1 G2 R2 S');
  });

  it('refuses a number outside the 72', () => {
    expect(() => melakartaScale(0)).toThrow();
    expect(() => melakartaScale(73)).toThrow();
  });
});

describe('foreignNotes', () => {
  it('is silent when the janya stays inside its parent', () => {
    // Mohanam, the audava janya of Harikambhoji (28).
    expect(foreignNotes('S R2 G3 P D2 S', 28)).toEqual([]);
  });

  it('names the anya swara that defines a raga rather than refusing it', () => {
    // Yamunakalyani is Kalyani with M1; the borrowed note is the point of the raga.
    expect(foreignNotes('S N3 D2 P M2 G3 M1 R2 S', 65)).toEqual(['M1']);
    // Bhairavi takes D2 against Natabhairavi's D1.
    expect(foreignNotes('S R2 G2 M1 P D2 N2 S', 20)).toEqual(['D2']);
  });

  it('catches a scale paired with the wrong parent', () => {
    // Kalyani's own scale read against Kharaharapriya: two notes cannot be there.
    expect(foreignNotes('S R2 G3 M2 P D2 N3 S', 22).sort()).toEqual(['G3', 'M2', 'N3']);
  });

  it('catches the junk that reached the field before this pipeline existed', () => {
    expect(foreignNotes('varies', 22)).toEqual(['VARIES']);
    expect(foreignNotes('S R₂ M₁ P N₂ S', 28)).not.toEqual([]);
  });

  it('ignores an octave mark, which is not a different note', () => {
    expect(foreignNotes("S R2 G3 P D2 S'", 28)).toEqual([]);
  });
});

describe('mergeResearch — a parent name must already exist', () => {
  /**
   * The importer resolves a linked name by *exact* match and creates a record when it misses.
   * A worker reports "Shankarabharanam" and the corpus stores "shankarAbharaNa", so a run that
   * passed the reported spelling through wrote seven blank ragas and pointed sixteen janyas at
   * them. These are the tests for not doing that again.
   */
  const corpus = () => [
    { id: 'm29', name: 'shankarAbharaNa', melaNumber: '29', parentRaga: '', description: '' },
    { id: 'm15', name: 'mAyAmALavagauLa', melaNumber: '15', parentRaga: '', description: '' },
    { id: 'j1', name: 'bilahari', melaNumber: '', parentRaga: '', description: '' },
    { id: 'j2', name: 'gauLa', melaNumber: '', parentRaga: '', description: '' },
  ];

  it('matches across the alias bracket and diacritics', () => {
    const rows = corpus();
    const report = mergeResearch('raga', rows, [
      { id: 'j2', fields: { parentRaga: 'Māyāmāḷavagauḷa (raga)' } },
    ]);
    expect(rows[3].parentRaga).toBe('mAyAmALavagauLa');
    expect(report.rejections).toEqual([]);
  });

  it('bridges a transliteration variant when exactly one record answers to it', () => {
    // The case that caused the incident: worker writes Sankarabharanam, corpus stores
    // shankarAbharaNa. The exact key cannot reach it; the variant key can.
    const rows = corpus();
    mergeResearch('raga', rows, [{ id: 'j1', fields: { parentRaga: 'Sankarabharanam' } }]);
    expect(rows[2].parentRaga).toBe('shankarAbharaNa');
  });

  it('refuses a variant two records answer to, rather than picking one', () => {
    const rows = [
      { id: 'x', name: 'sankarabharana', melaNumber: '', parentRaga: 'k', description: '' },
      ...corpus(),
    ];
    const report = mergeResearch('raga', rows, [
      { id: 'j1', fields: { parentRaga: 'Shankarabharanam' } },
    ]);
    expect(rows.find(r => r.id === 'j1')?.parentRaga).toBe('');
    expect(report.rejections[0].field).toBe('parentRaga');
  });

  it('refuses a parent no record answers to, rather than inventing one', () => {
    const rows = corpus();
    const report = mergeResearch('raga', rows, [
      { id: 'j1', fields: { parentRaga: 'Nowhereambari' } },
    ]);
    expect(rows[2].parentRaga).toBe('');
    expect(report.filled).toBe(0);
    expect(report.rejections[0].reason).toContain('would create one');
  });

  it('refuses the names no string rule reaches, which is most of them', () => {
    // Real pairs from the incident. Mela 17 is stored under its asampurna name, so the
    // reported name shares no letters with it; `Vachaspati` and `vAcaspati` diverge on c/ch.
    const rows = [
      { id: 'm17', name: 'chAyAvati', melaNumber: '17', parentRaga: '', description: '' },
      { id: 'm64', name: 'vAcaspati', melaNumber: '64', parentRaga: '', description: '' },
      { id: 'a', name: 'saurASTra', melaNumber: '', parentRaga: '', description: '' },
      { id: 'b', name: 'sarasvati', melaNumber: '', parentRaga: '', description: '' },
    ];
    const report = mergeResearch('raga', rows, [
      { id: 'a', fields: { parentRaga: 'Suryakantam' } },
      { id: 'b', fields: { parentRaga: 'Vachaspati' } },
    ]);
    expect(rows[2].parentRaga).toBe('');
    expect(rows[3].parentRaga).toBe('');
    expect(report.rejections).toHaveLength(2);
  });

  it('prefers the melakarta when two records share an exact key', () => {
    const rows = [
      { id: 'dup', name: 'Shankarabharana', melaNumber: '', parentRaga: 'x', description: '' },
      ...corpus(),
      { id: 'j3', name: 'someJanya', melaNumber: '', parentRaga: '', description: '' },
    ];
    mergeResearch('raga', rows, [{ id: 'j3', fields: { parentRaga: 'shankarabharana' } }]);
    expect(rows.find(r => r.id === 'j3')?.parentRaga).toBe('shankarAbharaNa');
  });

  it('still leaves a stored parent alone', () => {
    const rows = corpus();
    rows[2].parentRaga = 'kept';
    const report = mergeResearch('raga', rows, [
      { id: 'j1', fields: { parentRaga: 'Sankarabharanam' } },
    ]);
    expect(rows[2].parentRaga).toBe('kept');
    expect(report.keptExisting).toBe(1);
  });
});

describe('validateResearchField — artist', () => {
  const check = (field: string, value: unknown) => validateResearchField('artist', field, value);

  it('refuses the three fields artists deliberately do not research', () => {
    // Each has its own reason in RESEARCH_FIELDS' comment; what matters here is that none of
    // them can reach a row even if a worker volunteers it.
    for (const field of ['biography', 'photoUrl', 'birthYear', 'gurus']) {
      expect(check(field, 'anything'), field).toMatchObject({ ok: false });
    }
  });

  describe('website', () => {
    it('takes an ordinary site', () => {
      expect(check('website', 'https://sudharagunathan.com').value).toBe(
        'https://sudharagunathan.com'
      );
    });

    it('refuses anything that is not an http(s) URL', () => {
      expect(check('website', 'sudharagunathan.com').ok).toBe(false);
      expect(check('website', 'her official site').ok).toBe(false);
    });

    it('sends a social profile to socialLinks instead', () => {
      // Both columns feed sameAs, so the same account arriving twice would publish one
      // profile as two separate claims about the person.
      const result = check('website', 'https://www.instagram.com/someartist');
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('socialLinks');
      expect(check('website', 'https://youtube.com/@someone').ok).toBe(false);
    });
  });

  describe('socialLinks', () => {
    it('keeps links whose host matches the platform', () => {
      expect(
        check('socialLinks', [
          { platform: 'instagram', url: 'https://instagram.com/x' },
          { platform: 'youtube', url: 'https://youtu.be/abc' },
        ]).value
      ).toBe('instagram:https://instagram.com/x|youtube:https://youtu.be/abc');
    });

    it('refuses a platform pointing at another host', () => {
      const result = check('socialLinks', [
        { platform: 'instagram', url: 'https://facebook.com/x' },
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('instagram points at');
    });
  });

  describe('city and birthPlace', () => {
    it('takes a place name', () => {
      expect(check('city', 'Chennai').value).toBe('Chennai');
      expect(check('birthPlace', 'Thanjavur, Tamil Nadu').value).toBe('Thanjavur, Tamil Nadu');
    });

    it('refuses a postal address', () => {
      expect(check('city', '12 Luz Church Road, Mylapore').ok).toBe(false);
      expect(check('city', 'Chennai 600004').ok).toBe(false);
    });

    it('refuses an address stacked past the city', () => {
      expect(check('city', 'Mylapore, Chennai, Tamil Nadu, India').ok).toBe(false);
    });

    it('refuses prose', () => {
      expect(check('birthPlace', 'a renowned centre of Carnatic music').ok).toBe(false);
      expect(check('city', 'apparently Bengaluru').ok).toBe(false);
    });
  });

  describe('specialisations', () => {
    it('takes a list, from an array or a pipe string', () => {
      expect(check('specialisations', ['Carnatic vocal', 'Ragam Tanam Pallavi']).value).toBe(
        'Carnatic vocal|Ragam Tanam Pallavi'
      );
      expect(check('specialisations', 'Carnatic vocal|Padam').value).toBe('Carnatic vocal|Padam');
    });

    it('refuses a list long enough to be a catalogue of every art form', () => {
      expect(check('specialisations', ['a', 'b', 'c', 'd', 'e', 'f', 'g']).ok).toBe(false);
    });

    it('refuses praise inside an entry', () => {
      expect(check('specialisations', ['renowned Carnatic vocalist']).ok).toBe(false);
    });
  });

  describe('activeYears', () => {
    it('takes the spans the column is meant to hold', () => {
      expect(check('activeYears', '1985').value).toBe('1985');
      expect(check('activeYears', '1985-2010').value).toBe('1985-2010');
      expect(check('activeYears', '1985–present').value).toBe('1985-present');
      expect(check('activeYears', 'since 1985').value).toBe('since 1985');
    });

    it('normalises an en dash and stray spacing, since a source will use both', () => {
      expect(check('activeYears', '1985 – 2010').value).toBe('1985-2010');
    });

    it('refuses the phrase a worker reaches for first', () => {
      expect(check('activeYears', 'over four decades').ok).toBe(false);
      expect(check('activeYears', 'since the early 1990s').ok).toBe(false);
      expect(check('activeYears', '1980s-present').ok).toBe(false);
    });

    it('refuses a span that runs backwards or leaves the record bounds', () => {
      expect(check('activeYears', '2010-1985').ok).toBe(false);
      expect(check('activeYears', '1650-1700').ok).toBe(false);
    });
  });
});

describe('mergeResearch — artist', () => {
  const rows = () => [
    { id: 'a1', name: 'Some Artist', city: '', website: '', activeYears: '', socialLinks: '' },
    {
      id: 'a2',
      name: 'Other Artist',
      city: 'Chennai',
      website: '',
      activeYears: '',
      socialLinks: '',
    },
  ];

  it('fills empty cells, keeps stored ones, and reports refusals', () => {
    const sheet = rows();
    const report = mergeResearch('artist', sheet, [
      { id: 'a1', fields: { city: 'Bengaluru', activeYears: 'over four decades' } },
      { id: 'a2', fields: { city: 'Madurai' } },
    ]);

    expect(sheet[0].city).toBe('Bengaluru');
    expect(sheet[1].city).toBe('Chennai');
    expect(report.filled).toBe(1);
    expect(report.keptExisting).toBe(1);
    expect(report.rejections).toHaveLength(1);
    expect(report.rejections[0].field).toBe('activeYears');
  });

  it('derives no mela numbers, and needs no raga corpus to run', () => {
    const sheet = rows();
    const report = mergeResearch('artist', sheet, [{ id: 'a1', fields: { city: 'Pune' } }]);
    expect(report.derivedMela).toBe(0);
  });
});

describe('withoutRedundantSpecialisations', () => {
  it('drops an entry that only restates the stored instrument', () => {
    expect(withoutRedundantSpecialisations('Mridangam', 'mridangam')).toBeUndefined();
    expect(withoutRedundantSpecialisations('Carnatic violin', 'violin')).toBeUndefined();
    expect(withoutRedundantSpecialisations('Carnatic vocal', 'vocal')).toBeUndefined();
  });

  it('keeps the entries that add something, and drops only the echo', () => {
    // The real shape from the first run: an echo beside a genuine addition.
    expect(withoutRedundantSpecialisations('Carnatic vocal|Playback singing', 'vocal')).toBe(
      'Playback singing'
    );
    expect(withoutRedundantSpecialisations('Hindustani vocal|Khayal|Thumri', 'vocal')).toBe(
      'Khayal|Thumri'
    );
  });

  it('drops an entry that is nothing but tradition words', () => {
    expect(withoutRedundantSpecialisations('Carnatic music', 'vocal')).toBeUndefined();
  });

  it('matches against every instrument on a multi-instrument record', () => {
    expect(
      withoutRedundantSpecialisations('Mridangam|Ghatam', 'mridangam, ghatam')
    ).toBeUndefined();
    expect(withoutRedundantSpecialisations('Mridangam|Konnakkol', 'mridangam, ghatam')).toBe(
      'Konnakkol'
    );
  });

  it('keeps everything when the record stores no instrument', () => {
    expect(withoutRedundantSpecialisations('Mridangam', undefined)).toBe('Mridangam');
    expect(withoutRedundantSpecialisations('Mridangam', '')).toBe('Mridangam');
  });
});

describe('mergeResearch — an artist specialisation may not echo the instrument', () => {
  const rows = () => [
    { id: 'a1', name: 'A Mridangist', instrument: 'mridangam', specialisations: '' },
    { id: 'a2', name: 'A Vocalist', instrument: 'vocal', specialisations: '' },
    { id: 'a3', name: 'Unknown Player', instrument: '', specialisations: '' },
  ];

  it('refuses a pure echo, keeps a real addition, and leaves an instrument-less record alone', () => {
    const sheet = rows();
    const report = mergeResearch('artist', sheet, [
      { id: 'a1', fields: { specialisations: ['Mridangam'] } },
      { id: 'a2', fields: { specialisations: ['Carnatic vocal', 'Playback singing'] } },
      { id: 'a3', fields: { specialisations: ['Mridangam'] } },
    ]);

    expect(sheet[0].specialisations).toBe('');
    expect(sheet[1].specialisations).toBe('Playback singing');
    expect(sheet[2].specialisations).toBe('Mridangam');
    expect(report.rejections.map(r => r.reason)).toContain(
      'only restates the instrument already stored'
    );
    expect(report.filled).toBe(2);
  });
});

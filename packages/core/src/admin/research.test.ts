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

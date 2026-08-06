import { describe, expect, it } from 'vitest';

import {
  checkProse,
  deriveMelaNumbers,
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

  it('passes plain factual prose', () => {
    expect(
      checkProse('A janya of Kharaharapriya, sung in the evening and associated with karuna rasa.')
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

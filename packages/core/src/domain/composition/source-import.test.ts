import { describe, expect, it } from 'vitest';
import { planAttach, planAttachUndo, textFingerprint } from './source-import';

const KARNATIK = 'https://karnatik.com/c1.shtml';
const PDF = 'https://www.shivkumar.org/music/adamodi.pdf';
const MP3 = 'https://www.shivkumar.org/music/adamodi.mp3';

describe('textFingerprint', () => {
  it('is stable and tells texts apart', () => {
    expect(textFingerprint('S R G M')).toBe(textFingerprint('S R G M'));
    expect(textFingerprint('S R G M')).not.toBe(textFingerprint('S R G P'));
  });
});

describe('planAttach', () => {
  it('merges links into what the record holds now and records only the new ones', () => {
    const { patch, entry } = planAttach(
      { sources: [KARNATIK] },
      { sources: ['http://karnatik.com/c1.shtml', PDF, MP3], notation: 'S R G M' }
    );
    expect(patch).toEqual({ sources: [KARNATIK, PDF, MP3], notation: 'S R G M' });
    expect(entry).toEqual({
      addedSources: [PDF, MP3],
      notationFingerprint: textFingerprint('S R G M'),
    });
  });

  it('never writes over notation the record already holds', () => {
    const { patch, entry } = planAttach(
      { sources: [KARNATIK], notation: 'typed by a person' },
      { sources: [PDF], notation: 'S R G M' }
    );
    expect(patch).toEqual({ sources: [KARNATIK, PDF] });
    expect(entry.notationFingerprint).toBeUndefined();
  });

  it('writes nothing when everything is already there', () => {
    expect(planAttach({ sources: [KARNATIK, PDF] }, { sources: [PDF] }).patch).toEqual({});
  });
});

describe('planAttachUndo', () => {
  const entry = {
    id: 'c1',
    title: 'Ada Modi',
    addedSources: [PDF, MP3],
    notationFingerprint: textFingerprint('S R G M'),
  };

  it('removes exactly the added links and the notation it wrote', () => {
    expect(
      planAttachUndo(
        { sources: [KARNATIK, PDF, 'https://example.com/later', MP3], notation: 'S R G M' },
        entry
      )
    ).toEqual({
      sources: [KARNATIK, 'https://example.com/later'],
      clearNotation: true,
      keptEditedNotation: false,
    });
  });

  it('keeps notation a person has edited since, and says so', () => {
    expect(planAttachUndo({ sources: [KARNATIK], notation: 'S R G M, corrected' }, entry)).toEqual({
      sources: undefined,
      clearNotation: false,
      keptEditedNotation: true,
    });
  });

  it('is a no-op when run a second time', () => {
    expect(planAttachUndo({ sources: [KARNATIK] }, entry)).toEqual({
      sources: undefined,
      clearNotation: false,
      keptEditedNotation: false,
    });
  });
});

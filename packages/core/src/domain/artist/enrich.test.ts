import { describe, expect, it } from 'vitest';

import { NON_INSTRUMENT_ROLES, instrumentFromRoles, isInstrumentRole } from './enrich';

describe('instrumentFromRoles', () => {
  it('reads a plain credit', () => {
    expect(instrumentFromRoles(['vocal'])).toBe('vocal');
    expect(instrumentFromRoles(['mridangam'])).toBe('mridangam');
  });

  it('normalises the spellings the corpus actually uses', () => {
    expect(instrumentFromRoles(['mrudanga'])).toBe('mridangam');
    expect(instrumentFromRoles(['mrudangam'])).toBe('mridangam');
    expect(instrumentFromRoles(['khajira'])).toBe('khanjira');
    expect(instrumentFromRoles(['kanjira'])).toBe('khanjira');
    expect(instrumentFromRoles(['ghata'])).toBe('ghatam');
    expect(instrumentFromRoles(['morching'])).toBe('morsing');
    expect(instrumentFromRoles(['tabala'])).toBe('tabla');
    expect(instrumentFromRoles(['vocals'])).toBe('vocal');
    expect(instrumentFromRoles(['vocalist'])).toBe('vocal');
  });

  it('is case- and diacritic-insensitive', () => {
    expect(instrumentFromRoles(['Mridangam'])).toBe('mridangam');
    expect(instrumentFromRoles(['  VIOLIN  '])).toBe('violin');
  });

  it('splits a credit naming several parts', () => {
    expect(instrumentFromRoles(['tabla, thamate, percussions'])).toBe('tabla, thamate, percussion');
    expect(instrumentFromRoles(['morching/tabla'])).toBe('morsing, tabla');
    expect(instrumentFromRoles(['pakhawaj, dholak'])).toBe('pakhawaj, dholak');
  });

  it('does not split on spaces, so a qualified credit stays one role', () => {
    expect(instrumentFromRoles(['hindustani harmonium solo'])).toBe('harmonium');
    expect(instrumentFromRoles(['accompanist (mridangam)'])).toBe('mridangam');
    // The point of not splitting on spaces: an unknown phrase must not donate a word.
    expect(instrumentFromRoles(['assistant to the violin player'])).toBeUndefined();
  });

  it('ranks by how often the artist actually played it', () => {
    // One entry per appearance, so the repeats are the ranking.
    expect(instrumentFromRoles(['vocal', 'mridangam', 'mridangam'])).toBe('mridangam, vocal');
    expect(instrumentFromRoles(['mridangam', 'vocal', 'vocal'])).toBe('vocal, mridangam');
  });

  it('keeps first-seen order when counts tie, so a re-run writes nothing new', () => {
    expect(instrumentFromRoles(['ghatam', 'vocal'])).toBe('ghatam, vocal');
    expect(instrumentFromRoles(['vocal', 'ghatam'])).toBe('vocal, ghatam');
  });

  it('counts one credit once even when it repeats a part', () => {
    expect(instrumentFromRoles(['tabla/tabla', 'vocal', 'vocal'])).toBe('vocal, tabla');
  });

  it('caps the list at three', () => {
    const roles = ['vocal', 'mridangam', 'ghatam', 'khanjira', 'flute'];
    expect(instrumentFromRoles(roles)?.split(', ')).toHaveLength(3);
  });

  it('ignores blanks and missing roles', () => {
    expect(instrumentFromRoles([undefined, null, '', '   '])).toBeUndefined();
    expect(instrumentFromRoles([undefined, 'veena', null])).toBe('veena');
  });

  it('returns undefined rather than guessing at an unknown role', () => {
    expect(instrumentFromRoles(['bağlama saz'])).toBeUndefined();
    expect(instrumentFromRoles(['vachana'])).toBeUndefined();
    expect(instrumentFromRoles(['trichur brothers'])).toBeUndefined();
    expect(instrumentFromRoles(['bhushans academy of performing arts'])).toBeUndefined();
  });

  it('refuses a standing at the event, however senior', () => {
    // These are the four commonest non-instrument roles in the corpus.
    expect(instrumentFromRoles(['performer'])).toBeUndefined();
    expect(instrumentFromRoles(['disciple'])).toBeUndefined();
    expect(instrumentFromRoles(['chief-guest'])).toBeUndefined();
    expect(instrumentFromRoles(['guest-of-honour'])).toBeUndefined();
    expect(
      instrumentFromRoles(['chief-guest (president of kalayogi prathistana)'])
    ).toBeUndefined();
    expect(
      instrumentFromRoles(['artistic director, nrityoma academy of performing arts (guru)'])
    ).toBeUndefined();
  });

  it('never lets a refused role dilute a real one', () => {
    expect(instrumentFromRoles(['chief-guest', 'veena'])).toBe('veena');
  });

  it('keeps every role on the refusal list refusing', () => {
    for (const role of NON_INSTRUMENT_ROLES) {
      expect(instrumentFromRoles([role]), role).toBeUndefined();
    }
  });

  it('takes a dance credit, and prefers the named style', () => {
    expect(instrumentFromRoles(['dancer'])).toBe('dance');
    expect(instrumentFromRoles(['bharatanatyam dancer'])).toBe('bharatanatyam');
    expect(instrumentFromRoles(['dancer', 'bharatanatyam', 'bharatanatyam'])).toBe(
      'bharatanatyam, dance'
    );
  });
});

describe('isInstrumentRole', () => {
  it('reports whether a credit would contribute', () => {
    expect(isInstrumentRole('violin')).toBe(true);
    expect(isInstrumentRole('morching/tabla')).toBe(true);
    expect(isInstrumentRole('chief-guest')).toBe(false);
    expect(isInstrumentRole('')).toBe(false);
  });
});

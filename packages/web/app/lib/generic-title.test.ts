import { describe, expect, it } from 'vitest';
import { isGenericTitle } from './generic-title';

describe('isGenericTitle', () => {
  it('flags a bare art-form + concert title', () => {
    expect(isGenericTitle('Carnatic Music Concert')).toBe(true);
  });

  it('flags a "Grand ... Concert" variant', () => {
    expect(isGenericTitle('Grand Carnatic Music Concert')).toBe(true);
  });

  it('flags an art-form concert title with a "by ..." suffix', () => {
    expect(isGenericTitle('Carnatic Music Concert by Sri Ramesh')).toBe(true);
  });

  it('flags "Concert by <honorific> ..." regardless of art form', () => {
    expect(isGenericTitle('Concert by Vid. Someone')).toBe(true);
    expect(isGenericTitle('Concert by Sri Ramesh')).toBe(true);
    expect(isGenericTitle('Concert by Smt. Radha')).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isGenericTitle('  CARNATIC   MUSIC   CONCERT  ')).toBe(true);
  });

  it('does not flag a genuinely descriptive title', () => {
    expect(isGenericTitle('An Evening of Ragas and Rhythms')).toBe(false);
  });

  it('flags "Concert by <first artist name>" when artists are given', () => {
    const artists = [{ name: 'Sanjay Subrahmanyan' }];
    expect(isGenericTitle('Concert by Sanjay Subrahmanyan', artists)).toBe(true);
  });

  it('flags "<artForm> Concert by <first artist name>" when artForm is given', () => {
    const artists = [{ name: 'Sanjay Subrahmanyan' }];
    expect(
      isGenericTitle('Bharatanatyam Concert by Sanjay Subrahmanyan', artists, 'Bharatanatyam')
    ).toBe(true);
  });

  it('does not flag "Concert by <name>" without a matching artist list', () => {
    expect(isGenericTitle('Concert by Sanjay Subrahmanyan')).toBe(false);
    expect(isGenericTitle('Concert by Sanjay Subrahmanyan', [])).toBe(false);
  });

  it('only matches against the first artist in the list', () => {
    const artists = [{ name: 'Bombay Jayashri' }, { name: 'Sanjay Subrahmanyan' }];
    expect(isGenericTitle('Concert by Sanjay Subrahmanyan', artists)).toBe(false);
    expect(isGenericTitle('Concert by Bombay Jayashri', artists)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { canonicalRole } from './roles';

describe('canonicalRole', () => {
  it('maps vocal variants to one key', () => {
    expect(canonicalRole('Vocal')).toBe('vocal');
    expect(canonicalRole('vocals')).toBe('vocal');
    expect(canonicalRole('Vocalist')).toBe('vocal');
  });

  it('maps violin variants to one key', () => {
    expect(canonicalRole('Violin')).toBe('violin');
    expect(canonicalRole('Violinist')).toBe('violin');
  });

  it('maps mridangam spelling variants to one key', () => {
    expect(canonicalRole('Mridangam')).toBe('mridangam');
    expect(canonicalRole('Mrudangam')).toBe('mridangam');
  });

  it('maps ghatam spelling variants to one key', () => {
    expect(canonicalRole('Ghatam')).toBe('ghatam');
    expect(canonicalRole('Ghatom')).toBe('ghatam');
  });

  it('maps kanjira spelling variants to one key', () => {
    expect(canonicalRole('Kanjira')).toBe('kanjira');
    expect(canonicalRole('Khanjira')).toBe('kanjira');
  });

  it('maps flute variants to one key', () => {
    expect(canonicalRole('Flute')).toBe('flute');
    expect(canonicalRole('Flautist')).toBe('flute');
  });

  it('maps veena spelling and role variants to one key', () => {
    expect(canonicalRole('Veena')).toBe('veena');
    expect(canonicalRole('Veenai')).toBe('veena');
    expect(canonicalRole('Vainika')).toBe('veena');
  });

  it('leaves generic "dance" free rather than forcing it to bharatanatyam', () => {
    // Collapsing "dance" to bharatanatyam would mislabel Kuchipudi, Kathak, Odissi and
    // other forms — a wrong assertion on an Indian classical arts platform.
    expect(canonicalRole('Dance')).toBe('dance');
    expect(canonicalRole('Bharatanatyam')).toBe('bharatanatyam');
  });

  it('maps tambura and nagaswaram spelling variants to one key each', () => {
    expect(canonicalRole('Tambura')).toBe('tambura');
    expect(canonicalRole('Tanpura')).toBe('tambura');
    expect(canonicalRole('Nagaswaram')).toBe('nagaswaram');
    expect(canonicalRole('Nadaswaram')).toBe('nagaswaram');
  });

  it('leaves single-spelling roles as their own key', () => {
    expect(canonicalRole('Morsing')).toBe('morsing');
    expect(canonicalRole('Thavil')).toBe('thavil');
  });

  it('lowercases and trims surrounding whitespace before matching', () => {
    expect(canonicalRole('  VOCAL  ')).toBe('vocal');
    expect(canonicalRole('  Mridangam')).toBe('mridangam');
  });

  it('passes unrecognised input through lowercased and trimmed rather than dropping it', () => {
    expect(canonicalRole('Nattuvangam')).toBe('nattuvangam');
    expect(canonicalRole('  Konnakol  ')).toBe('konnakol');
  });

  it('handles empty and whitespace-only input without throwing', () => {
    expect(canonicalRole('')).toBe('');
    expect(canonicalRole('   ')).toBe('');
  });
});

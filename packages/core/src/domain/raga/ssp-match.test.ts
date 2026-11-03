import { describe, expect, it } from 'vitest';
import type { SspRagaRecord } from './ssp';
import { type SspMatchStored, matchSspRagas } from './ssp-match';

const rec = (
  name: string,
  section: string,
  mela: number | null,
  extra: Partial<SspRagaRecord> = {}
) => ({
  record: {
    merged_provisional_id: `raga_${name}_${section}`,
    section_number: section,
    name_canonical: name,
    kind: 'janya',
    mela_number: mela,
    murcchana: { arohana: 'S R2 G2 M1 P D2 N2 S' },
    ...extra,
  } as SspRagaRecord & { section_number: string },
  volume: 1,
});

const stored = (id: string, name: string, melaNumber?: number): SspMatchStored => ({
  id,
  name,
  melaNumber,
});

describe('matchSspRagas', () => {
  it('matches an IAST name to an ITRANS name exactly and suggests apply', () => {
    const [row] = matchSspRagas(
      [rec('kānaḍā', '22.3', 22)],
      [stored('a', 'kAnaDA', 22), stored('b', 'bhairavi', 20)]
    );
    expect(row.tier).toBe('exact');
    expect(row.candidates).toEqual([{ id: 'a', name: 'kAnaDA', melaNumber: 22 }]);
    expect(row.flags).toEqual([]);
    expect(row.suggestion).toBe('apply');
  });

  it('does not match kannaḍa to kAnaDA as exact', () => {
    const [row] = matchSspRagas([rec('kannaḍa', '22.4', 22)], [stored('a', 'kAnaDA', 22)]);
    expect(row.tier).not.toBe('exact');
    expect(row.suggestion).not.toBe('apply');
  });

  it('flags both mukhāri records as duplicate targets', () => {
    const rows = matchSspRagas(
      [rec('mukhāri', '1.1', 1), rec('mukhāri', '20.14', 20)],
      [stored('m', 'mukhAri', 20)]
    );
    for (const row of rows) {
      expect(row.flags).toContain('duplicate-target');
      expect(row.flags).toContain('duplicate-name');
      expect(row.suggestion).toBe('review');
    }
    expect(rows[0].flags).toContain('mela-mismatch');
    expect(rows[1].flags).not.toContain('mela-mismatch');
  });

  it('flags a mela mismatch', () => {
    const [row] = matchSspRagas([rec('bhairavi', '20.1', 20)], [stored('a', 'bhairavi', 22)]);
    expect(row.flags).toContain('mela-mismatch');
    expect(row.suggestion).toBe('review');
  });

  it('marks a variant-only match review', () => {
    const [row] = matchSspRagas([rec('ābhēri', '1.2', 22)], [stored('a', 'aabheri', 22)]);
    expect(row.tier).toBe('variant');
    expect(row.suggestion).toBe('review');
  });

  it('flags more than one exact match', () => {
    const [row] = matchSspRagas(
      [rec('abheri', '1.3', 22)],
      [stored('a', 'abheri', 22), stored('b', 'Abheri', 22)]
    );
    expect(row.flags).toContain('multiple-matches');
    expect(row.suggestion).toBe('review');
  });

  it('skips a name with no match and ignores deleted or merged ragas', () => {
    const rows = matchSspRagas(
      [rec('zzz', '1.4', null), rec('bhairavi', '20.1', 20)],
      [
        { id: 'x', name: 'bhairavi', melaNumber: 20, deletedAt: '2026-01-01' },
        { id: 'y', name: 'bhairavi', melaNumber: 20, mergedIntoId: 'z' },
      ]
    );
    expect(rows.map(r => r.tier)).toEqual(['none', 'none']);
    expect(rows.map(r => r.suggestion)).toEqual(['skip', 'skip']);
  });

  it('does not flag a mela mismatch when SSP gives none', () => {
    const [row] = matchSspRagas([rec('bhairavi', '20.1', null)], [stored('a', 'bhairavi', 20)]);
    expect(row.suggestion).toBe('apply');
  });
});

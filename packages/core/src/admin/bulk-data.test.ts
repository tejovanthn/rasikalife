import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_CSV_DOMAIN_KEYS } from './columns';

vi.mock('../domain/artist', () => ({
  getArtist: vi.fn(),
  getArtistByName: vi.fn(),
  createArtist: vi.fn(),
  updateArtist: vi.fn(),
}));
vi.mock('../domain/raga', () => ({
  getRaga: vi.fn(),
  getRagaByName: vi.fn(),
  createRaga: vi.fn(),
  updateRaga: vi.fn(),
}));
vi.mock('../domain/tala', () => ({
  getTala: vi.fn(),
  getTalaByName: vi.fn(),
  createTala: vi.fn(),
  updateTala: vi.fn(),
}));
vi.mock('../domain/composition', () => ({
  getComposition: vi.fn(),
  createComposition: vi.fn(),
  updateComposition: vi.fn(),
}));

import { BULK_DOMAIN_KEYS, bulkUpsertForDomain } from './bulk-data';

describe('BULK_DOMAIN_KEYS', () => {
  it('matches the CSV column registry so every domain can round-trip', () => {
    expect([...BULK_DOMAIN_KEYS].sort()).toEqual([...ADMIN_CSV_DOMAIN_KEYS].sort());
  });
});

describe('bulkUpsertForDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates rows without an id', async () => {
    const Raga = await import('../domain/raga');
    vi.mocked(Raga.createRaga).mockResolvedValue({ id: 'r-new', name: 'Kalyani' } as never);

    const result = await bulkUpsertForDomain(
      'raga',
      [{ name: 'Kalyani', melaNumber: 65 }],
      'user-1'
    );

    expect(result).toEqual({ created: 1, updated: 0, errors: [] });
    expect(Raga.createRaga).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kalyani', melaNumber: 65 })
    );
  });

  it('updates rows that reference an existing id', async () => {
    const Raga = await import('../domain/raga');
    vi.mocked(Raga.getRaga).mockResolvedValue({ id: 'r1', name: 'Old' } as never);
    vi.mocked(Raga.updateRaga).mockResolvedValue({ id: 'r1', name: 'New' } as never);

    const result = await bulkUpsertForDomain('raga', [{ id: 'r1', name: 'New' }], 'user-1');

    expect(result).toEqual({ created: 0, updated: 1, errors: [] });
    expect(Raga.updateRaga).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'New' }));
  });

  it('records an error when an id does not resolve', async () => {
    const Raga = await import('../domain/raga');
    vi.mocked(Raga.getRaga).mockResolvedValue(null as never);

    const result = await bulkUpsertForDomain('raga', [{ id: 'missing', name: 'Ghost' }], 'user-1');

    expect(result.updated).toBe(0);
    expect(result.errors[0]).toMatchObject({ index: 0, name: 'Ghost' });
    expect(result.errors[0].message).toContain('not found');
  });

  it('collects schema validation failures without aborting the batch', async () => {
    const Raga = await import('../domain/raga');
    vi.mocked(Raga.createRaga).mockResolvedValue({ id: 'r-ok', name: 'Good' } as never);

    const result = await bulkUpsertForDomain(
      'raga',
      [
        { name: 'Bad', melaNumber: 999 }, // exceeds the 72-melakarta ceiling
        { name: 'Good' },
      ],
      'user-1'
    );

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ index: 0, name: 'Bad' });
    expect(result.errors[0].message).toContain('melaNumber');
  });

  it('resolves linked names to ids before creating (get-or-create)', async () => {
    const Artist = await import('../domain/artist');
    const Raga = await import('../domain/raga');
    const Composition = await import('../domain/composition');

    vi.mocked(Artist.getArtistByName).mockResolvedValue(null as never);
    vi.mocked(Artist.createArtist).mockResolvedValue({ id: 'a1', name: 'Dikshitar' } as never);
    vi.mocked(Raga.getRagaByName).mockResolvedValue({ id: 'r1', name: 'Hamsadhwani' } as never);
    vi.mocked(Composition.createComposition).mockResolvedValue({ id: 'c1' } as never);

    const result = await bulkUpsertForDomain(
      'composition',
      [
        {
          title: 'Vatapi Ganapatim',
          composerName: 'Dikshitar',
          language: 'Sanskrit',
          ragaNames: ['Hamsadhwani'],
        },
      ],
      'user-1'
    );

    expect(result).toEqual({ created: 1, updated: 0, errors: [] });
    expect(Artist.createArtist).toHaveBeenCalledWith({ name: 'Dikshitar', gurus: [] });
    expect(Composition.createComposition).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vatapi Ganapatim',
        composer: { id: 'a1', name: 'Dikshitar' },
        language: 'Sanskrit',
        ragaIds: ['r1'],
      })
    );
  });

  it('throws on an unknown domain', async () => {
    await expect(bulkUpsertForDomain('nope', [], 'user-1')).rejects.toThrow('Unknown bulk domain');
  });
});

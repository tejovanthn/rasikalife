import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  TABLE_NAME: 'RasikaLifeTable',
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', () => ({
  SourceEntity: { get: vi.fn(), put: vi.fn() },
}));

import { CreateSourceSchema, getSources, putSource } from '.';
import { SourceEntity } from './entity';

const get = vi.mocked(SourceEntity.get);

beforeEach(() => vi.clearAllMocks());

describe('getSources', () => {
  it('reads each slug once, in one batch', async () => {
    get.mockReturnValue({ go: async () => ({ data: [{ slug: 'ssp-1963-tamil' }] }) } as never);
    const found = await getSources(['ssp-1963-tamil', 'ssp-1963-tamil', 'raga-nidhi']);
    expect(get).toHaveBeenCalledWith([{ slug: 'ssp-1963-tamil' }, { slug: 'raga-nidhi' }]);
    expect(found.map(s => s.slug)).toEqual(['ssp-1963-tamil']);
  });

  it('reads nothing for no slugs', async () => {
    expect(await getSources([])).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('putSource', () => {
  it('writes the whole row', async () => {
    const row = {
      slug: 'ssp-1963-tamil',
      title: 'Sangita Sampradaya Pradarshini (Tamil, 1963)',
      citation:
        'Subbarama Dikshitar, Sangita Sampradaya Pradarshini, Tamil ed., Music Academy, 1963.',
      kind: 'book' as const,
    };
    vi.mocked(SourceEntity.put).mockReturnValue({ go: async () => ({ data: row }) } as never);
    await putSource(row);
    expect(SourceEntity.put).toHaveBeenCalledWith(row);
  });
});

describe('CreateSourceSchema', () => {
  it('refuses a slug with spaces or capitals', () => {
    const base = { title: 't', citation: 'c', kind: 'book' };
    expect(CreateSourceSchema.safeParse({ ...base, slug: 'Raga Nidhi' }).success).toBe(false);
    expect(CreateSourceSchema.safeParse({ ...base, slug: 'raga-nidhi' }).success).toBe(true);
  });
});

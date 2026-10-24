import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  TABLE_NAME: 'RasikaLifeTable',
  dynamoClient: { send: vi.fn() },
}));

vi.mock('./entity', () => ({
  ShortLinkEntity: { get: vi.fn(), create: vi.fn() },
}));

import { ensureShortLinks, resolveShortLink, shortLinkCode } from '.';
import { ShortLinkEntity } from './entity';

const get = vi.mocked(ShortLinkEntity.get);
const create = vi.mocked(ShortLinkEntity.create);

function stored(rows: Array<{ code: string; target: string }>) {
  // A batch get receives a list; a single get an object.
  get.mockImplementation(((keys: { code: string } | Array<{ code: string }>) => ({
    go: async () =>
      Array.isArray(keys)
        ? { data: rows.filter(r => keys.some(k => k.code === r.code)), unprocessed: [] }
        : { data: rows.find(r => r.code === keys.code) ?? null },
  })) as never);
}

function creates(rows: Array<{ code: string; target: string }>, fail = false) {
  create.mockImplementation(((row: { code: string; target: string }) => ({
    go: async () => {
      if (fail) throw new Error('outage');
      rows.push(row);
      return { data: row };
    },
  })) as never);
}

const A = '/events/a-1?utm_source=whatsapp';
const B = '/events/b-2?utm_source=whatsapp';

beforeEach(() => vi.clearAllMocks());

describe('ensureShortLinks', () => {
  it('creates what is missing and reuses what exists', async () => {
    const rows = [{ code: shortLinkCode(A), target: A }];
    stored(rows);
    creates(rows);
    const codes = await ensureShortLinks([A, B, A]);
    expect(codes.get(A)).toBe(shortLinkCode(A));
    expect(codes.get(B)).toBe(shortLinkCode(B));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ code: shortLinkCode(B), target: B });
  });

  it('moves a target to a longer code when its code is taken by another', async () => {
    const rows = [{ code: shortLinkCode(B), target: '/events/someone-else' }];
    stored(rows);
    creates(rows);
    const codes = await ensureShortLinks([B]);
    expect(codes.get(B)).toBe(shortLinkCode(B, 8));
  });

  it('leaves out targets it refuses, and gives up after a few failed rounds', async () => {
    stored([]);
    creates([], true);
    const codes = await ensureShortLinks(['https://evil.example/', A]);
    expect(codes.size).toBe(0);
    expect(create.mock.calls.every(([row]) => (row as { target: string }).target === A)).toBe(true);
    expect(create.mock.calls.length).toBeLessThanOrEqual(4);
  });
});

describe('resolveShortLink', () => {
  it('returns the target, or null for an unknown or malformed code', async () => {
    stored([{ code: 'abcdefg', target: A }]);
    expect(await resolveShortLink('abcdefg')).toBe(A);
    expect(await resolveShortLink('zzzzzzz')).toBeNull();
    expect(await resolveShortLink('ABC')).toBeNull();
  });
});

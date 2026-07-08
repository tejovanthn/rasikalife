import { beforeEach, describe, expect, it, vi } from 'vitest';

// poster-hash.ts constructs its own ElectroDB Entity in-file (no separate entity.ts
// to mock), so intercept the `Entity` constructor itself to get a controllable stub.
vi.mock('electrodb', () => ({
  Entity: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    upsert: vi.fn(),
  })),
}));

import { PosterHashEntity, getPosterByHash, savePosterHash } from './poster-hash';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const record = {
  hash: 'hash-1',
  posterUploadId: 'upload-1',
  posterUrl: 'https://example.com/poster.png',
  eventIds: ['event-1'],
  createdBy: 'user-1',
};

describe('getPosterByHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the record when a matching hash exists', async () => {
    vi.mocked(PosterHashEntity.get).mockReturnValue(goResolves(record) as never);

    expect(await getPosterByHash('hash-1')).toEqual(record);
  });

  it('returns null when there is no matching hash', async () => {
    vi.mocked(PosterHashEntity.get).mockReturnValue(goResolves(undefined) as never);

    expect(await getPosterByHash('missing')).toBeNull();
  });
});

describe('savePosterHash', () => {
  it('upserts the poster hash record', async () => {
    vi.mocked(PosterHashEntity.upsert).mockReturnValue(goResolves(record) as never);

    await savePosterHash(record);

    expect(PosterHashEntity.upsert).toHaveBeenCalledWith(record);
  });
});

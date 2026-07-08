// packages/core/src/domain/search/indexer.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation(params => ({ ...params })),
}));

vi.mock('../artist', () => ({ listArtists: vi.fn() }));
vi.mock('../composition', () => ({ listCompositions: vi.fn() }));
vi.mock('../event', () => ({ listApprovedEvents: vi.fn() }));
vi.mock('../festival', () => ({ listFestivals: vi.fn() }));
vi.mock('../organiser', () => ({ listOrganisers: vi.fn() }));
vi.mock('../raga', () => ({ listRagas: vi.fn() }));
vi.mock('../tala', () => ({ listTalas: vi.fn() }));
vi.mock('../venue', () => ({ listVenues: vi.fn() }));

import { listArtists } from '../artist';
import { listCompositions } from '../composition';
import { listApprovedEvents } from '../event';
import { listFestivals } from '../festival';
import { listOrganisers } from '../organiser';
import { listRagas } from '../raga';
import { listTalas } from '../tala';
import { listVenues } from '../venue';
import { buildAndStoreSearchIndex, buildSearchIndex, storeSearchIndex } from './indexer';
import type { SearchIndex } from './types';

function emptyPage() {
  return { items: [], hasMore: false };
}

function mockAllListsEmpty() {
  vi.mocked(listArtists).mockResolvedValue(emptyPage() as never);
  vi.mocked(listRagas).mockResolvedValue(emptyPage() as never);
  vi.mocked(listTalas).mockResolvedValue(emptyPage() as never);
  vi.mocked(listCompositions).mockResolvedValue(emptyPage() as never);
  vi.mocked(listVenues).mockResolvedValue(emptyPage() as never);
  vi.mocked(listOrganisers).mockResolvedValue(emptyPage() as never);
  vi.mocked(listApprovedEvents).mockResolvedValue(emptyPage() as never);
  vi.mocked(listFestivals).mockResolvedValue(emptyPage() as never);
}

describe('buildSearchIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty index when every entity list is empty', async () => {
    mockAllListsEmpty();

    const index = await buildSearchIndex();

    expect(index.version).toBe(1);
    expect(index.documentCount).toBe(0);
    expect(index.documents).toEqual([]);
    expect(typeof index.builtAt).toBe('string');
    expect(index.fuseIndex).toBeDefined();
  });

  it('aggregates paginated results across all entity types into documents', async () => {
    mockAllListsEmpty();
    vi.mocked(listArtists).mockResolvedValue({
      items: [{ id: 'a1', name: 'Artist One' }],
      hasMore: false,
    } as never);
    vi.mocked(listRagas).mockResolvedValue({
      items: [{ id: 'r1', name: 'Raga One' }],
      hasMore: false,
    } as never);

    const index = await buildSearchIndex();

    expect(index.documentCount).toBe(2);
    expect(index.documents.map(d => d.entityType).sort()).toEqual(['artist', 'raga']);
  });

  it('follows pagination via nextToken until a list call reports no more pages', async () => {
    mockAllListsEmpty();
    vi.mocked(listArtists)
      .mockResolvedValueOnce({
        items: [{ id: 'a1', name: 'Page 1 Artist' }],
        nextToken: 'token-2',
        hasMore: true,
      } as never)
      .mockResolvedValueOnce({
        items: [{ id: 'a2', name: 'Page 2 Artist' }],
        hasMore: false,
      } as never);

    const index = await buildSearchIndex();

    expect(listArtists).toHaveBeenCalledTimes(2);
    expect(listArtists).toHaveBeenNthCalledWith(2, { limit: 100, nextToken: 'token-2' });
    expect(index.documents.filter(d => d.entityType === 'artist')).toHaveLength(2);
  });
});

describe('storeSearchIndex', () => {
  const index: SearchIndex = {
    version: 1,
    builtAt: '2025-01-15T12:00:00.000Z',
    documentCount: 0,
    fuseIndex: {},
    documents: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({});
  });

  it('throws when SEARCH_INDEX_BUCKET is not set', async () => {
    const original = process.env.SEARCH_INDEX_BUCKET;
    process.env.SEARCH_INDEX_BUCKET = '';

    await expect(storeSearchIndex(index)).rejects.toThrow(
      'SEARCH_INDEX_BUCKET environment variable is not set'
    );

    process.env.SEARCH_INDEX_BUCKET = original;
  });

  it('writes both a dated key and the latest pointer when the bucket is configured', async () => {
    const original = process.env.SEARCH_INDEX_BUCKET;
    process.env.SEARCH_INDEX_BUCKET = 'test-bucket';

    // indexer.ts reads INDEX_BUCKET from the environment once at module load time,
    // so re-import the module fresh after setting the env var for this test.
    vi.resetModules();
    const fresh = await import('./indexer');

    await fresh.storeSearchIndex(index);

    expect(sendMock).toHaveBeenCalledTimes(2);
    const calls = sendMock.mock.calls.map(([cmd]) => cmd as { Key: string });
    expect(calls.some(c => c.Key === 'search-index/latest/index.json')).toBe(true);
    expect(
      calls.some(
        c => c.Key.startsWith('search-index/') && c.Key !== 'search-index/latest/index.json'
      )
    ).toBe(true);

    process.env.SEARCH_INDEX_BUCKET = original;
  });
});

describe('buildAndStoreSearchIndex', () => {
  it('builds the index and then stores it', async () => {
    const original = process.env.SEARCH_INDEX_BUCKET;
    process.env.SEARCH_INDEX_BUCKET = 'test-bucket';
    vi.resetModules();
    vi.clearAllMocks();
    sendMock.mockResolvedValue({});
    mockAllListsEmpty();

    const fresh = await import('./indexer');
    await fresh.buildAndStoreSearchIndex();

    expect(sendMock).toHaveBeenCalledTimes(2);

    process.env.SEARCH_INDEX_BUCKET = original;
  });
});

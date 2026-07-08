// packages/core/src/domain/search/service.test.ts

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchDocument, SearchIndex } from './types';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  GetObjectCommand: vi.fn().mockImplementation(params => ({ ...params })),
}));

// service.ts imports ApplicationError/ErrorCode from the `@rasika/core` barrel (src/index.ts),
// which eagerly builds a cross-entity ElectroDB `Service` from the real entity modules. Mocking
// individual entity modules below would corrupt that construction, so import the real error
// classes directly from constants.ts instead of letting the barrel load at all.
vi.mock('@rasika/core', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ApplicationError: actual.ApplicationError, ErrorCode: actual.ErrorCode };
});

vi.mock('../artist/entity', () => ({ ArtistEntity: { get: vi.fn() } }));
vi.mock('../composition/entity', () => ({ CompositionEntity: { get: vi.fn() } }));
vi.mock('../event/entity', () => ({ EventEntity: { get: vi.fn() } }));
vi.mock('../festival/entity', () => ({ FestivalEntity: { get: vi.fn() } }));
vi.mock('../organiser/entity', () => ({ OrganiserEntity: { get: vi.fn() } }));
vi.mock('../raga/entity', () => ({ RagaEntity: { get: vi.fn() } }));
vi.mock('../tala/entity', () => ({ TalaEntity: { get: vi.fn() } }));
vi.mock('../venue/entity', () => ({ VenueEntity: { get: vi.fn() } }));

function makeDoc(overrides: Partial<SearchDocument>): SearchDocument {
  return {
    id: 'doc-1',
    entityType: 'artist',
    name: 'Name',
    description: '',
    displayName: 'Name',
    indexedAt: '2025-01-15T12:00:00.000Z',
    ...overrides,
  };
}

function makeIndex(documents: SearchDocument[], builtAt = '2025-01-15T06:00:00.000Z'): SearchIndex {
  return {
    version: 1,
    builtAt,
    documentCount: documents.length,
    fuseIndex: {},
    documents,
  };
}

function mockS3Index(index: SearchIndex) {
  sendMock.mockResolvedValue({
    Body: { transformToString: async () => JSON.stringify(index) },
  });
}

// service.ts reads SEARCH_INDEX_BUCKET and initializes `cachedIndex` at module scope,
// so each test gets a fresh module instance to avoid state bleeding across tests.
async function freshService() {
  vi.resetModules();
  return import('./service');
}

describe('search/service', () => {
  const originalBucket = process.env.SEARCH_INDEX_BUCKET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SEARCH_INDEX_BUCKET = 'test-bucket';
  });

  afterAll(() => {
    process.env.SEARCH_INDEX_BUCKET = originalBucket;
  });

  describe('loadIndex (via search)', () => {
    it('throws a SEARCH_INDEX_ERROR-wrapped failure when the bucket env var is unset', async () => {
      process.env.SEARCH_INDEX_BUCKET = '';
      const service = await freshService();

      await expect(service.search('anything')).rejects.toThrow(
        'Search failed: SEARCH_INDEX_BUCKET environment variable is not set'
      );
    });

    it('throws a SEARCH_QUERY_FAILED error when the index cannot be loaded from S3', async () => {
      sendMock.mockRejectedValue(new Error('network error'));
      const service = await freshService();

      await expect(service.search('anything')).rejects.toMatchObject({
        code: 'SEARCH_QUERY_FAILED',
      });
    });

    it('caches the index across calls within the same module instance', async () => {
      mockS3Index(makeIndex([makeDoc({ id: 'a1', name: 'Sanjay', displayName: 'Sanjay' })]));
      const service = await freshService();

      await service.search('Sanjay');
      await service.search('Sanjay');

      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    it('returns matching documents ranked by score', async () => {
      mockS3Index(
        makeIndex([
          makeDoc({
            id: 'a1',
            entityType: 'artist',
            name: 'Sanjay Subrahmanyan',
            displayName: 'Sanjay Subrahmanyan',
          }),
          makeDoc({ id: 'r1', entityType: 'raga', name: 'Kalyani', displayName: 'Kalyani' }),
        ])
      );
      const service = await freshService();

      const result = await service.search('Sanjay');

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.items.some(i => i.id === 'a1')).toBe(true);
      expect(result.items.every(i => typeof i.score === 'number')).toBe(true);
    });

    it('respects the limit and offset options', async () => {
      // Note: results are capped per entity type (maxPerType = ceil(limit / #types))
      // before the overall limit/offset is applied, so matches concentrated in a single
      // entity type can be under-represented. Spreading matches across two types avoids
      // that cap masking the pagination behavior under test.
      mockS3Index(
        makeIndex([
          makeDoc({
            id: 'a1',
            entityType: 'artist',
            name: 'Repeated Name',
            displayName: 'Repeated Name',
          }),
          makeDoc({
            id: 'r1',
            entityType: 'raga',
            name: 'Repeated Name',
            displayName: 'Repeated Name',
          }),
        ])
      );
      const service = await freshService();

      const firstPage = await service.search('Repeated', { limit: 1, offset: 0 });
      const secondPage = await service.search('Repeated', { limit: 1, offset: 1 });

      expect(firstPage.items).toHaveLength(1);
      expect(secondPage.items).toHaveLength(1);
      expect(firstPage.items[0].id).not.toEqual(secondPage.items[0].id);
    });

    it('returns no items for a query that matches nothing', async () => {
      mockS3Index(
        makeIndex([
          makeDoc({ id: 'a1', name: 'Sanjay Subrahmanyan', displayName: 'Sanjay Subrahmanyan' }),
        ])
      );
      const service = await freshService();

      const result = await service.search('zzzzznonexistentzzzzz');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('searchWithFullData', () => {
    it('batch-fetches full entity data for each matched result', async () => {
      mockS3Index(
        makeIndex([
          makeDoc({ id: 'artist-1', entityType: 'artist', name: 'Sanjay', displayName: 'Sanjay' }),
        ])
      );
      const service = await freshService();
      const { ArtistEntity } = await import('../artist/entity');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [{ id: 'artist-1', name: 'Sanjay' }] }),
      } as never);

      const result = await service.searchWithFullData('Sanjay');

      expect(ArtistEntity.get).toHaveBeenCalledWith([{ id: 'artist-1' }]);
      expect(result.artists).toEqual([{ id: 'artist-1', name: 'Sanjay' }]);
      expect(result.compositions).toEqual([]);
      expect(result.total).toBe(result.total);
    });

    it('skips a batch-get call entirely for entity types with no matches', async () => {
      mockS3Index(
        makeIndex([
          makeDoc({ id: 'artist-1', entityType: 'artist', name: 'Sanjay', displayName: 'Sanjay' }),
        ])
      );
      const service = await freshService();
      const { ArtistEntity } = await import('../artist/entity');
      const { RagaEntity } = await import('../raga/entity');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [{ id: 'artist-1', name: 'Sanjay' }] }),
      } as never);

      await service.searchWithFullData('Sanjay');

      expect(RagaEntity.get).not.toHaveBeenCalled();
    });
  });

  describe('getHealth', () => {
    it('reports healthy when the index was built recently', async () => {
      mockS3Index(makeIndex([], new Date().toISOString()));
      const service = await freshService();

      const health = await service.getHealth();

      expect(health.status).toBe('healthy');
    });

    it('reports stale when the index is older than 24 hours', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockS3Index(makeIndex([], oldDate));
      const service = await freshService();

      const health = await service.getHealth();

      expect(health.status).toBe('stale');
    });

    it('reports unhealthy when the index cannot be loaded', async () => {
      sendMock.mockRejectedValue(new Error('boom'));
      const service = await freshService();

      const health = await service.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.documentCount).toBe(0);
    });
  });

  describe('getDocuments', () => {
    it('returns all documents when no filters are given', async () => {
      mockS3Index(makeIndex([makeDoc({ id: 'a1' }), makeDoc({ id: 'r1', entityType: 'raga' })]));
      const service = await freshService();

      const result = await service.getDocuments();

      expect(result.documents).toHaveLength(2);
    });

    it('filters by entity type', async () => {
      mockS3Index(makeIndex([makeDoc({ id: 'a1' }), makeDoc({ id: 'r1', entityType: 'raga' })]));
      const service = await freshService();

      const result = await service.getDocuments('raga');

      expect(result.documents).toEqual([expect.objectContaining({ id: 'r1' })]);
    });

    it('filters by displayName prefix, case-insensitively', async () => {
      mockS3Index(
        makeIndex([
          makeDoc({ id: 'a1', displayName: 'Sanjay Subrahmanyan' }),
          makeDoc({ id: 'a2', displayName: 'Bombay Jayashri' }),
        ])
      );
      const service = await freshService();

      const result = await service.getDocuments(undefined, 'sanjay');

      expect(result.documents).toEqual([expect.objectContaining({ id: 'a1' })]);
    });
  });
});

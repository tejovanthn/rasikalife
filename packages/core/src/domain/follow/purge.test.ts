import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  UpdateCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock('../../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));
vi.mock('../../site-cache', () => ({ invalidateSitePaths: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./target', () => ({ resolveFollowTarget: vi.fn() }));

import { dynamoClient } from '../../db/client';
import { invalidateSitePaths } from '../../site-cache';
import { claimPurgeWindow, followPagePaths, purgeFollowedPages } from './purge';
import { resolveFollowTarget } from './target';

const send = vi.mocked(dynamoClient.send) as unknown as ReturnType<typeof vi.fn>;
const NOW = new Date('2026-11-16T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  send.mockReset();
  vi.mocked(resolveFollowTarget).mockImplementation((async (type: string, id: string) => ({
    type,
    id,
    name: 'Narada Gana Sabha',
  })) as never);
});

describe('followPagePaths', () => {
  it('names the slug form and the id-only form, each with a trailing wildcard', () => {
    expect(followPagePaths('venue', 'ID1', 'Narada Gana Sabha')).toEqual([
      '/venues/narada-gana-sabha-ID1*',
      '/venues/ID1*',
    ]);
    expect(followPagePaths('organiser', 'ID2', 'Sabha')[1]).toBe('/organisers/ID2*');
    expect(followPagePaths('artist', 'ID3', 'Asha')[0]).toBe('/artists/asha-ID3*');
  });

  it('encodes the slug like the web app', () => {
    expect(followPagePaths('artist', 'ID', 'Śrī Rāga')[0]).toBe(
      `/artists/${encodeURIComponent('śrī-rāga')}-ID*`
    );
  });
});

describe('claimPurgeWindow', () => {
  it('is a conditional update on the target marker', async () => {
    send.mockResolvedValue({});
    expect(await claimPurgeWindow('venue', 'v1', NOW)).toBe(true);
    const input = send.mock.calls[0]?.[0].input;
    expect(input.Key).toEqual({ pk: 'PURGE#venue#v1', sk: 'MARKER' });
    expect(input.ConditionExpression).toContain('lastPurgedAt < :cutoff');
    expect(input.ExpressionAttributeValues[':cutoff']).toBe(NOW.getTime() - 30 * 60 * 1000);
  });

  it('is false inside the window, without logging an error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(
      Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' })
    );
    expect(await claimPurgeWindow('venue', 'v1', NOW)).toBe(false);
    expect(err).not.toHaveBeenCalled();
  });

  it('is false, and logs, when the marker cannot be written', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('throttled'));
    expect(await claimPurgeWindow('venue', 'v1', NOW)).toBe(false);
    expect(err).toHaveBeenCalled();
  });
});

describe('purgeFollowedPages', () => {
  it('purges only the claimed targets pages, and never /*', async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' })
      );
    await purgeFollowedPages(
      [
        { type: 'venue', id: 'v1' },
        { type: 'organiser', id: 'o1' },
      ],
      NOW
    );
    const paths = vi.mocked(invalidateSitePaths).mock.calls[0]?.[0] ?? [];
    expect(paths).toEqual(['/venues/narada-gana-sabha-v1*', '/venues/v1*']);
    expect(paths).not.toContain('/*');
  });

  it('claims once for a target named twice', async () => {
    send.mockResolvedValue({});
    await purgeFollowedPages(
      [
        { type: 'venue', id: 'v1' },
        { type: 'venue', id: 'v1' },
      ],
      NOW
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(resolveFollowTarget).mockRejectedValue(new Error('db down'));
    await expect(purgeFollowedPages([{ type: 'venue', id: 'v1' }], NOW)).resolves.toBeUndefined();
  });
});

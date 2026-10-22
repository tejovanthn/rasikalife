import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { invalidateSiteCache } from '@rasika/core/site-cache';
import { changesPublicPage, clearSiteCacheAfterMutation } from './site-cache';

describe('changesPublicPage', () => {
  it('is true for a successful mutation on a public router', () => {
    expect(changesPublicPage('mutation', 'composition.update', true)).toBe(true);
    // The event page shows the RSVP count.
    expect(changesPublicPage('mutation', 'rsvp.toggle', true)).toBe(true);
  });

  it('is false for queries and failed mutations', () => {
    expect(changesPublicPage('query', 'composition.get', true)).toBe(false);
    expect(changesPublicPage('mutation', 'composition.update', false)).toBe(false);
  });

  it('is false for routers that never change a rasika.life page', () => {
    expect(changesPublicPage('mutation', 'classes.markAttended', true)).toBe(false);
    expect(changesPublicPage('mutation', 'concertLog.upsert', true)).toBe(false);
    expect(changesPublicPage('mutation', 'user.updatePreferences', true)).toBe(false);
  });
});

describe('clearSiteCacheAfterMutation', () => {
  beforeEach(() => vi.mocked(invalidateSiteCache).mockClear());

  it('clears after the write, and returns the write result', async () => {
    const order: string[] = [];
    vi.mocked(invalidateSiteCache).mockImplementation(async () => {
      order.push('clear');
    });
    const result = await clearSiteCacheAfterMutation({
      type: 'mutation',
      path: 'raga.update',
      next: async () => {
        order.push('write');
        return { ok: true as const, data: 1 };
      },
    });

    expect(order).toEqual(['write', 'clear']);
    expect(result).toEqual({ ok: true, data: 1 });
    expect(invalidateSiteCache).toHaveBeenCalledWith('tRPC raga.update');
  });

  it('does not clear when the mutation failed', async () => {
    await clearSiteCacheAfterMutation({
      type: 'mutation',
      path: 'raga.update',
      next: async () => ({ ok: false as const }),
    });
    expect(invalidateSiteCache).not.toHaveBeenCalled();
  });
});

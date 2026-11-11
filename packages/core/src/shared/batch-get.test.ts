import { describe, expect, it, vi } from 'vitest';
import { batchGetAll } from './batch-get';

const sleep = vi.fn().mockResolvedValue(undefined);

describe('batchGetAll', () => {
  it('returns every row when nothing is left over', async () => {
    const get = vi.fn(async (keys: number[]) => ({ data: keys.map(k => k * 2) }));
    expect(await batchGetAll([1, 2], get, { sleep })).toEqual([2, 4]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('retries unprocessed keys with backoff and keeps those rows', async () => {
    sleep.mockClear();
    const get = vi
      .fn<(keys: number[]) => Promise<{ data: number[]; unprocessed?: number[] }>>()
      .mockResolvedValueOnce({ data: [2], unprocessed: [2, 3] })
      .mockResolvedValueOnce({ data: [4], unprocessed: [3] })
      .mockResolvedValueOnce({ data: [6] });
    expect(await batchGetAll([1, 2, 3], get, { sleep, baseDelayMs: 10 })).toEqual([2, 4, 6]);
    expect(get.mock.calls[1]?.[0]).toEqual([2, 3]);
    expect(get.mock.calls[2]?.[0]).toEqual([3]);
    expect(sleep.mock.calls.map(c => c[0])).toEqual([10, 20]);
  });

  it('throws when keys are still unprocessed after the retries', async () => {
    const get = vi.fn(async () => ({ data: [] as number[], unprocessed: [9] }));
    await expect(batchGetAll([9], get, { sleep, retries: 2 })).rejects.toThrow(/unprocessed/);
    expect(get).toHaveBeenCalledTimes(3);
  });
});

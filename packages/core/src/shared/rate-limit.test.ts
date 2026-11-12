import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  UpdateCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock('../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));

import { dynamoClient } from '../db/client';
import { hitRateLimit } from './rate-limit';

const send = vi.mocked(dynamoClient.send) as unknown as ReturnType<typeof vi.fn>;
const NOW = new Date('2026-11-16T12:00:30Z');
const WINDOW_START = Math.floor(Date.parse('2026-11-16T12:00:00Z') / 1000);

beforeEach(() => {
  send.mockReset();
});

describe('hitRateLimit', () => {
  it('keys the counter per key and minute and adds atomically', async () => {
    send.mockResolvedValue({ Attributes: { hits: 1 } });
    await hitRateLimit({ key: 'follow#u1', limit: 30, windowSec: 60, now: NOW });
    const input = send.mock.calls[0]?.[0].input;
    expect(input.Key).toEqual({ pk: 'RATELIMIT#follow#u1', sk: `WINDOW#${WINDOW_START}` });
    expect(input.UpdateExpression).toContain('ADD hits');
  });

  it('allows up to the limit and refuses the next call', async () => {
    send.mockResolvedValueOnce({ Attributes: { hits: 30 } });
    expect((await hitRateLimit({ key: 'k', limit: 30, windowSec: 60, now: NOW })).allowed).toBe(
      true
    );
    send.mockResolvedValueOnce({ Attributes: { hits: 31 } });
    expect((await hitRateLimit({ key: 'k', limit: 30, windowSec: 60, now: NOW })).allowed).toBe(
      false
    );
  });

  it('fails open when the counter errors', async () => {
    send.mockImplementation(() => {
      throw new Error('throttled');
    });
    const result = await hitRateLimit({ key: 'k', limit: 1, windowSec: 60, now: NOW });
    expect(result.allowed).toBe(true);
  });
});

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  PushSubscriptionEntity: { put: vi.fn(), delete: vi.fn(), query: { primary: vi.fn() } },
}));

import {
  deletePushSubscription,
  deleteUserPushSubscriptions,
  hashEndpoint,
  putPushSubscription,
} from '.';
import { ErrorCode } from '../../constants';
import { PushSubscriptionEntity } from './entity';
import { isAllowedPushEndpoint } from './schema';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';
const KEYS = { p256dh: 'p256-key', auth: 'auth-key' };
const goes = () => ({ go: vi.fn().mockResolvedValue({ data: {} }) });

beforeEach(() => vi.clearAllMocks());

describe('hashEndpoint', () => {
  it('is the sha256 of the endpoint, in hex', () => {
    expect(hashEndpoint(ENDPOINT)).toBe(createHash('sha256').update(ENDPOINT).digest('hex'));
    expect(hashEndpoint(ENDPOINT)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEndpoint(`${ENDPOINT}x`)).not.toBe(hashEndpoint(ENDPOINT));
  });
});

describe('putPushSubscription', () => {
  it('stores the endpoint under its hash, so one browser is one row', async () => {
    vi.mocked(PushSubscriptionEntity.put).mockReturnValue(goes() as never);

    await putPushSubscription('u1', { endpoint: ENDPOINT, keys: KEYS }, 'UA');
    await putPushSubscription('u1', { endpoint: ENDPOINT, keys: KEYS }, 'UA');

    const [first, second] = vi.mocked(PushSubscriptionEntity.put).mock.calls.map(c => c[0]);
    expect(first).toEqual({
      userId: 'u1',
      endpointHash: hashEndpoint(ENDPOINT),
      endpoint: ENDPOINT,
      p256dh: 'p256-key',
      auth: 'auth-key',
      userAgent: 'UA',
    });
    expect(second.endpointHash).toBe(first.endpointHash);
  });

  it.each([
    ['not a url', { endpoint: 'nope', keys: KEYS }],
    ['internal host', { endpoint: 'https://169.254.169.254/latest', keys: KEYS }],
    ['lookalike host', { endpoint: 'https://fcm.googleapis.com.evil.com/x', keys: KEYS }],
    ['suffix trick', { endpoint: 'https://evilpush.apple.com.example.org/x', keys: KEYS }],
    ['other https host', { endpoint: 'https://push.example.com/x', keys: KEYS }],
    ['http endpoint', { endpoint: 'http://push.example.com/x', keys: KEYS }],
    ['missing keys', { endpoint: ENDPOINT }],
    ['empty keys', { endpoint: ENDPOINT, keys: { p256dh: '', auth: '' } }],
  ])('refuses %s', async (_label, input) => {
    await expect(putPushSubscription('u1', input as never)).rejects.toMatchObject({
      code: ErrorCode.PUSH_SUBSCRIPTION_INVALID,
    });
    expect(PushSubscriptionEntity.put).not.toHaveBeenCalled();
  });
});

describe('deletePushSubscription', () => {
  it('deletes by the hash of the endpoint', async () => {
    vi.mocked(PushSubscriptionEntity.delete).mockReturnValue(goes() as never);
    await deletePushSubscription('u1', ENDPOINT);
    expect(PushSubscriptionEntity.delete).toHaveBeenCalledWith({
      userId: 'u1',
      endpointHash: hashEndpoint(ENDPOINT),
    });
  });
});

describe('deleteUserPushSubscriptions', () => {
  it('removes every endpoint the user registered', async () => {
    vi.mocked(PushSubscriptionEntity.query.primary).mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: [{ endpointHash: 'h1' }, { endpointHash: 'h2' }],
      }),
    } as never);
    vi.mocked(PushSubscriptionEntity.delete).mockReturnValue(goes() as never);

    expect(await deleteUserPushSubscriptions('u1')).toBe(2);
    expect(PushSubscriptionEntity.delete).toHaveBeenCalledWith({
      userId: 'u1',
      endpointHash: 'h1',
    });
    expect(PushSubscriptionEntity.delete).toHaveBeenCalledWith({
      userId: 'u1',
      endpointHash: 'h2',
    });
  });
});

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QL3',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])('allows %s', url => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it('refuses a bare parent domain for the wildcard hosts and any other port', () => {
    expect(isAllowedPushEndpoint('https://push.apple.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://u:p@fcm.googleapis.com/x')).toBe(false);
  });
});

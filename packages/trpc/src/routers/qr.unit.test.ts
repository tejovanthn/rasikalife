import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  resolveScan: vi.fn(),
  setWhatsapp: vi.fn(),
  dismissWhatsappPrompt: vi.fn(),
}));

vi.mock('@rasika/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...actual,
    VenueQr: { ...actual.VenueQr, resolveScan: core.resolveScan },
    User: {
      ...actual.User,
      setWhatsapp: core.setWhatsapp,
      dismissWhatsappPrompt: core.dismissWhatsappPrompt,
    },
  };
});
const limiter = vi.hoisted(() => ({ hitRateLimit: vi.fn() }));
vi.mock('@rasika/core/shared/rate-limit', () => limiter);
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { notifyRouter } from './notify';
import { qrRouter } from './qr';

const anon = qrRouter.createCaller({ event: {} as never, user: null });
const notifyAnon = notifyRouter.createCaller({ event: {} as never, user: null });
const notifyUser = notifyRouter.createCaller({ event: {} as never, user: { id: 'u1' } as never });

beforeEach(() => {
  for (const fn of Object.values(core)) fn.mockReset();
  limiter.hitRateLimit.mockReset();
  limiter.hitRateLimit.mockResolvedValue({ allowed: true, hits: 1 });
});

describe('qr.resolve', () => {
  it('is public and passes the code to core', async () => {
    core.resolveScan.mockResolvedValue({ state: 'not-found' });
    expect(await anon.resolve({ code: 'ABCDEFGH' })).toEqual({ state: 'not-found' });
    expect(core.resolveScan).toHaveBeenCalledWith('ABCDEFGH', expect.any(Date), { count: false });
  });

  it('counts a scan only when the caller asks (the /q/:code document loader)', async () => {
    core.resolveScan.mockResolvedValue({ state: 'not-found' });
    await anon.resolve({ code: 'ABCDEFGH', count: true });
    expect(core.resolveScan).toHaveBeenCalledWith('ABCDEFGH', expect.any(Date), { count: true });
  });

  it('rejects a malformed code before reaching core', async () => {
    await expect(anon.resolve({ code: 'abc' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(anon.resolve({ code: 'ABCDEFGI' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(core.resolveScan).not.toHaveBeenCalled();
  });
});

describe('notify whatsapp', () => {
  it('refuses a signed-out caller', async () => {
    await expect(
      notifyAnon.setWhatsapp({ number: '9845012345', consent: true })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('requires consent and a valid number before reaching core', async () => {
    await expect(
      notifyUser.setWhatsapp({ number: '9845012345', consent: false as never })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      notifyUser.setWhatsapp({ number: '1234567890', consent: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(core.setWhatsapp).not.toHaveBeenCalled();
  });

  it('stores the number for the signed-in user', async () => {
    core.setWhatsapp.mockResolvedValue({});
    await notifyUser.setWhatsapp({ number: '9845012345', consent: true });
    expect(core.setWhatsapp).toHaveBeenCalledWith('u1', { number: '9845012345', consent: true });
  });

  it('maps a core refusal to BAD_REQUEST', async () => {
    core.setWhatsapp.mockRejectedValue(
      new ApplicationError(ErrorCode.WHATSAPP_INVALID_NUMBER, 'bad')
    );
    await expect(
      notifyUser.setWhatsapp({ number: '9845012345', consent: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('dismisses the prompt', async () => {
    await notifyUser.dismissWhatsappPrompt();
    expect(core.dismissWhatsappPrompt).toHaveBeenCalledWith('u1');
  });
});

describe('qr.resolve per-IP limit', () => {
  it('returns rate-limited and skips core when the IP is over the limit', async () => {
    limiter.hitRateLimit.mockResolvedValue({ allowed: false, hits: 301 });
    expect(await anon.resolve({ code: 'ABCDEFGH', count: true, clientIp: '203.0.113.9' })).toEqual({
      state: 'rate-limited',
    });
    expect(limiter.hitRateLimit).toHaveBeenCalledWith({
      key: 'scan-ip#203.0.113.9',
      limit: 300,
      windowSec: 60,
    });
    expect(core.resolveScan).not.toHaveBeenCalled();
  });

  it('resolves normally under the limit', async () => {
    core.resolveScan.mockResolvedValue({ state: 'not-found' });
    await anon.resolve({ code: 'ABCDEFGH', count: true, clientIp: '203.0.113.9' });
    expect(core.resolveScan).toHaveBeenCalled();
  });

  it('applies no limit without an IP', async () => {
    core.resolveScan.mockResolvedValue({ state: 'not-found' });
    await anon.resolve({ code: 'ABCDEFGH', count: true });
    expect(limiter.hitRateLimit).not.toHaveBeenCalled();
  });

  it('does not count a read without count (done and add pages)', async () => {
    core.resolveScan.mockResolvedValue({ state: 'not-found' });
    await anon.resolve({ code: 'ABCDEFGH', clientIp: '203.0.113.9' });
    await anon.resolve({ code: 'ABCDEFGH', count: false, clientIp: '203.0.113.9' });
    expect(limiter.hitRateLimit).not.toHaveBeenCalled();
    expect(core.resolveScan).toHaveBeenCalledTimes(2);
  });

  it('rejects an oversized clientIp', async () => {
    await expect(
      anon.resolve({ code: 'ABCDEFGH', count: true, clientIp: 'x'.repeat(46) })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

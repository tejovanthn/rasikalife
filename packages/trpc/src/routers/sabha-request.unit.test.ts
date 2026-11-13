import { beforeEach, describe, expect, it, vi } from 'vitest';

const limiter = vi.hoisted(() => ({ hitRateLimit: vi.fn() }));
const mail = vi.hoisted(() => ({ sendSabhaRequestEmail: vi.fn() }));
vi.mock('@rasika/core/shared/rate-limit', () => limiter);
vi.mock('../sabha-request-email', () => mail);

import { sabhaRequestRouter } from './sabha-request';

const anon = sabhaRequestRouter.createCaller({ event: {} as never, user: null });

const input = {
  venueName: 'Bangalore Gayana Samaja',
  contactName: 'R. Srinivasan',
  role: 'Secretary',
  whatsapp: '9876543210',
  concertDates: '22 Dec',
  clientIp: '203.0.113.9',
};

beforeEach(() => {
  limiter.hitRateLimit.mockReset().mockResolvedValue({ allowed: true, hits: 1 });
  mail.sendSabhaRequestEmail.mockReset().mockResolvedValue(true);
});

describe('sabhaRequest.submit', () => {
  it('sends one email for a signed-out visitor, without the transport fields', async () => {
    expect(await anon.submit(input)).toEqual({ status: 'sent' });
    expect(mail.sendSabhaRequestEmail).toHaveBeenCalledTimes(1);
    const { clientIp, website, ...request } = { ...input, website: undefined };
    expect(mail.sendSabhaRequestEmail).toHaveBeenCalledWith(request);
    expect(limiter.hitRateLimit).toHaveBeenCalledWith({
      key: 'sabha-request-ip#203.0.113.9',
      limit: 5,
      windowSec: 3600,
    });
  });

  it('answers sent and sends nothing when the honeypot is filled', async () => {
    expect(await anon.submit({ ...input, website: 'http://spam.example' })).toEqual({
      status: 'sent',
    });
    expect(mail.sendSabhaRequestEmail).not.toHaveBeenCalled();
    expect(limiter.hitRateLimit).not.toHaveBeenCalled();
  });

  it('does not send past the limit', async () => {
    limiter.hitRateLimit.mockResolvedValue({ allowed: false, hits: 6 });
    expect(await anon.submit(input)).toEqual({ status: 'rate-limited' });
    expect(mail.sendSabhaRequestEmail).not.toHaveBeenCalled();
  });

  it('applies no limit when there is no address', async () => {
    const { clientIp, ...noIp } = input;
    expect(await anon.submit(noIp)).toEqual({ status: 'sent' });
    expect(limiter.hitRateLimit).not.toHaveBeenCalled();
  });

  it('reports a failed send as a status, never an error', async () => {
    mail.sendSabhaRequestEmail.mockResolvedValue(false);
    expect(await anon.submit(input)).toEqual({ status: 'failed' });
  });

  it('refuses a bad WhatsApp number', async () => {
    await expect(anon.submit({ ...input, whatsapp: '12345' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

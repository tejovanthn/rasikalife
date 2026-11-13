import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactional } = vi.hoisted(() => ({ sendTransactional: vi.fn() }));
const sabhaRequestEmail = vi.hoisted(() =>
  vi.fn(async () => ({ subject: 's', html: 'h', text: 't' }))
);

vi.mock('@rasika/core', () => ({ Email: { sendTransactional } }));
vi.mock('@rasika/email', () => ({ sabhaRequestEmail }));

import { sabhaRequestRecipient, sendSabhaRequestEmail } from './sabha-request-email';

const request = { venueName: 'Hall', contactName: 'A', whatsapp: '9876543210' };

beforeEach(() => {
  sendTransactional.mockReset().mockResolvedValue(undefined);
  vi.unstubAllEnvs();
});

describe('sabhaRequestRecipient', () => {
  it('defaults to hello@rasika.life', () => {
    expect(sabhaRequestRecipient({})).toBe('hello@rasika.life');
    expect(sabhaRequestRecipient({ SABHA_REQUEST_TO: '  ' })).toBe('hello@rasika.life');
  });

  it('reads SABHA_REQUEST_TO', () => {
    expect(sabhaRequestRecipient({ SABHA_REQUEST_TO: 'team@example.org' })).toBe(
      'team@example.org'
    );
  });
});

describe('sendSabhaRequestEmail', () => {
  it('sends from the transactional identity to the team', async () => {
    vi.stubEnv('SABHA_REQUEST_TO', 'team@example.org');
    await expect(sendSabhaRequestEmail(request)).resolves.toBe(true);
    expect(sendTransactional).toHaveBeenCalledWith({
      to: 'team@example.org',
      fromName: 'Rasika.life',
      subject: 's',
      html: 'h',
      text: 't',
    });
  });

  it('returns false instead of throwing when the send fails', async () => {
    sendTransactional.mockRejectedValue(new Error('ses down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendSabhaRequestEmail(request)).resolves.toBe(false);
  });
});

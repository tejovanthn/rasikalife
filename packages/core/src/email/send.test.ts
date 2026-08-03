import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFromAddress, sendTransactional } from './send';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    send = sendMock;
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getFromAddress', () => {
  it('prefixes noreply@ when the verified identity is a domain', () => {
    vi.stubEnv('EMAIL_SENDER', 'classes.rasika.life');
    expect(getFromAddress()).toBe('Rasika Classes <noreply@classes.rasika.life>');
  });

  it('uses a verified single address as-is, since it cannot send as anything else', () => {
    vi.stubEnv('EMAIL_SENDER', 'hello@classes.rasika.life');
    expect(getFromAddress()).toBe('Rasika Classes <hello@classes.rasika.life>');
  });

  /**
   * The alternative is the malformed `noreply@`, which SES rejects with an error naming neither
   * the variable nor the unlinked resource.
   */
  it('names the missing variable rather than building a malformed address', () => {
    vi.stubEnv('EMAIL_SENDER', '');
    expect(() => getFromAddress()).toThrow(/EMAIL_SENDER/);
  });
});

describe('sendTransactional', () => {
  const base = { to: 'parent@example.com', subject: 'Subject', html: '<p>Body</p>', text: 'Body' };

  it('sends replies to the address given, not to the noreply sender', async () => {
    vi.stubEnv('EMAIL_SENDER', 'classes.rasika.life');
    await sendTransactional({ ...base, replyTo: 'guru@example.com' });

    const { input } = sendMock.mock.calls[0][0];
    expect(input.FromEmailAddress).toBe('Rasika Classes <noreply@classes.rasika.life>');
    expect(input.ReplyToAddresses).toEqual(['guru@example.com']);
    expect(input.Destination.ToAddresses).toEqual(['parent@example.com']);
  });

  it('omits the header entirely when no reply address is given', async () => {
    vi.stubEnv('EMAIL_SENDER', 'classes.rasika.life');
    await sendTransactional(base);

    expect(sendMock.mock.calls[0][0].input.ReplyToAddresses).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactional } = vi.hoisted(() => ({ sendTransactional: vi.fn() }));
const partnerInviteEmail = vi.hoisted(() =>
  vi.fn(async () => ({ subject: 's', html: 'h', text: 't' }))
);

vi.mock('@rasika/core', () => ({ Email: { sendTransactional } }));
vi.mock('@rasika/email', () => ({ partnerInviteEmail }));

import { sendPartnerInviteEmail } from './partner-invite-email';

const input = { to: 'sec@example.org', inviterName: 'Tejovanth', targetName: 'Hall' };

beforeEach(() => {
  sendTransactional.mockReset().mockResolvedValue(undefined);
  partnerInviteEmail.mockClear();
});

describe('sendPartnerInviteEmail', () => {
  it('sends one transactional email as Rasika.life to the invited address', async () => {
    await expect(sendPartnerInviteEmail(input)).resolves.toBe(true);
    expect(partnerInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterName: 'Tejovanth',
        targetName: 'Hall',
        inviteeEmail: 'sec@example.org',
      })
    );
    expect(sendTransactional).toHaveBeenCalledWith({
      to: 'sec@example.org',
      fromName: 'Rasika.life',
      subject: 's',
      html: 'h',
      text: 't',
    });
  });

  it('reports a failed send instead of throwing, so the stored invite is kept', async () => {
    sendTransactional.mockRejectedValue(new Error('ses down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendPartnerInviteEmail(input)).resolves.toBe(false);
  });
});

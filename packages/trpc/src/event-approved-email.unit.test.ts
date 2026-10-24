import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, sendTransactional } = vi.hoisted(() => ({
  getUser: vi.fn(),
  sendTransactional: vi.fn(),
}));

vi.mock('@rasika/core', () => ({
  User: { getUser },
  Email: { sendTransactional },
}));

vi.mock('@rasika/email', () => ({
  eventApprovedEmail: vi.fn(async () => ({ subject: 's', html: 'h', text: 't' })),
}));

import { sendEventApprovedEmail } from './event-approved-email';

const event = {
  id: 'e1',
  title: 'Concert',
  startDateTime: '2026-11-01T18:00:00+05:30',
  timezone: 'Asia/Kolkata',
  createdBy: 'submitter',
} as Parameters<typeof sendEventApprovedEmail>[0];

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ id: 'submitter', email: 'sabha@example.com' });
  sendTransactional.mockReset().mockResolvedValue(undefined);
});

describe('sendEventApprovedEmail', () => {
  it('emails the submitter as Rasika.life', async () => {
    await sendEventApprovedEmail(event, 'moderator');
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sabha@example.com', fromName: 'Rasika.life' })
    );
  });

  it('sends nothing when a moderator approves their own event', async () => {
    await sendEventApprovedEmail(event, 'submitter');
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('sends nothing to a user with no email', async () => {
    getUser.mockResolvedValue({ id: 'submitter' });
    await sendEventApprovedEmail(event, 'moderator');
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('never throws, since the event is approved either way', async () => {
    sendTransactional.mockRejectedValue(new Error('SES down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendEventApprovedEmail(event, 'moderator')).resolves.toBeUndefined();
    log.mockRestore();
  });
});

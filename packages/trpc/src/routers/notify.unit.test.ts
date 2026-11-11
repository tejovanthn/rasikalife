import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => ({
  getUser: vi.fn(),
  setNotifyPrefs: vi.fn(),
  removeWhatsapp: vi.fn(),
}));
const push = vi.hoisted(() => ({
  putPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  listPushSubscriptions: vi.fn(),
}));
const notification = vi.hoisted(() => ({
  checkUnsubscribeToken: vi.fn(),
  unsubscribeWithToken: vi.fn(),
}));

vi.mock('@rasika/core', async importOriginal => {
  const core = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...core,
    User: { ...core.User, ...user },
    Notification: { ...core.Notification, ...notification },
    PushSubscription: { ...core.PushSubscription, ...push },
  };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { changesPublicPage } from '../middleware/site-cache';
import { notifyRouter } from './notify';

const caller = notifyRouter.createCaller({ event: {} as never, user: { id: 'u1' } as never });
const anon = notifyRouter.createCaller({ event: {} as never, user: null });

beforeEach(() => {
  for (const fn of [...Object.values(user), ...Object.values(notification), ...Object.values(push)])
    fn.mockReset();
  process.env.UNSUBSCRIBE_SECRET = 's';
});

describe('notify router', () => {
  it('refuses a signed-out caller on the settings calls', async () => {
    await expect(anon.getPrefs()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(anon.setPrefs({ notifyEmail: false })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(anon.removeWhatsapp()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('getPrefs applies defaults and shows the WhatsApp row', async () => {
    user.getUser.mockResolvedValue({ whatsappNumber: '9845012345' });
    expect(await caller.getPrefs()).toEqual({
      notifyDigest: true,
      notifyReminder: true,
      notifyEmail: true,
      notifyPush: false,
      whatsapp: { number: '9845012345', verified: false },
    });
    user.getUser.mockResolvedValue({ whatsappNumber: '9845012345', whatsappVerifiedAt: 'x' });
    expect((await caller.getPrefs()).whatsapp?.verified).toBe(true);
    user.getUser.mockResolvedValue({});
    expect((await caller.getPrefs()).whatsapp).toBeNull();
  });

  it('setPrefs writes the caller only', async () => {
    user.setNotifyPrefs.mockResolvedValue({});
    await caller.setPrefs({ notifyDigest: false });
    expect(user.setNotifyPrefs).toHaveBeenCalledWith('u1', { notifyDigest: false });
  });

  it('removeWhatsapp removes the caller number', async () => {
    await caller.removeWhatsapp();
    expect(user.removeWhatsapp).toHaveBeenCalledWith('u1');
  });

  it('checkUnsubscribe is public, reads only and returns null for a bad link', async () => {
    notification.checkUnsubscribeToken.mockResolvedValueOnce({ userId: 'u1', kind: 'digest' });
    expect(await anon.checkUnsubscribe({ token: 'a.b' })).toEqual({ kind: 'digest' });
    notification.checkUnsubscribeToken.mockResolvedValueOnce(null);
    expect(await anon.checkUnsubscribe({ token: 'bad' })).toBeNull();
    expect(notification.unsubscribeWithToken).not.toHaveBeenCalled();
  });

  it('unsubscribe is public and passes the secret', async () => {
    notification.unsubscribeWithToken.mockResolvedValue({ kind: 'all' });
    expect(await anon.unsubscribe({ token: 'a.b' })).toEqual({ kind: 'all' });
    expect(notification.unsubscribeWithToken).toHaveBeenCalledWith('a.b', 's');
  });

  describe('push', () => {
    const sub = { endpoint: 'https://fcm.example/abc', keys: { p256dh: 'k', auth: 'a' } };

    it('subscribePush stores the endpoint for the caller and turns notifyPush on', async () => {
      await caller.subscribePush(sub);
      expect(push.putPushSubscription).toHaveBeenCalledWith('u1', sub, undefined);
      expect(user.setNotifyPrefs).toHaveBeenCalledWith('u1', { notifyPush: true });
    });

    it('maps PUSH_SUBSCRIPTION_INVALID to BAD_REQUEST and leaves the pref alone', async () => {
      push.putPushSubscription.mockRejectedValue(
        new ApplicationError(ErrorCode.PUSH_SUBSCRIPTION_INVALID, 'bad')
      );
      await expect(caller.subscribePush(sub)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(user.setNotifyPrefs).not.toHaveBeenCalled();
    });

    it('refuses an endpoint that is not a URL or keys that are missing', async () => {
      await expect(caller.subscribePush({ ...sub, endpoint: 'nope' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(
        caller.subscribePush({ endpoint: sub.endpoint, keys: { p256dh: '', auth: 'a' } })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('unsubscribing the last device turns notifyPush off', async () => {
      push.listPushSubscriptions.mockResolvedValue([]);
      await caller.unsubscribePush({ endpoint: sub.endpoint });
      expect(push.deletePushSubscription).toHaveBeenCalledWith('u1', sub.endpoint);
      expect(user.setNotifyPrefs).toHaveBeenCalledWith('u1', { notifyPush: false });
    });

    it('unsubscribing one of several devices keeps notifyPush on', async () => {
      push.listPushSubscriptions.mockResolvedValue([{ endpointHash: 'h' }]);
      expect(await caller.unsubscribePush({ endpoint: sub.endpoint })).toEqual({ remaining: 1 });
      expect(user.setNotifyPrefs).not.toHaveBeenCalled();
    });

    it('needs a signed-in caller', async () => {
      await expect(anon.subscribePush(sub)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  it('does not clear the page cache', () => {
    expect(changesPublicPage('mutation', 'notify.setPrefs', true)).toBe(false);
    expect(changesPublicPage('mutation', 'notify.unsubscribe', true)).toBe(false);
  });
});

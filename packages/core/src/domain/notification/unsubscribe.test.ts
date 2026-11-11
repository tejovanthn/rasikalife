import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => ({
  getUser: vi.fn(),
  setNotifyPrefs: vi.fn(),
  rotateUnsubscribeToken: vi.fn(),
}));
vi.mock('../user', () => user);

import {
  signUnsubscribeToken,
  unsubscribePatch,
  unsubscribeWithToken,
  verifyUnsubscribeSignature,
} from './unsubscribe';

const SECRET = 'test-secret';
const payload = { userId: 'u1', kind: 'digest' as const, token: 'tok_-abc' };

beforeEach(() => {
  for (const fn of Object.values(user)) fn.mockReset();
});

describe('unsubscribe link', () => {
  it('round trips', () => {
    const link = signUnsubscribeToken(payload, SECRET);
    expect(link).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyUnsubscribeSignature(link, SECRET)).toEqual(payload);
  });

  it('rejects a wrong secret, a changed kind and junk', () => {
    const link = signUnsubscribeToken(payload, SECRET);
    expect(verifyUnsubscribeSignature(link, 'other')).toBeNull();
    const [body, sig] = link.split('.');
    const edited = Buffer.from(
      Buffer.from(body as string, 'base64url')
        .toString()
        .replace('digest', 'all')
    ).toString('base64url');
    expect(verifyUnsubscribeSignature(`${edited}.${sig}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeSignature('junk', SECRET)).toBeNull();
    expect(verifyUnsubscribeSignature('', SECRET)).toBeNull();
  });

  it('maps each kind to the pref it turns off', () => {
    expect(unsubscribePatch('digest')).toEqual({ notifyDigest: false });
    expect(unsubscribePatch('reminders')).toEqual({ notifyReminder: false });
    expect(unsubscribePatch('all')).toEqual({ notifyEmail: false });
  });
});

describe('unsubscribeWithToken', () => {
  it('turns the pref off and rotates the token', async () => {
    user.getUser.mockResolvedValue({ id: 'u1', unsubscribeToken: payload.token });
    const link = signUnsubscribeToken({ ...payload, kind: 'all' }, SECRET);
    expect(await unsubscribeWithToken(link, SECRET)).toEqual({ kind: 'all' });
    expect(user.setNotifyPrefs).toHaveBeenCalledWith('u1', { notifyEmail: false });
    expect(user.rotateUnsubscribeToken).toHaveBeenCalledWith('u1');
  });

  it('refuses a used link, whose token has been rotated', async () => {
    user.getUser.mockResolvedValue({ id: 'u1', unsubscribeToken: 'rotated' });
    const link = signUnsubscribeToken(payload, SECRET);
    expect(await unsubscribeWithToken(link, SECRET)).toBeNull();
    expect(user.setNotifyPrefs).not.toHaveBeenCalled();
  });
});

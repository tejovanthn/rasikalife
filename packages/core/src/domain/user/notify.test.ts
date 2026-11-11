import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./entity')>();
  return {
    UserEntity: {
      create: (item: never) => actual.UserEntity.create(item),
      get: vi.fn(),
      patch: vi.fn(),
    },
  };
});

import {
  NOTIFY_DEFAULTS,
  dismissWhatsappPrompt,
  effectiveNotifyPrefs,
  getOrCreateUnsubscribeToken,
  removeWhatsapp,
  rotateUnsubscribeToken,
  setNotifyPrefs,
  setWhatsapp,
} from '.';
import { ErrorCode } from '../../constants';
import { UserEntity } from './entity';

function patchChain(result: unknown = { data: {} }) {
  const c = {
    set: vi.fn(() => c),
    remove: vi.fn(() => c),
    where: vi.fn(() => c),
    go: vi.fn().mockResolvedValue(result),
  };
  return c;
}

beforeEach(() => vi.clearAllMocks());

describe('notification defaults', () => {
  it('applies to a row written before the fields existed', () => {
    expect(effectiveNotifyPrefs({})).toEqual({
      notifyDigest: true,
      notifyReminder: true,
      notifyEmail: true,
      notifyPush: false,
    });
    expect(NOTIFY_DEFAULTS.notifyPush).toBe(false);
  });

  it('keeps what the user chose, including an explicit off', () => {
    expect(effectiveNotifyPrefs({ notifyEmail: false, notifyPush: true })).toMatchObject({
      notifyEmail: false,
      notifyPush: true,
      notifyDigest: true,
    });
  });

  it('is written at create for a new user, with a token', () => {
    const { Item } = UserEntity.create({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      googleId: 'g1',
    } as never).params() as { Item: Record<string, unknown> };

    expect(Item).toMatchObject({
      notifyDigest: true,
      notifyReminder: true,
      notifyEmail: true,
      notifyPush: false,
    });
    expect(String(Item.unsubscribeToken)).toMatch(/^[A-Za-z0-9_-]{32}$/);
    // No version bump: ElectroDB filters by version and would hide every existing user.
    expect(Item.__edb_v__).toBe('2');
  });

  it('writes only the preferences that were sent', async () => {
    const patch = patchChain({ data: { notifyPush: true } });
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);

    const prefs = await setNotifyPrefs('u1', { notifyPush: true });

    expect(patch.set).toHaveBeenCalledWith({ notifyPush: true });
    expect(prefs).toEqual({ ...NOTIFY_DEFAULTS, notifyPush: true });
  });
});

describe('unsubscribe token', () => {
  it('returns the stored token', async () => {
    vi.mocked(UserEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: { id: 'u1', unsubscribeToken: 'tok' } }),
    } as never);
    expect(await getOrCreateUnsubscribeToken('u1')).toBe('tok');
    expect(UserEntity.patch).not.toHaveBeenCalled();
  });

  it('creates one for an older row, only if none exists yet', async () => {
    vi.mocked(UserEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
    } as never);
    const patch = patchChain({ data: { unsubscribeToken: 'fresh' } });
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);

    expect(await getOrCreateUnsubscribeToken('u1')).toBe('fresh');
    expect(patch.where).toHaveBeenCalled();
  });

  it('rotates to a new random value', async () => {
    const patch = patchChain();
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);

    const a = await rotateUnsubscribeToken('u1');
    const b = await rotateUnsubscribeToken('u1');

    expect(a).not.toBe(b);
    expect(patch.set).toHaveBeenCalledWith({ unsubscribeToken: a });
  });
});

describe('WhatsApp number', () => {
  it('stores a valid number with consent and its text version, and clears verification', async () => {
    const patch = patchChain({ data: { whatsappNumber: '9876543210' } });
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);

    await setWhatsapp(
      'u1',
      { number: '9876543210', consent: true },
      new Date('2026-11-12T10:00:00Z')
    );

    expect(patch.set).toHaveBeenCalledWith({
      whatsappNumber: '9876543210',
      whatsappConsentAt: '2026-11-12T10:00:00.000Z',
      whatsappConsentVersion: 'whatsapp-v1',
    });
    expect(patch.remove).toHaveBeenCalledWith(['whatsappVerifiedAt']);
  });

  it.each(['12345', '5876543210', '98765432101', '+919876543210', 'abcdefghij'])(
    'refuses %s',
    async number => {
      await expect(setWhatsapp('u1', { number, consent: true })).rejects.toMatchObject({
        code: ErrorCode.WHATSAPP_INVALID_NUMBER,
      });
      expect(UserEntity.patch).not.toHaveBeenCalled();
    }
  );

  it('refuses a number without consent', async () => {
    await expect(setWhatsapp('u1', { number: '9876543210', consent: false })).rejects.toMatchObject(
      { code: ErrorCode.WHATSAPP_INVALID_NUMBER }
    );
  });

  it('removes with remove(), never set(undefined)', async () => {
    const patch = patchChain();
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);

    await removeWhatsapp('u1');

    expect(patch.remove).toHaveBeenCalledWith([
      'whatsappNumber',
      'whatsappConsentAt',
      'whatsappConsentVersion',
      'whatsappVerifiedAt',
    ]);
    expect(patch.set).not.toHaveBeenCalled();
  });

  it('remembers a dismissal', async () => {
    const patch = patchChain();
    vi.mocked(UserEntity.patch).mockReturnValue(patch as never);
    await dismissWhatsappPrompt('u1', new Date('2026-11-12T10:00:00Z'));
    expect(patch.set).toHaveBeenCalledWith({
      whatsappPromptDismissedAt: '2026-11-12T10:00:00.000Z',
    });
  });
});

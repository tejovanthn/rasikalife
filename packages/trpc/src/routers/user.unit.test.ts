import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = vi.hoisted(() => ({
  listAllUsers: vi.fn(),
  getUser: vi.fn(),
  updateUserRole: vi.fn(),
  recordAdminUserView: vi.fn(),
}));

vi.mock('@rasika/core', async importOriginal => {
  const core = await importOriginal<typeof import('@rasika/core')>();
  return { ...core, User: { ...core.User, ...user } };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));

import { userRouter } from './user';

const stored = {
  id: 'u2',
  name: 'Asha',
  email: 'a@x.com',
  role: 'editor',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastSignedInAt: '2026-11-01T00:00:00.000Z',
  unsubscribeToken: 'SECRET-TOKEN',
  whatsappNumber: '9845012345',
  whatsappVerifiedAt: '2026-11-02T00:00:00.000Z',
  homeLocation: { lat: 1, lng: 2 },
};

const admin = userRouter.createCaller({
  event: {} as never,
  user: { id: 'admin1', role: 'admin', unsubscribeToken: 'MY-TOKEN' } as never,
});
const editor = userRouter.createCaller({
  event: {} as never,
  user: { id: 'u1', role: 'editor' } as never,
});

beforeEach(() => {
  for (const fn of Object.values(user)) fn.mockReset();
});

describe('user router never returns the unsubscribe token', () => {
  it('me drops it', async () => {
    expect(JSON.stringify(await admin.me())).not.toContain('MY-TOKEN');
    expect(await admin.me()).not.toHaveProperty('unsubscribeToken');
  });

  it('list is an explicit shape with the number masked', async () => {
    user.listAllUsers.mockResolvedValue([stored]);
    const rows = await admin.list();
    const text = JSON.stringify(rows);
    expect(text).not.toContain('SECRET-TOKEN');
    expect(text).not.toContain('9845012345');
    expect(text).not.toContain('homeLocation');
    expect(rows[0]).toMatchObject({ id: 'u2', whatsappMasked: '+91 ••••• •2345' });
  });

  it('updateRole returns the safe row', async () => {
    user.updateUserRole.mockResolvedValue(stored);
    expect(JSON.stringify(await admin.updateRole({ userId: 'u2', role: 'editor' }))).not.toContain(
      'SECRET-TOKEN'
    );
  });
});

describe('user.adminDetail', () => {
  it('is for admins only', async () => {
    await expect(editor.adminDetail({ userId: 'u2' })).rejects.toBeTruthy();
    expect(user.recordAdminUserView).not.toHaveBeenCalled();
  });

  it('returns the full number, writes the audit row first, and still hides the token', async () => {
    user.getUser.mockResolvedValue(stored);
    user.recordAdminUserView.mockResolvedValue(undefined);
    const detail = await admin.adminDetail({ userId: 'u2' });
    expect(user.recordAdminUserView).toHaveBeenCalledWith('admin1', 'u2');
    expect(detail.whatsappNumber).toBe('9845012345');
    expect(JSON.stringify(detail)).not.toContain('SECRET-TOKEN');
  });

  it('serves nothing when the audit row cannot be written', async () => {
    user.getUser.mockResolvedValue(stored);
    user.recordAdminUserView.mockRejectedValue(new Error('db down'));
    await expect(admin.adminDetail({ userId: 'u2' })).rejects.toThrow();
  });
});

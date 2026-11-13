import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  PartnerMemberEntity: { get: vi.fn(), delete: vi.fn() },
}));

import { revokeViewerMember } from '.';
import { ErrorCode } from '../../constants';
import { PartnerMemberEntity } from './entity';

const row = (userId: string, role: 'owner' | 'viewer', targetId = 't1') => ({
  userId,
  targetType: 'organiser' as const,
  targetId,
  targetName: 'Sabha',
  role,
  invitedBy: 'mod',
  createdAt: '2026-11-01T00:00:00.000Z',
});

/** A tiny table keyed by target and user, behind the mocked entity. */
function useTable(rows: ReturnType<typeof row>[]) {
  const table = new Map(rows.map(r => [`${r.targetId}|${r.userId}`, r]));
  vi.mocked(PartnerMemberEntity.get).mockImplementation(((k: {
    targetId: string;
    userId: string;
  }) => ({
    go: vi.fn().mockResolvedValue({ data: table.get(`${k.targetId}|${k.userId}`) }),
  })) as never);
  vi.mocked(PartnerMemberEntity.delete).mockImplementation(((k: {
    targetId: string;
    userId: string;
  }) => ({
    go: vi.fn().mockImplementation(async () => {
      table.delete(`${k.targetId}|${k.userId}`);
      return {};
    }),
  })) as never);
  return table;
}

beforeEach(() => vi.clearAllMocks());

describe('revokeViewerMember', () => {
  it('removes a viewer of this target', async () => {
    const table = useTable([row('o1', 'owner'), row('v1', 'viewer')]);
    expect(await revokeViewerMember('o1', 'v1', 'organiser', 't1')).toBe(true);
    expect(table.has('t1|v1')).toBe(false);
  });

  it('refuses an owner and the caller themselves', async () => {
    const table = useTable([row('o1', 'owner'), row('o2', 'owner')]);
    await expect(revokeViewerMember('o1', 'o2', 'organiser', 't1')).rejects.toMatchObject({
      code: ErrorCode.PARTNER_FORBIDDEN,
    });
    await expect(revokeViewerMember('o1', 'o1', 'organiser', 't1')).rejects.toMatchObject({
      code: ErrorCode.PARTNER_FORBIDDEN,
    });
    expect(table.size).toBe(2);
  });

  it('does not reach a member of another target', async () => {
    const table = useTable([row('v1', 'viewer', 'other')]);
    expect(await revokeViewerMember('o1', 'v1', 'organiser', 't1')).toBe(false);
    expect(table.has('other|v1')).toBe(true);
  });
});

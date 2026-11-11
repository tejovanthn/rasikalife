import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  PartnerMemberEntity: {
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byUser: vi.fn() },
  },
}));

import {
  addPartnerMember,
  deleteUserPartnerMemberships,
  hasPartnerRole,
  movePartnerMembers,
  requirePartnerRole,
  revokePartnerMember,
} from '.';
import { ErrorCode } from '../../constants';
import { PartnerMemberEntity } from './entity';

const go = (data: unknown) => ({ go: vi.fn().mockResolvedValue({ data }) });
const member = (userId: string, role: 'owner' | 'viewer', targetId = 't1') => ({
  userId,
  targetType: 'organiser' as const,
  targetId,
  targetName: 'Sabha',
  role,
  invitedBy: 'mod',
  createdAt: '2026-11-01T00:00:00.000Z',
});

/** A tiny table keyed by target and user, behind the mocked entity. */
function useTable(rows: ReturnType<typeof member>[]) {
  const table = new Map(rows.map(r => [`${r.targetId}|${r.userId}`, r]));
  vi.mocked(PartnerMemberEntity.get).mockImplementation(((k: {
    targetId: string;
    userId: string;
  }) => go(table.get(`${k.targetId}|${k.userId}`))) as never);
  vi.mocked(PartnerMemberEntity.put).mockImplementation(((row: ReturnType<typeof member>) => ({
    go: vi.fn().mockImplementation(async () => {
      table.set(`${row.targetId}|${row.userId}`, row);
      return { data: row };
    }),
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
  vi.mocked(PartnerMemberEntity.query.primary).mockImplementation((({
    targetId,
  }: {
    targetId: string;
  }) => go([...table.values()].filter(r => r.targetId === targetId))) as never);
  vi.mocked(PartnerMemberEntity.query.byUser).mockImplementation((({
    userId,
  }: {
    userId: string;
  }) => go([...table.values()].filter(r => r.userId === userId))) as never);
  return table;
}

beforeEach(() => vi.clearAllMocks());

describe('addPartnerMember', () => {
  it('stores a grant', async () => {
    const table = useTable([]);
    await addPartnerMember({
      userId: 'u1',
      targetType: 'organiser',
      targetId: 't1',
      targetName: 'Sabha',
      role: 'viewer',
      invitedBy: 'mod',
    });
    expect(table.get('t1|u1')?.role).toBe('viewer');
  });

  it('never downgrades an owner through a later viewer invite', async () => {
    const table = useTable([member('u1', 'owner')]);
    await addPartnerMember({
      userId: 'u1',
      targetType: 'organiser',
      targetId: 't1',
      targetName: 'Sabha',
      role: 'viewer',
      invitedBy: 'mod',
    });
    expect(table.get('t1|u1')?.role).toBe('owner');
    expect(PartnerMemberEntity.put).not.toHaveBeenCalled();
  });

  it('upgrades a viewer to owner', async () => {
    const table = useTable([member('u1', 'viewer')]);
    await addPartnerMember({
      userId: 'u1',
      targetType: 'organiser',
      targetId: 't1',
      targetName: 'Sabha',
      role: 'owner',
      invitedBy: 'mod',
    });
    expect(table.get('t1|u1')?.role).toBe('owner');
  });
});

describe('membership checks', () => {
  it('lets a viewer see and an owner act', async () => {
    useTable([member('viewer1', 'viewer'), member('owner1', 'owner')]);

    expect(await requirePartnerRole('viewer1', 'organiser', 't1')).toBe('viewer');
    expect(await requirePartnerRole('owner1', 'organiser', 't1', 'owner')).toBe('owner');
    expect(await hasPartnerRole('viewer1', 'organiser', 't1', 'owner')).toBe(false);
    expect(await hasPartnerRole('owner1', 'organiser', 't1', 'viewer')).toBe(true);
  });

  it('refuses a stranger, and a viewer asking for an owner action', async () => {
    useTable([member('viewer1', 'viewer')]);

    await expect(requirePartnerRole('stranger', 'organiser', 't1')).rejects.toMatchObject({
      code: ErrorCode.PARTNER_FORBIDDEN,
    });
    await expect(requirePartnerRole('viewer1', 'organiser', 't1', 'owner')).rejects.toMatchObject({
      code: ErrorCode.PARTNER_FORBIDDEN,
    });
    expect(await hasPartnerRole('stranger', 'organiser', 't1')).toBe(false);
  });

  it('does not carry a grant from one target to another', async () => {
    useTable([member('u1', 'owner', 't1')]);
    expect(await hasPartnerRole('u1', 'organiser', 't2')).toBe(false);
  });
});

describe('revokePartnerMember', () => {
  it('removes a grant and reports whether there was one', async () => {
    const table = useTable([member('u1', 'viewer')]);
    expect(await revokePartnerMember('u1', 'organiser', 't1')).toBe(true);
    expect(table.size).toBe(0);
    expect(await revokePartnerMember('u1', 'organiser', 't1')).toBe(false);
  });
});

describe('movePartnerMembers', () => {
  it('moves grants to the canonical target and clears the loser', async () => {
    const table = useTable([member('u1', 'owner', 'loser'), member('u2', 'viewer', 'loser')]);

    const moved = await movePartnerMembers('organiser', 'loser', 'canon', 'Canon Sabha');

    expect(moved).toBe(2);
    expect(table.get('canon|u1')).toMatchObject({ role: 'owner', targetName: 'Canon Sabha' });
    expect(table.get('canon|u2')?.role).toBe('viewer');
    expect([...table.keys()].filter(k => k.startsWith('loser|'))).toEqual([]);
  });

  it('keeps the higher role where a user holds both', async () => {
    const table = useTable([
      member('u1', 'viewer', 'loser'),
      member('u1', 'owner', 'canon'),
      member('u2', 'owner', 'loser'),
      member('u2', 'viewer', 'canon'),
    ]);

    await movePartnerMembers('organiser', 'loser', 'canon', 'Canon');

    expect(table.get('canon|u1')?.role).toBe('owner');
    expect(table.get('canon|u2')?.role).toBe('owner');
  });
});

describe('deleteUserPartnerMemberships', () => {
  it('removes every grant the user holds, and nobody elses', async () => {
    const table = useTable([
      member('u1', 'owner', 't1'),
      member('u1', 'viewer', 't2'),
      member('u2', 'owner', 't1'),
    ]);

    expect(await deleteUserPartnerMemberships('u1')).toBe(2);
    expect([...table.keys()]).toEqual(['t1|u2']);
  });
});

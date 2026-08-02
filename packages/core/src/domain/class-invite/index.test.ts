import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassInviteEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn() },
  },
}));

import {
  CreateClassInviteSchema,
  createClassInvite,
  listUnclaimedInvites,
  markInviteClaimed,
  normalizeInviteEmail,
} from '.';
import { ClassInviteEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

/**
 * Gurus type `Priya.Raman@gmail.com`; students sign in as `priyaraman@gmail.com`. Without
 * this the invite sits unclaimed and the student opens an empty app, which reads as the
 * product being broken rather than as a typo.
 */
describe('normalizeInviteEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeInviteEmail('  Priya@Example.COM ')).toBe('priya@example.com');
  });

  it('strips dots and tags for gmail', () => {
    expect(normalizeInviteEmail('Priya.Raman@gmail.com')).toBe('priyaraman@gmail.com');
    expect(normalizeInviteEmail('priya.raman+classes@gmail.com')).toBe('priyaraman@gmail.com');
    expect(normalizeInviteEmail('p.r.i.y.a@googlemail.com')).toBe('priya@googlemail.com');
  });

  /**
   * Dots are significant at most other providers. Stripping them there would match an invite
   * to the wrong person — a worse failure than an unclaimed invite, because it hands one
   * family's session notes to another.
   */
  it('leaves dots alone everywhere else', () => {
    expect(normalizeInviteEmail('priya.raman@outlook.com')).toBe('priya.raman@outlook.com');
    expect(normalizeInviteEmail('priya.raman@rasika.life')).toBe('priya.raman@rasika.life');
  });

  it('does not fall over on something that is not an address', () => {
    expect(normalizeInviteEmail('nonsense')).toBe('nonsense');
    expect(normalizeInviteEmail('@gmail.com')).toBe('@gmail.com');
  });
});

describe('createClassInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the normalized address as the key and keeps what the guru typed', async () => {
    vi.mocked(ClassInviteEntity.create).mockReturnValue(goResolves({}) as never);

    await createClassInvite({
      email: 'Priya.Raman+classes@gmail.com',
      institutionId: 'inst1',
      learnerName: 'Anika',
      relation: 'guardian',
      invitedBy: 'user9',
    });

    expect(ClassInviteEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEmail: 'priyaraman@gmail.com',
        rawEmail: 'Priya.Raman+classes@gmail.com',
      })
    );
  });
});

describe('listUnclaimedInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes before looking up, and drops the claimed ones', async () => {
    vi.mocked(ClassInviteEntity.query.primary).mockReturnValue(
      goResolves([{ id: 'a', claimedAt: '2026-08-01T00:00:00.000Z' }, { id: 'b' }]) as never
    );

    const result = await listUnclaimedInvites('Priya.Raman@gmail.com');

    expect(ClassInviteEntity.query.primary).toHaveBeenCalledWith({
      normalizedEmail: 'priyaraman@gmail.com',
    });
    expect(result.map(i => i.id)).toEqual(['b']);
  });
});

describe('markInviteClaimed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks it claimed', async () => {
    const chain: Record<string, unknown> = { go: vi.fn().mockResolvedValue({ data: { id: 'a' } }) };
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    vi.mocked(ClassInviteEntity.patch).mockReturnValue(chain as never);

    const result = await markInviteClaimed('priyaraman@gmail.com', 'a', 'user1');

    expect(result).toEqual({ id: 'a' });
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ claimedByUserId: 'user1' }));
    expect(chain.where).toHaveBeenCalled();
  });

  /**
   * The claim runs on every sign-in, so two tabs opening at once both find the same unclaimed
   * invite. Without the condition, both create an access row and — for a `learnerName` invite
   * — two learners with the same name, two enrollments and two balances.
   */
  it('returns null when another tab claimed it first', async () => {
    const chain: Record<string, unknown> = {
      go: vi.fn().mockRejectedValue(new Error('ConditionalCheckFailed')),
    };
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    vi.mocked(ClassInviteEntity.patch).mockReturnValue(chain as never);

    expect(await markInviteClaimed('priyaraman@gmail.com', 'a', 'user1')).toBeNull();
  });

  it('lets an unrelated failure through', async () => {
    const chain: Record<string, unknown> = {
      go: vi.fn().mockRejectedValue(new Error('ThrottlingException')),
    };
    chain.set = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    vi.mocked(ClassInviteEntity.patch).mockReturnValue(chain as never);

    await expect(markInviteClaimed('priyaraman@gmail.com', 'a', 'user1')).rejects.toThrow(
      'ThrottlingException'
    );
  });
});

describe('CreateClassInviteSchema', () => {
  const base = {
    email: 'priya@gmail.com',
    institutionId: 'inst1',
    relation: 'guardian' as const,
    invitedBy: 'user9',
  };

  it('accepts an invite that names a new learner', () => {
    expect(() => CreateClassInviteSchema.parse({ ...base, learnerName: 'Anika' })).not.toThrow();
  });

  // The young-adult case, and the second-guardian case: claiming adds an access row to the
  // learner that already exists rather than creating a second one.
  it('accepts an invite that points at an existing learner', () => {
    expect(() =>
      CreateClassInviteSchema.parse({ ...base, learnerId: 'learn1', relation: 'self' })
    ).not.toThrow();
  });

  it('rejects an invite that does both, or neither', () => {
    expect(() =>
      CreateClassInviteSchema.parse({ ...base, learnerId: 'learn1', learnerName: 'Anika' })
    ).toThrow();
    expect(() => CreateClassInviteSchema.parse(base)).toThrow();
  });

  it('rejects a malformed address', () => {
    expect(() =>
      CreateClassInviteSchema.parse({ ...base, email: 'nonsense', learnerName: 'Anika' })
    ).toThrow();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ArtistMembershipEntity: {
    create: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byMember: vi.fn() },
  },
}));

import {
  AddArtistMembershipSchema,
  addArtistMembership,
  getGroupMembers,
  getMemberGroups,
  removeArtistMembership,
} from '.';
import { ArtistMembershipEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const validInput = {
  groupId: 'artist-group-1',
  groupName: 'Saralaya Sisters',
  memberId: 'artist-member-1',
  memberName: 'Kavita Saralaya',
};

describe('artist-membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addArtistMembership', () => {
    it('creates the membership link with both denormalized names', async () => {
      vi.mocked(ArtistMembershipEntity.create).mockReturnValue(goResolves(validInput) as never);

      const result = await addArtistMembership(validInput);

      expect(ArtistMembershipEntity.create).toHaveBeenCalledWith(validInput);
      expect(result).toEqual(validInput);
      expect(result.groupName).toBe('Saralaya Sisters');
      expect(result.memberName).toBe('Kavita Saralaya');
    });
  });

  describe('removeArtistMembership', () => {
    it('deletes the membership link by composite key', async () => {
      vi.mocked(ArtistMembershipEntity.delete).mockReturnValue(goResolves(undefined) as never);

      await removeArtistMembership('artist-group-1', 'artist-member-1');

      expect(ArtistMembershipEntity.delete).toHaveBeenCalledWith({
        groupId: 'artist-group-1',
        memberId: 'artist-member-1',
      });
    });
  });

  describe('getGroupMembers', () => {
    it('queries the primary index by groupId', async () => {
      vi.mocked(ArtistMembershipEntity.query.primary).mockReturnValue(goResolves([]) as never);

      await getGroupMembers('artist-group-1');

      expect(ArtistMembershipEntity.query.primary).toHaveBeenCalledWith({
        groupId: 'artist-group-1',
      });
    });

    it('sorts by rank ascending, treating missing rank as last', async () => {
      vi.mocked(ArtistMembershipEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, memberId: 'm2', memberName: 'Zubin', rank: undefined },
          { ...validInput, memberId: 'm1', memberName: 'Amit', rank: 2 },
          { ...validInput, memberId: 'm3', memberName: 'Bala', rank: 1 },
        ]) as never
      );

      const result = await getGroupMembers('artist-group-1');

      expect(result.map(m => m.memberId)).toEqual(['m3', 'm1', 'm2']);
    });

    it('breaks ties (including among rows with no rank) by memberName', async () => {
      vi.mocked(ArtistMembershipEntity.query.primary).mockReturnValue(
        goResolves([
          { ...validInput, memberId: 'm2', memberName: 'Triveni', rank: undefined },
          { ...validInput, memberId: 'm1', memberName: 'Kavita', rank: undefined },
        ]) as never
      );

      const result = await getGroupMembers('artist-group-1');

      expect(result.map(m => m.memberId)).toEqual(['m1', 'm2']);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ArtistMembershipEntity.query.primary).mockReturnValue(
        goResolves(undefined) as never
      );

      expect(await getGroupMembers('artist-group-1')).toEqual([]);
    });
  });

  describe('getMemberGroups', () => {
    it('queries the byMember GSI', async () => {
      const mockItems = [
        { ...validInput, groupId: 'g1', groupName: 'Saralaya Sisters' },
        { ...validInput, groupId: 'g2', groupName: 'Ganesh Kumaresh' },
      ];
      vi.mocked(ArtistMembershipEntity.query.byMember).mockReturnValue(
        goResolves(mockItems) as never
      );

      const result = await getMemberGroups('artist-member-1');

      expect(ArtistMembershipEntity.query.byMember).toHaveBeenCalledWith({
        memberId: 'artist-member-1',
      });
      expect(result).toEqual(mockItems);
    });

    it('returns an empty array when there is no data', async () => {
      vi.mocked(ArtistMembershipEntity.query.byMember).mockReturnValue(
        goResolves(undefined) as never
      );

      expect(await getMemberGroups('artist-member-1')).toEqual([]);
    });
  });

  describe('AddArtistMembershipSchema', () => {
    it('accepts valid input', () => {
      expect(() => AddArtistMembershipSchema.parse(validInput)).not.toThrow();
    });

    it('accepts optional role and rank', () => {
      expect(() =>
        AddArtistMembershipSchema.parse({ ...validInput, role: 'vocal', rank: 1 })
      ).not.toThrow();
    });

    it('rejects a missing required field', () => {
      const { groupId, ...rest } = validInput;
      expect(() => AddArtistMembershipSchema.parse(rest)).toThrow();
    });

    it('rejects a non-positive rank', () => {
      expect(() => AddArtistMembershipSchema.parse({ ...validInput, rank: 0 })).toThrow();
    });
  });
});

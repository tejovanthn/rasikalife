import type { z } from 'zod';
import { ArtistMembershipEntity } from './entity';
import type { ArtistMembership } from './entity';
import type { AddArtistMembershipSchema } from './schema';

export type AddArtistMembershipInput = z.infer<typeof AddArtistMembershipSchema>;

export async function addArtistMembership(
  input: AddArtistMembershipInput
): Promise<ArtistMembership> {
  const result = await ArtistMembershipEntity.create(input).go();
  return result.data as ArtistMembership;
}

export async function removeArtistMembership(groupId: string, memberId: string): Promise<void> {
  await ArtistMembershipEntity.delete({ groupId, memberId }).go();
}

export async function getGroupMembers(groupId: string): Promise<ArtistMembership[]> {
  const result = await ArtistMembershipEntity.query.primary({ groupId }).go({ pages: 'all' });
  const items = result.data || [];
  return items.sort((a, b) => {
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.memberName.localeCompare(b.memberName);
  });
}

export async function getMemberGroups(memberId: string): Promise<ArtistMembership[]> {
  const result = await ArtistMembershipEntity.query.byMember({ memberId }).go({ pages: 'all' });
  return result.data || [];
}

export type { ArtistMembership } from './entity';
export { AddArtistMembershipSchema } from './schema';

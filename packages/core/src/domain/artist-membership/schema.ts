import { z } from 'zod';

export const AddArtistMembershipSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string().min(1).max(200),
  memberId: z.string().min(1),
  memberName: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  rank: z.number().int().min(1).optional(),
});

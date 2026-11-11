import { PartnerMember } from '@rasika/core';
import { checkPartnerAccess } from './partner-access';
import type { PartnerAccessRole, PartnerNeeds } from './partner-access';

/**
 * For routes whose input names a venue (`qr.statsByVenue`, `space.*`) and not a
 * `targetType`/`targetId` pair, so `partnerProcedure` cannot read it. The caller must be a
 * moderator, or a member of that venue with the role the action needs.
 */
export function requireVenueAccess(
  user: { id: string; role?: string | null },
  venueId: string,
  needs: PartnerNeeds = 'viewer'
): Promise<PartnerAccessRole> {
  return checkPartnerAccess(
    { user, targetType: 'venue', targetId: venueId, needs },
    (userId, type, id) => PartnerMember.getPartnerMember(userId, type, id)
  );
}

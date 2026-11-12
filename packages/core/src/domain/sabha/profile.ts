import { z } from 'zod';
import { ApplicationError, ErrorCode } from '../../constants';
import { httpUrlSchema } from '../../shared/http-url';
import { computeDiff, createChangeHistory } from '../change-history/service';
import { OrganiserEntity } from '../organiser/entity';
import { UpdateOrganiserSchema } from '../organiser/schema';
import { PartnerTargetTypeSchema } from '../partner-member/schema';
import type { PartnerTargetType } from '../partner-member/schema';
import { UpdateVenueSchema } from '../venue/schema';
import { getPartnerTarget } from './dashboard';
import { changedProfileFields } from './rules';

/**
 * What an owner may change on the organiser's own page. The organiser's `venueId` and
 * `venueName` are left out: they decide which venue's QR numbers an organiser dashboard shows,
 * so an owner must not be able to point them at somebody else's hall. `.strict()` makes a field
 * outside the list a refusal and not a silent drop.
 */
export const PartnerOrganiserProfileSchema = UpdateOrganiserSchema.omit({
  venueId: true,
  venueName: true,
})
  .extend({
    // A `javascript:` URL passes `z.string().url()` and would run from the public page's link.
    website: httpUrlSchema.optional(),
    logoUrl: httpUrlSchema.optional(),
  })
  .strict();

export const PartnerVenueProfileSchema = UpdateVenueSchema.extend({
  website: httpUrlSchema.optional(),
  photoUrl: httpUrlSchema.optional(),
  mapLink: httpUrlSchema.optional(),
}).strict();

/** `input` is checked against the schema for `targetType` inside `updatePartnerProfile`. */
export const UpdatePartnerProfileSchema = z.object({
  targetType: PartnerTargetTypeSchema,
  targetId: z.string(),
  input: z.record(z.string(), z.unknown()),
});

const COMMENT = 'Edited by a verified owner in the sabha dashboard';

/**
 * A verified owner's edit of their organiser or venue.
 *
 * Authorisation (the caller is an owner of this target) is the router's job; this checks that
 * the target is verified, since "verified owners edit" is the rule. Only fields that really
 * changed are written, so a save that changes nothing writes nothing and leaves no history row.
 * Each real save writes one `ChangeHistory` entry (`computeDiff` over the changed fields) so a
 * moderator can see and undo it.
 */
export async function updatePartnerProfile(input: {
  targetType: PartnerTargetType;
  targetId: string;
  userId: string;
  changes: Record<string, unknown>;
}): Promise<{ changed: string[] }> {
  const { targetType, targetId, userId } = input;
  const target = await getPartnerTarget(targetType, targetId);
  if (!target) {
    throw new ApplicationError(
      targetType === 'venue' ? ErrorCode.VENUE_NOT_FOUND : ErrorCode.ORGANISER_NOT_FOUND,
      `${targetType} ${targetId} not found`
    );
  }
  if (!target.verifiedAt) {
    throw new ApplicationError(
      ErrorCode.PARTNER_FORBIDDEN,
      `${targetType} ${targetId} is not verified yet`
    );
  }

  const parsed = (
    targetType === 'organiser' ? PartnerOrganiserProfileSchema : PartnerVenueProfileSchema
  ).safeParse(input.changes);
  if (!parsed.success) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    );
  }

  const { before, after } = changedProfileFields(
    target as unknown as Record<string, unknown>,
    parsed.data as Record<string, unknown>
  );
  const changed = Object.keys(after);
  if (changed.length === 0) return { changed };

  // Dynamic import: `organiser/index` and `venue/index` pull in the cascades.
  if (targetType === 'organiser') {
    const { updateOrganiser } = await import('../organiser');
    await updateOrganiser(targetId, after as never);
  } else {
    const { updateVenue } = await import('../venue');
    await updateVenue(targetId, after as never);
  }

  const diff = await computeDiff(before, after);
  await createChangeHistory({
    entityType: targetType,
    entityId: targetId,
    userId,
    action: 'update',
    diff: diff as unknown as Record<string, unknown>,
    comment: COMMENT,
  });
  return { changed };
}

/**
 * Moderators only (the router enforces it): turns per-organiser review of owner events on or
 * off. With it on, an owner's new events wait for a moderator instead of publishing at once.
 * Off is stored as `false`, not removed, so a moderator's choice is visible on the record.
 */
export async function setOrganiserEventReview(
  organiserId: string,
  require: boolean
): Promise<{ requireEventReview: boolean }> {
  const target = await getPartnerTarget('organiser', organiserId);
  if (!target) {
    throw new ApplicationError(ErrorCode.ORGANISER_NOT_FOUND, `Organiser ${organiserId} not found`);
  }
  await OrganiserEntity.patch({ id: organiserId }).set({ requireEventReview: require }).go();
  return { requireEventReview: require };
}

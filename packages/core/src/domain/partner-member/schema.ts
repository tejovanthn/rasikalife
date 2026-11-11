import { z } from 'zod';
import { ErrorCode } from '../../constants';

export const PARTNER_TARGET_TYPES = ['organiser', 'venue'] as const;
export const PARTNER_ROLES = ['owner', 'viewer'] as const;

export type PartnerTargetType = (typeof PARTNER_TARGET_TYPES)[number];
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const PartnerTargetTypeSchema = z.enum(PARTNER_TARGET_TYPES);
export const PartnerRoleSchema = z.enum(PARTNER_ROLES);

export const PARTNER_ERROR_CODES = {
  PARTNER_FORBIDDEN: ErrorCode.PARTNER_FORBIDDEN,
  PARTNER_INVITE_EXPIRED: ErrorCode.PARTNER_INVITE_EXPIRED,
  PARTNER_INVITE_EMAIL_MISMATCH: ErrorCode.PARTNER_INVITE_EMAIL_MISMATCH,
} as const;

export const InvitePartnerSchema = z.object({
  targetType: PartnerTargetTypeSchema,
  targetId: z.string(),
  email: z.string().email(),
  role: PartnerRoleSchema,
});

export const RevokePartnerSchema = z.object({
  targetType: PartnerTargetTypeSchema,
  targetId: z.string(),
  userId: z.string(),
});

export const ExportFollowersSchema = z.object({
  targetType: PartnerTargetTypeSchema,
  targetId: z.string(),
});
// `partner.updateProfile` takes UpdateOrganiserSchema | UpdateVenueSchema; the router composes
// that from the organiser and venue domains, so it is not repeated here.

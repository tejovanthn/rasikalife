import { z } from 'zod';
import { ErrorCode } from '../../constants';
import { QrCodeSchema } from '../venue-qr/schema';

export const FOLLOW_TARGET_TYPES = ['venue', 'organiser', 'artist'] as const;
export const SHARE_TARGET_TYPES = ['venue', 'organiser'] as const;
export const FOLLOW_SOURCES = ['qr', 'web'] as const;

export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];
export type ShareTargetType = (typeof SHARE_TARGET_TYPES)[number];
export type FollowSource = (typeof FOLLOW_SOURCES)[number];

export const FollowTargetTypeSchema = z.enum(FOLLOW_TARGET_TYPES);
export const ShareTargetTypeSchema = z.enum(SHARE_TARGET_TYPES);

export const FOLLOW_ERROR_CODES = {
  FOLLOW_TARGET_NOT_FOUND: ErrorCode.FOLLOW_TARGET_NOT_FOUND,
  FOLLOW_SHARE_NOT_ALLOWED: ErrorCode.FOLLOW_SHARE_NOT_ALLOWED,
} as const;

/** Only a venue or an organiser can receive a shared name and email. */
export function canShareWith(type: FollowTargetType): type is ShareTargetType {
  return type === 'venue' || type === 'organiser';
}

export const BulkSetFollowSchema = z.object({
  qrCode: QrCodeSchema.optional(),
  eventId: z.string().optional(),
  targets: z
    .array(
      z.object({
        type: FollowTargetTypeSchema,
        id: z.string(),
        follow: z.boolean(),
        // Only valid for venue and organiser; refused for artist by the operation.
        share: z.boolean().optional(),
      })
    )
    .min(1)
    .max(20),
});

export const ToggleFollowSchema = z.object({ type: FollowTargetTypeSchema, id: z.string() });

export const FollowStatusSchema = z.object({
  targets: z.array(z.object({ type: FollowTargetTypeSchema, id: z.string() })).max(50),
});

export const SetShareSchema = z.object({
  type: ShareTargetTypeSchema,
  id: z.string(),
  share: z.boolean(),
});

export type BulkSetFollowInput = z.infer<typeof BulkSetFollowSchema>;

import { z } from 'zod';
import { ACCESS_RELATIONS } from '../class-learner-access/schema';

/**
 * Gmail treats `Priya.Raman+classes@gmail.com` and `priyaraman@gmail.com` as the same mailbox.
 * Gurus type the first; students sign in as the second. Without this the invite sits unclaimed
 * and the student sees an empty app, which reads as the product being broken.
 *
 * Only Gmail. Dots are significant at most other providers, and stripping them there would
 * match an invite to the wrong person — a worse failure than an unclaimed invite, because it
 * hands one family's session notes to another.
 */
const DOT_STRIPPING_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function normalizeInviteEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) {
    return trimmed;
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  if (!DOT_STRIPPING_DOMAINS.has(domain)) {
    return `${local}@${domain}`;
  }

  const withoutTag = local.split('+')[0] ?? '';
  return `${withoutTag.replaceAll('.', '')}@${domain}`;
}

export const CreateClassInviteSchema = z
  .object({
    email: z.string().email().max(254),
    institutionId: z.string().min(1),
    programId: z.string().min(1).optional(),
    // Set when the invite adds an account to an **existing** learner — the young-adult case,
    // and the second guardian case.
    learnerId: z.string().min(1).optional(),
    // Set when claiming the invite should create the learner. Exactly one of these two.
    learnerName: z.string().min(1).max(80).optional(),
    relation: z.enum(ACCESS_RELATIONS),
    invitedBy: z.string().min(1),
  })
  .refine(input => Boolean(input.learnerId) !== Boolean(input.learnerName), {
    message: 'An invite either names a new learner or points at an existing one, not both',
    path: ['learnerName'],
  });

export type CreateClassInviteInput = z.infer<typeof CreateClassInviteSchema>;

import { CHANGE_ENTITY_TYPE } from '../change-history/types';
import type { User } from './entity';

/**
 * What an API may say about a user record. `unsubscribeToken` is a bearer secret (anyone with it
 * can sign a valid unsubscribe link for that user), so it never leaves the server in a response;
 * only the unsubscribe flow reads it. WhatsApp numbers are masked in lists, and shown in full
 * only on the admin detail call, which writes an audit row.
 */

/** `9845012345` becomes `+91 ••••• •2345`. A value that is not 10 digits shows only dots. */
export function maskWhatsapp(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return '+91 ••••• ••••';
  return `+91 ••••• •${digits.slice(-4)}`;
}

/** The record with secrets removed. For a signed-in user's own `user.me`. */
export function withoutSecrets<T extends { unsubscribeToken?: unknown }>(
  user: T
): Omit<T, 'unsubscribeToken'> {
  const { unsubscribeToken: _token, ...rest } = user;
  return rest;
}

/** One row of the admin user list. An explicit shape: nothing is passed through by default. */
export function toAdminListRow(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
    createdAt: user.createdAt,
    lastSignedInAt: user.lastSignedInAt,
    whatsappMasked: maskWhatsapp(user.whatsappNumber),
    whatsappVerified: Boolean(user.whatsappVerifiedAt),
  };
}

/** The admin detail view: the list row plus the full WhatsApp number. */
export function toAdminDetail(user: User) {
  return { ...toAdminListRow(user), whatsappNumber: user.whatsappNumber ?? null };
}

/**
 * Audit store: the existing `ChangeHistory` entity (`entityType: 'user'`, `action: 'view'`,
 * the viewing admin as `userId`). Written before the number is returned, so a view that cannot
 * be recorded is not served.
 */
export async function recordAdminUserView(adminId: string, viewedUserId: string): Promise<void> {
  const { createChangeHistory } = await import('../change-history/service');
  await createChangeHistory({
    entityType: CHANGE_ENTITY_TYPE.USER,
    entityId: viewedUserId,
    userId: adminId,
    action: 'view',
    diff: {},
    comment: 'Admin viewed the full WhatsApp number',
  });
}

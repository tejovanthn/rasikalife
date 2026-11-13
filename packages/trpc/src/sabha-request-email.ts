import { Email } from '@rasika/core';
import type { SabhaRequest } from '@rasika/core/shared/sabha-request';
import { sabhaRequestEmail } from '@rasika/email';

const SITE_URL = process.env.SITE_URL || 'https://rasika.life';

/** Where requests go. Set by infra; the default is the team's own mailbox. */
export function sabhaRequestRecipient(env: { SABHA_REQUEST_TO?: string } = process.env): string {
  return env.SABHA_REQUEST_TO?.trim() || 'hello@rasika.life';
}

/**
 * Sends one request to the team from the transactional identity, like the approval email.
 * Returns `false` on a failure (logged) so the router can tell the visitor to try again.
 */
export async function sendSabhaRequestEmail(request: SabhaRequest): Promise<boolean> {
  try {
    const content = await sabhaRequestEmail({ ...request, siteUrl: SITE_URL });
    await Email.sendTransactional({
      to: sabhaRequestRecipient(),
      fromName: 'Rasika.life',
      ...content,
    });
    return true;
  } catch (error) {
    console.error('[sabha-request] Failed to send request email', error);
    return false;
  }
}

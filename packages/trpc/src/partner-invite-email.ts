import { Email } from '@rasika/core';
import { partnerInviteEmail } from '@rasika/email';

const SITE_URL = process.env.SITE_URL || 'https://rasika.life';
const SABHA_URL = process.env.SABHA_URL || 'https://sabha.rasika.life';

/**
 * Sends one moderator's invite to one person, from the transactional identity
 * (`noreply@mail.rasika.life`, shown as "Rasika.life"), like the approval email. It is not
 * bulk mail, so it does not use the digest sender. Best-effort: the invite row is stored first,
 * so a send failure is logged and reported (`false`) and never thrown. The moderator can send
 * the invite again, which renews it.
 */
export async function sendPartnerInviteEmail(input: {
  to: string;
  inviterName: string;
  targetName: string;
}): Promise<boolean> {
  try {
    const content = await partnerInviteEmail({
      inviterName: input.inviterName,
      targetName: input.targetName,
      inviteeEmail: input.to,
      sabhaUrl: SABHA_URL,
      siteUrl: SITE_URL,
    });
    await Email.sendTransactional({ to: input.to, fromName: 'Rasika.life', ...content });
    return true;
  } catch (error) {
    console.error('[partner] Failed to send invite email', error);
    return false;
  }
}

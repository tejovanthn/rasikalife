import { Email, type Event, User } from '@rasika/core';
import { eventApprovedEmail } from '@rasika/email';

const SITE_URL = process.env.SITE_URL || 'https://rasika.life';

/**
 * Tells a submitter their event is live, with the link and the way to the WhatsApp text. A
 * submitter who never hears back does not submit again. Best-effort: the event is approved
 * either way, so a send failure is logged, not thrown. A moderator approving their own event
 * gets nothing; they already know.
 */
export async function sendEventApprovedEmail(
  event: Awaited<ReturnType<typeof Event.approveEvent>>,
  approverId: string
) {
  if (event.createdBy === approverId) return;
  try {
    const submitter = await User.getUser(event.createdBy);
    if (!submitter?.email) return;
    const content = await eventApprovedEmail({
      eventId: event.id,
      eventTitle: event.title,
      startDateTime: event.startDateTime,
      timezone: event.timezone,
      venueName: event.venueName ?? undefined,
      siteUrl: SITE_URL,
    });
    await Email.sendTransactional({ to: submitter.email, fromName: 'Rasika.life', ...content });
  } catch (error) {
    console.error('[event] Failed to send event-approved email', error);
  }
}

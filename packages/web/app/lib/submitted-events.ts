import type { DigestEvent, DigestOptions } from '~/lib/whatsapp-digest';

/**
 * What the page after "Submit" shows. A submitter used to land back on `/events` with a toast
 * and nothing else: no link, and no word on what happens next. An approved event gets its link
 * and the WhatsApp text; one waiting for review gets neither, because `event.get` returns only
 * approved events and a link handed out now would be a dead page until a moderator acts.
 */

export interface SubmittedEvent extends DigestEvent {
  status?: string | null;
  createdBy?: string | null;
}

/**
 * Splits the events named in the URL into live and waiting. The ids arrive in a query string,
 * so a viewer sees only events they created (a moderator sees any). A draft or a rejected
 * event is neither, and is left out.
 */
export function partitionSubmitted<T extends SubmittedEvent>(
  events: T[],
  viewer: { id: string; isModerator: boolean }
): { live: T[]; inReview: T[] } {
  const own = events.filter(e => viewer.isModerator || e.createdBy === viewer.id);
  return {
    live: own.filter(e => e.status === 'approved'),
    inReview: own.filter(e => e.status === 'submitted'),
  };
}

const ORIGIN = 'https://rasika.life';

/**
 * Options for the WhatsApp text of what was just published. One concert is its own listing,
 * so the text ends with its link and does not print it twice. Several end with the festival
 * they belong to, or else the concerts page.
 */
export function submittedDigestOptions(
  live: DigestEvent[],
  opts: {
    eventUrl: (event: DigestEvent) => string;
    festival?: { name: string; url: string } | null;
  }
): DigestOptions {
  const eventUrl = (event: DigestEvent) => `${ORIGIN}${opts.eventUrl(event)}`;
  if (live.length === 1 && !opts.festival) {
    return {
      heading: live[0].title,
      listingUrl: eventUrl(live[0]),
      eventUrl,
      links: false,
      campaign: 'submit_share',
    };
  }
  return {
    heading: opts.festival?.name ?? 'Upcoming concerts',
    listingUrl: opts.festival ? `${ORIGIN}${opts.festival.url}` : `${ORIGIN}/events`,
    eventUrl,
    campaign: 'submit_share',
  };
}

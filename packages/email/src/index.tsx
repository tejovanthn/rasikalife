import type { ClassLearnerAccess } from '@rasika/core';
import { render } from '@react-email/render';
import EventApprovedEmail from '../emails/event-approved';
import StudentAddedEmail from '../emails/student-added';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

async function renderBoth(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export interface StudentAddedEmailInput {
  learnerName: string;
  guruName: string;
  institutionName: string;
  programTitle: string;
  relation: ClassLearnerAccess.AccessRelation;
  recipientEmail: string;
  signInUrl: string;
}

/**
 * The guru added a learner and named an account to watch it. Sent once, at `addLearner` —
 * see `packages/trpc/src/routers/classes.ts`.
 */
export async function studentAddedEmail(input: StudentAddedEmailInput): Promise<EmailContent> {
  const who = input.relation === 'self' ? 'you' : input.learnerName;
  return {
    subject: `${input.guruName} added ${who} to ${input.programTitle}`,
    ...(await renderBoth(<StudentAddedEmail {...input} />)),
  };
}

export interface EventApprovedEmailInput {
  eventId: string;
  eventTitle: string;
  startDateTime: string;
  timezone: string;
  venueName?: string;
  /** The stage's site origin, e.g. `https://rasika.life`. */
  siteUrl: string;
}

/**
 * A submitter's event was approved. Sent from `event.approveEvent` in
 * `packages/trpc/src/routers/event.ts`, never for a moderator's own event.
 *
 * The event link is id-only (`/events/<id>`), which the event route accepts: the slug is built
 * in the web package, and a copy of it here could drift.
 */
export async function eventApprovedEmail(input: EventApprovedEmailInput): Promise<EmailContent> {
  const site = input.siteUrl.replace(/\/+$/, '');
  const when = new Date(input.startDateTime).toLocaleString('en-IN', {
    timeZone: input.timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return {
    subject: `Your event is live: ${input.eventTitle}`,
    ...(await renderBoth(
      <EventApprovedEmail
        eventTitle={input.eventTitle}
        when={when}
        venueName={input.venueName}
        eventUrl={`${site}/events/${input.eventId}`}
        shareUrl={`${site}/events/new/submitted?eventId=${encodeURIComponent(input.eventId)}`}
        myEventsUrl={`${site}/my-events`}
        siteUrl={site}
      />
    )),
  };
}

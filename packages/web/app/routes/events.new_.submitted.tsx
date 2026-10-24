import * as Auth from '@rasika/core/auth';
import { CheckCircle2, Clock, Upload } from 'lucide-react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { EventTime } from '~/components/events/event-time';
import { WhatsAppDigest } from '~/components/events/whatsapp-digest';
import { buttonVariants } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { eventDateKey, eventZone, formatDayLabel } from '~/lib/event-time';
import { shortLinksFor } from '~/lib/short-links.server';
import {
  type SubmittedEvent,
  partitionSubmitted,
  submittedDigestOptions,
} from '~/lib/submitted-events';
import { generateEventUrl, generateFestivalUrl } from '~/lib/url-slug';
import { cn } from '~/lib/utils';
import { digestLinks, formatWhatsAppDigest } from '~/lib/whatsapp-digest';

export const meta: MetaFunction = () => [
  { title: 'Event submitted - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const isModerator = user.role === Auth.ROLE.MODERATOR || user.role === Auth.ROLE.ADMIN;
  const url = new URL(request.url);
  const eventIds = url.searchParams.getAll('eventId').slice(0, 50);
  const festivalId = url.searchParams.get('festivalId');
  const serverClient = await createServerClient(request);

  const loaded = await Promise.all(
    eventIds.map(id => serverClient.event.getDraft.query({ id }).catch(() => null))
  );
  const { live, inReview } = partitionSubmitted(
    loaded.filter((e): e is NonNullable<typeof e> => e !== null) as SubmittedEvent[],
    { id: user.id, isModerator }
  );

  const f = festivalId
    ? await serverClient.festival.getDraft.query({ id: festivalId }).catch(() => null)
    : null;
  const festival =
    f?.status === 'approved' && f.name
      ? { name: f.name, url: generateFestivalUrl(f.name, f.id) }
      : null;

  let digest: string | null = null;
  if (live.length > 0) {
    const opts = submittedDigestOptions(live, {
      eventUrl: e => generateEventUrl(e.title, e.id),
      festival,
    });
    digest = formatWhatsAppDigest(live, {
      ...opts,
      shortLinks: await shortLinksFor(digestLinks(live, opts)),
    });
  }

  const row = (e: SubmittedEvent) => ({
    id: e.id,
    title: e.title,
    startDateTime: e.startDateTime,
    zone: eventZone(e),
    day: formatDayLabel(eventDateKey(e)),
    venueName: e.venueName ?? null,
    url: generateEventUrl(e.title, e.id),
  });

  return data({
    live: live.map(row),
    inReview: inReview.map(row),
    festival,
    digest,
  });
}

type Row = ReturnType<typeof useLoaderData<typeof loader>>['live'][number];

function EventRows({ events, linked }: { events: Row[]; linked: boolean }) {
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {events.map(e => (
        <li key={e.id} className="p-4">
          {linked ? (
            <Link to={e.url} className="font-medium">
              {e.title}
            </Link>
          ) : (
            <span className="font-medium">{e.title}</span>
          )}
          <p className="text-sm text-muted-foreground">
            {e.day}, <EventTime start={e.startDateTime} zone={e.zone} />
            {e.venueName && ` · ${e.venueName}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function EventSubmitted() {
  const { live, inReview, festival, digest } = useLoaderData<typeof loader>();
  const nothing = live.length === 0 && inReview.length === 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      {nothing && (
        <header>
          <h1 className="page-title">Nothing to show</h1>
          <p className="text-muted-foreground">
            These events are not yours, or they are no longer waiting for review.
          </p>
        </header>
      )}

      {live.length > 0 && (
        <section className="space-y-4" aria-labelledby="live-heading">
          <h1 id="live-heading" className="page-title flex items-center gap-2">
            <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
            {live.length === 1 ? 'Your event is live' : `${live.length} events are live`}
          </h1>
          <EventRows events={live} linked />
          {festival && (
            <p className="text-sm">
              Part of <Link to={festival.url}>{festival.name}</Link>.
            </p>
          )}
          {digest && (
            <>
              <h2 className="section-heading">Share it on WhatsApp</h2>
              <WhatsAppDigest text={digest} options={[]} />
            </>
          )}
        </section>
      )}

      {inReview.length > 0 && (
        <section className="space-y-4" aria-labelledby="review-heading">
          {live.length > 0 ? (
            <h2 id="review-heading" className="section-heading flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Waiting for review
            </h2>
          ) : (
            <h1 id="review-heading" className="page-title flex items-center gap-2">
              <Clock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
              Thank you. We will check {inReview.length === 1 ? 'it' : 'them'} next.
            </h1>
          )}
          <p className="text-muted-foreground">
            A moderator reads every new listing before it goes on the site. After that it shows on
            the concerts page, and on the venue and organiser pages.
          </p>
          <EventRows events={inReview} linked={false} />
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/events/new"
          className={cn(buttonVariants(), 'min-h-11 md:min-h-10 no-underline')}
        >
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          Add another poster
        </Link>
        <Link
          to="/events"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'min-h-11 md:min-h-10 no-underline'
          )}
        >
          Back to concerts
        </Link>
        <Link
          to="/my-events"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'min-h-11 md:min-h-10 no-underline'
          )}
        >
          All my events
        </Link>
      </div>
    </main>
  );
}

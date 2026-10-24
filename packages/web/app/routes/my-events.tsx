import { Plus } from 'lucide-react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, data, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { EmptyState } from '~/components/shared/EmptyState';
import { buttonVariants } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { eventDateKey, formatDayLabel } from '~/lib/event-time';
import { type MyEvent, groupMyEvents } from '~/lib/my-events';
import { generateEventUrl } from '~/lib/url-slug';
import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => [
  { title: 'My events - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const nextToken = new URL(request.url).searchParams.get('nextToken') ?? undefined;
  const serverClient = await createServerClient(request);
  const result = await serverClient.event.mine.query({ nextToken });

  const rows = result.items.map(e => ({
    id: e.id,
    title: e.title,
    startDateTime: e.startDateTime,
    status: e.status,
    posterUrl: e.posterUrl ?? null,
    festivalId: e.festivalId ?? null,
    moderatorNote: e.moderatorNote ?? null,
    venueName: e.venueName ?? null,
    rsvpCount: e.rsvpCount ?? 0,
    attendedCount: e.attendedCount ?? 0,
    day: formatDayLabel(eventDateKey(e), { year: true }),
    url: generateEventUrl(e.title, e.id),
  }));
  return data({ groups: groupMyEvents(rows), nextToken: result.nextToken ?? null });
}

type Row = MyEvent & {
  venueName: string | null;
  rsvpCount: number;
  attendedCount: number;
  day: string;
  url: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-heading">{title}</h2>
      <ul className="divide-y rounded-lg border bg-card">{children}</ul>
    </section>
  );
}

function Line({ event }: { event: Row }) {
  return (
    <p className="text-sm text-muted-foreground">
      {event.day}
      {event.venueName && ` · ${event.venueName}`}
    </p>
  );
}

function Counts({ event }: { event: Row }) {
  const parts = [
    event.rsvpCount > 0 && `${event.rsvpCount} going`,
    event.attendedCount > 0 && `${event.attendedCount} attended`,
  ].filter(Boolean);
  return parts.length > 0 ? <p className="text-sm">{parts.join(' · ')}</p> : null;
}

export default function MyEvents() {
  const { groups, nextToken } = useLoaderData<typeof loader>();
  const { drafts, inReview, upcoming, past, rejected } = groups;
  const empty =
    drafts.length + inReview.length + upcoming.length + past.length + rejected.length === 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">My events</h1>
          <p className="text-muted-foreground">Every event you have added, and where it stands.</p>
        </div>
        <Link
          to="/events/new"
          className={cn(buttonVariants(), 'shrink-0 min-h-11 md:min-h-10 no-underline')}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          List an event
        </Link>
      </header>

      {empty && <EmptyState message="You have not added an event yet." />}

      {drafts.length > 0 && (
        <Section title="Not finished">
          {drafts.map(batch => (
            <li key={batch.href} className="p-4 space-y-1">
              {batch.events.map(e => (
                <div key={e.id}>
                  <span className="font-medium">{e.title || 'Untitled'}</span>
                  <Line event={e} />
                </div>
              ))}
              <Link to={batch.href} className="inline-flex min-h-11 items-center md:min-h-0">
                Check and submit
              </Link>
            </li>
          ))}
        </Section>
      )}

      {inReview.length > 0 && (
        <Section title="Waiting for review">
          {inReview.map(e => (
            <li key={e.id} className="p-4">
              <span className="font-medium">{e.title}</span>
              <Line event={e} />
            </li>
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Live">
          {upcoming.map(e => (
            <li key={e.id} className="p-4">
              <Link to={e.url} className="font-medium">
                {e.title}
              </Link>
              <Line event={e} />
              <Counts event={e} />
            </li>
          ))}
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title="Not listed">
          {rejected.map(e => (
            <li key={e.id} className="p-4">
              <span className="font-medium">{e.title}</span>
              <Line event={e} />
              {e.moderatorNote && <p className="text-sm">Moderator's note: {e.moderatorNote}</p>}
            </li>
          ))}
        </Section>
      )}

      {past.length > 0 && (
        <Section title="Past">
          {past.map(e => (
            <li key={e.id} className="p-4">
              <Link to={e.url} className="font-medium">
                {e.title}
              </Link>
              <Line event={e} />
              <Counts event={e} />
            </li>
          ))}
        </Section>
      )}

      {nextToken && <Link to={`?nextToken=${encodeURIComponent(nextToken)}`}>Older events</Link>}
    </main>
  );
}

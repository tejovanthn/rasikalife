import type { ConcertLog } from '@rasika/core/domain/concert-log/client';
import type { RouterOutput } from '~/api.server';
import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';
import { Link, data, useLoaderData } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireUser } from '~/lib/auth.server';

type PastRsvpEvent = RouterOutput['concertLog']['listPastRsvpedWithoutLogs'][number];

export const meta: MetaFunction = () => [
  { title: 'My Concerts - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUser(request, '/my-concerts');
  const serverClient = await createServerClient(request);
  const [result, pastRsvped] = await Promise.all([
    serverClient.concertLog.list.query({ limit: 100 }),
    serverClient.concertLog.listPastRsvpedWithoutLogs.query({ limit: 5 }),
  ]);
  return data({ user, logs: result.items, hasMore: result.hasMore, pastRsvped });
};

function groupByYear(logs: ConcertLog[]): Map<string, ConcertLog[]> {
  const groups = new Map<string, ConcertLog[]>();
  for (const log of logs) {
    const year = new Date(log.eventStartDateTime).getFullYear().toString();
    const existing = groups.get(year);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(year, [log]);
    }
  }
  return groups;
}

export default function MyConcerts() {
  const { logs, pastRsvped } = useLoaderData<{
    logs: ConcertLog[];
    hasMore: boolean;
    pastRsvped: PastRsvpEvent[];
  }>();

  const grouped = useMemo(() => groupByYear(logs), [logs]);
  const years = useMemo(() => [...grouped.keys()].sort((a, b) => Number(b) - Number(a)), [grouped]);

  if (logs.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">My Concerts</h1>
        <p className="text-muted-foreground mb-8">Your personal concert diary.</p>
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <BookOpen aria-hidden="true" className="h-10 w-10 opacity-40" />
          <p className="text-sm">No concerts logged yet.</p>
          <Link to="/past-events" className="text-sm text-primary hover:underline">
            Browse past events to log
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">My Concerts</h1>
      <p className="text-muted-foreground mb-8">
        {logs.length} concert{logs.length !== 1 ? 's' : ''} logged.
      </p>

      <div className="space-y-8">
        {years.map(year => (
          <section key={year}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {year}
            </h2>
            <ul className="space-y-1">
              {(grouped.get(year) ?? []).map(log => (
                <li key={log.eventId}>
                  <Link
                    to={`/my-concerts/${log.eventId}`}
                    className="grid grid-cols-[80px_1fr] gap-x-4 rounded-md px-3 py-3.5 hover:bg-muted transition-colors min-h-[44px]"
                  >
                    <span className="text-xs text-muted-foreground self-start pt-0.5 whitespace-nowrap">
                      {new Date(log.eventStartDateTime).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{log.eventTitle}</p>
                      {log.venueName && (
                        <p className="text-xs text-muted-foreground truncate">{log.venueName}</p>
                      )}
                      {log.artistNames && log.artistNames.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {log.artistNames.join(', ')}
                        </p>
                      )}
                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {pastRsvped && pastRsvped.length > 0 && (
        <section className="mt-10 pt-6 border-t">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            You RSVP'd, want to add notes? ({pastRsvped.length})
          </h2>
          <ul className="space-y-1">
            {pastRsvped.map(event => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {event.venueName && ` · ${event.venueName}`}
                  </p>
                </div>
                <Link
                  to={`/my-concerts/${event.id}/edit`}
                  className="shrink-0 text-xs text-primary hover:underline font-medium"
                >
                  Log this concert
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

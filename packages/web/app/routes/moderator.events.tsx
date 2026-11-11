import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Check, Clock, Eye, GitMerge, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, Link, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireModerator } from '~/lib/auth.server';
import { generateEventUrl } from '~/lib/url-slug';

dayjs.extend(relativeTime);

interface SubmittedEvent {
  id: string;
  title: string;
  startDateTime: string;
  venueName?: string;
  artists?: Array<{ name: string; title?: string; role?: string }>;
  posterUrl?: string;
  submittedAt?: string;
  createdAt: string;
  /** Events this one probably repeats: same venue, within 30 minutes, same programme. */
  likelyDuplicates?: Array<{
    id: string;
    title: string;
    startDateTime: string;
    status?: string | null;
  }>;
}

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex, nofollow' }];
};

export async function loader({ request }: { request: Request }) {
  const user = await requireModerator(request);

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;

  const serverClient = await createServerClient(request);
  const result = await serverClient.event.listSubmittedEvents.query({ nextToken });

  return data({
    events: result.items as SubmittedEvent[],
    nextToken: result.nextToken,
    hasMore: result.hasMore,
    userRole: user.role,
    error: null as string | null,
  });
}

export async function action({ request }: { request: Request }) {
  await requireModerator(request);

  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const eventId = formData.get('eventId') as string;

  try {
    if (intent === 'approve') {
      // Present only when the moderator ticked "different event" for a likely duplicate.
      const notDuplicateOf = formData.getAll('notDuplicateOf').map(String).filter(Boolean);
      await serverClient.event.approveEvent.mutate({ eventId, notDuplicateOf });
    } else if (intent === 'reject') {
      const moderatorNote = formData.get('moderatorNote') as string;
      await serverClient.event.rejectEvent.mutate({ eventId, moderatorNote });
    } else if (intent === 'merge') {
      const keeperId = formData.get('keeperId') as string;
      await serverClient.event.merge.mutate({ loserId: eventId, keeperId });
    }
  } catch (error) {
    return data(
      { success: false, error: error instanceof Error ? error.message : 'Action failed' },
      { status: 400 }
    );
  }

  return data({ success: true, error: null as string | null });
}

function EventActions({ event }: { event: SubmittedEvent }) {
  const navigation = useNavigation();
  const isBusy = navigation.state !== 'idle';
  const isThisEvent =
    navigation.state === 'submitting' && navigation.formData?.get('eventId') === event.id;

  const duplicates = event.likelyDuplicates ?? [];
  const [confirmed, setConfirmed] = useState(false);
  // With a likely duplicate, Approve works only once "different event" is ticked; the ids then
  // travel with the request and are stored on the event, so nobody is asked again.
  const needsAnswer = duplicates.length > 0 && !confirmed;

  return (
    <Form method="post" className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="eventId" value={event.id} />
      {duplicates.length > 0 && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            Different event
          </label>
          {confirmed &&
            duplicates.map(d => (
              <input key={d.id} type="hidden" name="notDuplicateOf" value={d.id} />
            ))}
          <select
            name="keeperId"
            aria-label="Merge into"
            className="h-8 max-w-40 rounded border bg-background text-xs"
          >
            {duplicates.map(d => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            name="intent"
            value="merge"
            size="sm"
            variant="outline"
            disabled={isBusy}
          >
            <GitMerge className="mr-1 h-4 w-4" aria-hidden="true" />
            Merge into…
          </Button>
        </div>
      )}
      <Button
        type="submit"
        name="intent"
        value="approve"
        size="sm"
        className="bg-success hover:bg-success/90"
        disabled={isBusy || needsAnswer}
        title={needsAnswer ? 'Possible duplicate: tick "Different event", or merge' : undefined}
      >
        {isThisEvent && navigation.formData?.get('intent') === 'approve' ? (
          <Clock className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
      <div className="flex items-center gap-1">
        <Label htmlFor={`note-${event.id}`} className="sr-only">
          Rejection reason
        </Label>
        <Input
          id={`note-${event.id}`}
          name="moderatorNote"
          placeholder="Reject reason"
          className="h-8 w-32 text-xs"
        />
        <Button
          type="submit"
          name="intent"
          value="reject"
          size="sm"
          variant="destructive"
          disabled={isBusy}
        >
          {isThisEvent && navigation.formData?.get('intent') === 'reject' ? (
            <Clock className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Form>
  );
}

export default function ModeratorEvents() {
  const { events, userRole, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const columns = useMemo<ColumnDef<SubmittedEvent>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{row.getValue('title')}</span>
            {(row.original.likelyDuplicates ?? []).length > 0 && (
              <span className="text-xs text-warning">
                Possible duplicate of{' '}
                {(row.original.likelyDuplicates ?? []).map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <Link
                      to={generateEventUrl(d.title, d.id)}
                      target="_blank"
                      className="underline"
                    >
                      {d.title}
                    </Link>
                  </span>
                ))}
              </span>
            )}
            {row.original.posterUrl && (
              <a
                href={row.original.posterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="View poster"
              >
                <Eye className="h-4 w-4" />
              </a>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'startDateTime',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.getValue('startDateTime')).format('MMM D, YYYY h:mm A')}
          </span>
        ),
      },
      {
        accessorKey: 'venueName',
        header: 'Venue',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.getValue('venueName') || '-'}</span>
        ),
      },
      {
        id: 'artists',
        header: 'Artists',
        cell: ({ row }) => {
          const artists = row.original.artists || [];
          return (
            <span className="text-sm text-muted-foreground">
              {artists.length > 0 ? artists.map(a => a.name).join(', ') : '-'}
            </span>
          );
        },
      },
      {
        id: 'submitted',
        header: 'Submitted',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.original.submittedAt || row.original.createdAt).fromNow()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <EventActions event={row.original} />,
      },
    ],
    []
  );

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pending Events</h1>
        <span className="text-sm text-muted-foreground">Moderator: {userRole}</span>
      </div>

      {actionData?.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          {actionData.error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">All caught up!</h2>
          <p className="text-muted-foreground">
            No pending events to review. New submissions will appear here.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={events} />
      )}
    </div>
  );
}

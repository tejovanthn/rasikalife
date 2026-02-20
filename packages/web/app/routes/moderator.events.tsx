import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Check, Clock, Eye, X } from 'lucide-react';
import { useMemo } from 'react';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { requireModerator } from '~/lib/auth.server';

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

  if (intent === 'approve') {
    await serverClient.event.approveEvent.mutate({ eventId });
  } else if (intent === 'reject') {
    const moderatorNote = formData.get('moderatorNote') as string;
    await serverClient.event.rejectEvent.mutate({ eventId, moderatorNote });
  }

  return data({ success: true });
}

function EventActions({ event }: { event: SubmittedEvent }) {
  const navigation = useNavigation();
  const isBusy = navigation.state !== 'idle';
  const isThisEvent =
    navigation.state === 'submitting' && navigation.formData?.get('eventId') === event.id;

  return (
    <Form method="post" className="flex items-center justify-end gap-2">
      <input type="hidden" name="eventId" value={event.id} />
      <Button
        type="submit"
        name="intent"
        value="approve"
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        disabled={isBusy}
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

  const columns = useMemo<ColumnDef<SubmittedEvent>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{row.getValue('title')}</span>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-950 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
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

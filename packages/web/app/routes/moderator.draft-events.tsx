import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Clock, Eye, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { MetaFunction } from 'react-router';
import { Form, data, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { DataTable } from '~/components/data-table';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';

dayjs.extend(relativeTime);

interface DraftEvent {
  id: string;
  title: string;
  posterUrl?: string;
  extractionConfidence?: number;
  createdBy: string;
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
  const result = await serverClient.event.listDraftEvents.query({ nextToken });

  return data({
    events: result.items as DraftEvent[],
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

  if (intent === 'delete') {
    await serverClient.event.deleteDraftEvent.mutate({ eventId });
  } else if (intent === 'force-submit') {
    await serverClient.event.forceSubmitDraft.mutate({ eventId });
  } else if (intent === 're-extract') {
    await serverClient.event.reExtractDraft.mutate({ eventId });
  }

  return data({ success: true });
}

function DraftEventActions({ event }: { event: DraftEvent }) {
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
        value="force-submit"
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        disabled={isBusy}
        title="Force submit to review queue"
      >
        {isThisEvent && navigation.formData?.get('intent') === 'force-submit' ? (
          <Clock className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="submit"
        name="intent"
        value="re-extract"
        size="sm"
        variant="outline"
        disabled={isBusy}
        title="Re-extract from poster"
      >
        {isThisEvent && navigation.formData?.get('intent') === 're-extract' ? (
          <Clock className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="submit"
        name="intent"
        value="delete"
        size="sm"
        variant="destructive"
        disabled={isBusy}
        title="Delete draft"
      >
        {isThisEvent && navigation.formData?.get('intent') === 'delete' ? (
          <Clock className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </Form>
  );
}

export default function ModeratorDraftEvents() {
  const { events, userRole, error } = useLoaderData<typeof loader>();

  const columns = useMemo<ColumnDef<DraftEvent>[]>(
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
        id: 'confidence',
        header: 'Confidence',
        cell: ({ row }) => {
          const confidence = row.original.extractionConfidence;
          return (
            <span className="text-sm text-muted-foreground">
              {confidence !== undefined ? `${Math.round(confidence * 100)}%` : '-'}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdBy',
        header: 'Created By',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-mono text-xs">
            {row.getValue('createdBy')}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {dayjs(row.original.createdAt).fromNow()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <DraftEventActions event={row.original} />,
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
        <h1 className="text-2xl font-bold text-foreground">Unprocessed Draft Posters</h1>
        <span className="text-sm text-muted-foreground">Moderator: {userRole}</span>
      </div>

      {events.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">All clear!</h2>
          <p className="text-muted-foreground">
            No unprocessed posters — all uploads have been submitted.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={events} />
      )}
    </div>
  );
}

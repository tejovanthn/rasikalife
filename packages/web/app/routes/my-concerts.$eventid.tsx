import type { ConcertLog } from '@rasika/core/domain/concert-log/client';
import { ChevronLeft, ListMusic, Trash2 } from 'lucide-react';
import { redirect, data, useLoaderData, useFetcher } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { requireUser } from '~/lib/auth.server';
import { generateEventUrl } from '~/lib/url-slug';

export const meta: MetaFunction = ({ data }) => {
  const title =
    (data as { log?: { eventTitle?: string } } | undefined)?.log?.eventTitle ?? 'Concert';
  return [
    { title: `${title} - My Concerts - Rasika.life` },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) throw new Response('Not found', { status: 404 });

  const user = await requireUser(request, `/my-concerts/${eventid}`);
  const serverClient = await createServerClient(request);
  const log = await serverClient.concertLog.get.query({ eventId: eventid });

  if (!log) throw new Response('Concert log not found', { status: 404 });

  return data({ user, log });
};

export const action: ActionFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) return data({ error: 'Missing event ID' }, { status: 400 });

  await requireUser(request, `/my-concerts/${eventid}`);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'updateNotes') {
    const notes = (formData.get('notes') as string | null) ?? '';
    await serverClient.concertLog.upsert.mutate({ eventId: eventid, notes: notes || undefined });
    return data({ success: true });
  }

  if (intent === 'delete') {
    await serverClient.concertLog.delete.mutate({ eventId: eventid });
    return redirect('/my-concerts');
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export default function ConcertLogEdit() {
  const { log } = useLoaderData<{ log: ConcertLog }>();
  const fetcher = useFetcher<{ success?: boolean }>();
  const deleteFetcher = useFetcher();

  const eventDate = new Date(log.eventStartDateTime);
  const isSaving = fetcher.state !== 'idle';

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          to="/my-concerts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          My Concerts
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold">{log.eventTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {eventDate.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {log.venueName && ` · ${log.venueName}`}
        </p>
        {log.artistNames && log.artistNames.length > 0 && (
          <p className="text-sm text-muted-foreground">{log.artistNames.join(', ')}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <Link
            to={generateEventUrl(log.eventTitle, log.eventId)}
            className="text-xs text-primary hover:underline"
          >
            View event page
          </Link>
          <Link
            to={`/my-concerts/${log.eventId}/edit`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ListMusic aria-hidden="true" className="h-3 w-3" />
            Edit setlist
          </Link>
        </div>
      </div>

      <fetcher.Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="updateNotes" />
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={log.notes ?? ''}
          rows={8}
          placeholder="What did you think? Who performed? Any highlights…"
          className="resize-y"
          onBlur={e => {
            const form = e.currentTarget.form;
            if (form) fetcher.submit(form);
          }}
        />
        <div className="flex items-center justify-between">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save notes'}
          </Button>
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {fetcher.data?.success && !isSaving ? 'Saved' : ''}
          </span>
        </div>
      </fetcher.Form>

      <div className="mt-10 pt-6 border-t">
        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <Button
            type="submit"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleteFetcher.state !== 'idle'}
            onClick={e => {
              if (!window.confirm('Remove this concert from your diary? This cannot be undone.')) {
                e.preventDefault();
              }
            }}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4 mr-2" />
            Remove from diary
          </Button>
        </deleteFetcher.Form>
      </div>
    </main>
  );
}

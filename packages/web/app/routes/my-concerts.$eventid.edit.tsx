import type { ConcertLogItem } from '@rasika/core/domain/concert-log-item/client';
import type { ConcertLog } from '@rasika/core/domain/concert-log/client';
import type { EventSetlist } from '@rasika/core/domain/event-setlist/client';
import { ChevronLeft, Save } from 'lucide-react';
import { useMemo } from 'react';
import { Form, Link, data, redirect, useLoaderData, useNavigation } from 'react-router';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { createServerClient } from '~/api.server';
import { SetlistEditor } from '~/components/concert-log/SetlistEditor';
import type { SetlistDraft, SetlistItemDraft } from '~/components/concert-log/types';
import { useLocalDraft } from '~/components/concert-log/useLocalDraft';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { requireUser } from '~/lib/auth.server';
import { generateEventUrl } from '~/lib/url-slug';

export const meta: MetaFunction = ({ data }) => {
  const title =
    (data as { log?: { eventTitle?: string } } | undefined)?.log?.eventTitle ?? 'Concert';
  return [
    { title: `Edit Setlist — ${title} - Rasika.life` },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) throw new Response('Not found', { status: 404 });

  const user = await requireUser(request, `/my-concerts/${eventid}/edit`);
  const serverClient = await createServerClient(request);

  const [log, { canonical, userOwn }] = await Promise.all([
    serverClient.concertLog.get.query({ eventId: eventid }),
    serverClient.eventSetlist.getForEvent.query({ eventId: eventid }),
  ]);

  if (!log) {
    // No log yet — redirect to create one first (upsert on submit will create it)
  }

  return data({ user, log: log ?? null, userOwn: userOwn ?? [], canonical, eventId: eventid });
};

export const action: ActionFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) return data({ error: 'Missing event ID' }, { status: 400 });

  await requireUser(request, `/my-concerts/${eventid}/edit`);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  const notes = (formData.get('notes') as string) ?? '';
  const itemsJson = (formData.get('items') as string) ?? '[]';

  let items: SetlistItemDraft[] = [];
  try {
    items = JSON.parse(itemsJson) as SetlistItemDraft[];
  } catch {
    return data({ error: 'Invalid items' }, { status: 400 });
  }

  await serverClient.concertLog.upsertWithSetlist.mutate({
    eventId: eventid,
    notes: notes || undefined,
    items: items.map((item, index) => ({
      order: index,
      compositionId: item.compositionId,
      compositionTitle: item.compositionTitle || `Item ${index + 1}`,
      ragaId: item.ragaId,
      ragaName: item.ragaName,
      talaId: item.talaId,
      talaName: item.talaName,
      compositionType: item.compositionType,
      publicNote: item.publicNote,
      isHighlight: item.isHighlight,
    })),
  });

  return redirect(`/my-concerts/${eventid}`);
};

function toSetlistDraft(log: ConcertLog | null, userOwn: ConcertLogItem[]): SetlistDraft {
  return {
    notes: log?.notes ?? '',
    items: userOwn.map(item => ({
      _id: crypto.randomUUID(),
      order: item.order,
      compositionId: item.compositionId,
      compositionTitle: item.compositionTitle,
      ragaId: item.ragaId,
      ragaName: item.ragaName,
      talaId: item.talaId,
      talaName: item.talaName,
      compositionType: item.compositionType,
      publicNote: item.publicNote,
      isHighlight: item.isHighlight ?? false,
      isFreeText: !item.compositionId,
    })),
  };
}

export default function ConcertSetlistEdit() {
  const { log, userOwn, eventId } = useLoaderData<{
    log: ConcertLog | null;
    userOwn: ConcertLogItem[];
    canonical: EventSetlist[];
    eventId: string;
  }>();

  const serverDraft = useMemo(() => toSetlistDraft(log, userOwn), [log, userOwn]);
  const serverUpdatedAt = useMemo(() => {
    const timestamps = [log?.updatedAt, ...userOwn.map(i => i.updatedAt)].filter(
      Boolean
    ) as string[];
    return timestamps.sort().at(-1);
  }, [log, userOwn]);

  const { draft, setDraft, clearDraft, savedAt } = useLocalDraft(
    eventId,
    serverDraft,
    serverUpdatedAt
  );

  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const eventTitle = log?.eventTitle ?? 'This Concert';
  const eventDate = log?.eventStartDateTime
    ? new Date(log.eventStartDateTime).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          to={`/my-concerts/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold">{eventTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {eventDate}
          {log?.venueName && ` · ${log.venueName}`}
        </p>
        {log?.artistNames && log.artistNames.length > 0 && (
          <p className="text-sm text-muted-foreground">{log.artistNames.join(', ')}</p>
        )}
        {log && (
          <Link
            to={generateEventUrl(log.eventTitle, eventId)}
            className="text-xs text-primary hover:underline mt-1 inline-block"
          >
            View event page
          </Link>
        )}
      </div>

      <Form method="post" onSubmit={() => clearDraft()} className="space-y-8">
        <input type="hidden" name="items" value={JSON.stringify(draft.items)} />

        <section>
          <h2 className="text-sm font-semibold mb-3">Private notes</h2>
          <Textarea
            aria-label="Private notes"
            name="notes"
            defaultValue={draft.notes}
            onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            placeholder="Your private impressions, highlights, anything you want to remember…"
            className="resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">Visible only to you.</p>
        </section>

        <SetlistEditor draft={draft} onChange={updated => setDraft(updated)} />

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {savedAt ? `Draft saved ${savedAt.toLocaleTimeString()}` : 'Changes auto-saved locally'}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/my-concerts/${eventId}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              <Save aria-hidden="true" className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving…' : 'Save setlist'}
            </Button>
          </div>
        </div>
      </Form>
    </main>
  );
}

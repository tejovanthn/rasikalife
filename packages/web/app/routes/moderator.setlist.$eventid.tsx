import type { EventSetlist } from '@rasika/core/domain/event-setlist/client';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, data, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';

export const meta: MetaFunction = ({ params }) => [
  { title: `Setlist Override: ${params.eventid} - Moderator` },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) throw new Response('Not found', { status: 404 });
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const { canonical } = await serverClient.eventSetlist.getForEvent.query({ eventId: eventid });
  return data({ canonical, eventId: eventid });
};

export const action: ActionFunction = async ({ request, params }) => {
  const { eventid } = params;
  if (!eventid) throw new Response('Not found', { status: 404 });
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'override') {
    const order = Number(formData.get('order'));
    await serverClient.setlistModeration.overrideEventSetlist.mutate({
      eventId: eventid,
      order,
      compositionTitle: (formData.get('compositionTitle') as string) || undefined,
      ragaId: (formData.get('ragaId') as string) || undefined,
      ragaName: (formData.get('ragaName') as string) || undefined,
      talaId: (formData.get('talaId') as string) || undefined,
      talaName: (formData.get('talaName') as string) || undefined,
      compositionType: (formData.get('compositionType') as string) || undefined,
    });
    return data({ success: true });
  }

  if (intent === 'recompute') {
    await serverClient.eventSetlist.recomputeForEvent.mutate({ eventId: eventid });
    return data({ success: true });
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export default function SetlistEventOverride() {
  const { canonical, eventId } = useLoaderData<{
    canonical: EventSetlist[];
    eventId: string;
  }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Setlist Override</h1>
      <p className="text-sm text-muted-foreground mb-4">Event: {eventId}</p>

      <div className="mb-4">
        <Form method="post">
          <input type="hidden" name="intent" value="recompute" />
          <Button type="submit" variant="outline" size="sm" disabled={isSubmitting}>
            Force recompute
          </Button>
        </Form>
      </div>

      {canonical.length === 0 ? (
        <p className="text-muted-foreground">No public setlist yet for this event.</p>
      ) : (
        <div className="space-y-3">
          {canonical.map(row => (
            <Form
              key={`${row.eventId}-${row.order}`}
              method="post"
              className="border border-border rounded-lg p-3 space-y-2"
            >
              <input type="hidden" name="intent" value="override" />
              <input type="hidden" name="order" value={row.order} />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">{row.order + 1}.</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    row.status === 'verified'
                      ? 'bg-success/15 text-success'
                      : row.status === 'disputed'
                        ? 'bg-destructive/15 text-destructive'
                        : row.status === 'lowConfidence'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {row.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.contributorCount}/{row.totalLoggersForEvent} loggers
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pl-8">
                <div>
                  <label
                    htmlFor={`compositionId-${row.order}`}
                    className="block text-muted-foreground mb-0.5"
                  >
                    Composition ID
                  </label>
                  <input
                    id={`compositionId-${row.order}`}
                    type="text"
                    name="compositionId"
                    defaultValue={row.compositionId ?? ''}
                    placeholder="comp_…"
                    className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`compositionTitle-${row.order}`}
                    className="block text-muted-foreground mb-0.5"
                  >
                    Title
                  </label>
                  <input
                    id={`compositionTitle-${row.order}`}
                    type="text"
                    name="compositionTitle"
                    defaultValue={row.compositionTitle}
                    className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`ragaName-${row.order}`}
                    className="block text-muted-foreground mb-0.5"
                  >
                    Raga name
                  </label>
                  <input
                    id={`ragaName-${row.order}`}
                    type="text"
                    name="ragaName"
                    defaultValue={row.ragaName ?? ''}
                    className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`ragaId-${row.order}`}
                    className="block text-muted-foreground mb-0.5"
                  >
                    Raga ID
                  </label>
                  <input
                    id={`ragaId-${row.order}`}
                    type="text"
                    name="ragaId"
                    defaultValue={row.ragaId ?? ''}
                    className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`compositionType-${row.order}`}
                    className="block text-muted-foreground mb-0.5"
                  >
                    Type
                  </label>
                  <input
                    id={`compositionType-${row.order}`}
                    type="text"
                    name="compositionType"
                    defaultValue={row.compositionType ?? ''}
                    className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="pl-8">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  Override (mark verified)
                </Button>
              </div>
            </Form>
          ))}
        </div>
      )}
    </main>
  );
}

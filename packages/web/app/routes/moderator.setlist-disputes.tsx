import type { DisputeField } from '@rasika/core/domain/concert-log-item/client';
import type { EventSetlist } from '@rasika/core/domain/event-setlist/client';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, Link, data, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';

export const meta: MetaFunction = () => [
  { title: 'Setlist: Disputes - Moderator' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;
  const result = await serverClient.setlistModeration.listDisputes.query({
    limit: 20,
    nextToken,
  });
  return data({ items: result.items, nextToken: result.nextToken, hasMore: result.hasMore });
};

export const action: ActionFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  const eventId = formData.get('eventId') as string;
  const order = Number(formData.get('order'));
  const field = formData.get('field') as DisputeField;
  const value = formData.get('value') as string;

  await serverClient.setlistModeration.resolveDispute.mutate({
    eventId,
    order,
    field,
    value,
  });
  return data({ success: true });
};

export default function SetlistDisputesModeration() {
  const { items, nextToken, hasMore } = useLoaderData<{
    items: EventSetlist[];
    nextToken?: string;
    hasMore: boolean;
  }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Setlist: Disputes</h1>
        <p className="text-muted-foreground">No disputed setlist items. All clear.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Setlist: Disputes</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {items.length} dispute{items.length !== 1 ? 's' : ''} pending resolution
      </p>

      <div className="space-y-4">
        {items.map(item => (
          <div
            key={`${item.eventId}-${item.order}`}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div>
              <p className="font-medium">{item.compositionTitle}</p>
              <p className="text-xs text-muted-foreground">
                Event: {item.eventId} · Order: {item.order} · {item.contributorCount} contributors
              </p>
            </div>

            {(item.disputes ?? []).map(dispute => (
              <div key={dispute.field} className="space-y-2">
                <p className="text-sm font-medium">Dispute: {dispute.field}</p>
                <div className="flex gap-2 flex-wrap">
                  {dispute.options.map(opt => (
                    <Form key={opt.value} method="post" className="inline-block">
                      <input type="hidden" name="eventId" value={item.eventId} />
                      <input type="hidden" name="order" value={item.order} />
                      <input type="hidden" name="field" value={dispute.field} />
                      <input type="hidden" name="value" value={opt.value} />
                      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
                        {opt.value} ({opt.count})
                      </Button>
                    </Form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link to={`?nextToken=${nextToken}`} className="text-sm text-primary hover:underline">
            Load more →
          </Link>
        </div>
      )}
    </main>
  );
}

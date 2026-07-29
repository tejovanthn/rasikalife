import type { ConcertLogItem, RejectReason } from '@rasika/core/domain/concert-log-item/client';
import { REJECT_REASONS } from '@rasika/core/domain/concert-log-item/client';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, Link, data, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { requireModerator } from '~/lib/auth.server';

export const meta: MetaFunction = () => [
  { title: 'Setlist: Pending Free Text - Moderator' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;
  const result = await serverClient.setlistModeration.listPendingFreeText.query({
    limit: 20,
    nextToken,
  });
  return data({ items: result.items, nextToken: result.nextToken, hasMore: result.hasMore });
};

export const action: ActionFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'link') {
    const userId = formData.get('userId') as string;
    const eventId = formData.get('eventId') as string;
    const order = Number(formData.get('order'));
    const compositionId = formData.get('compositionId') as string;
    await serverClient.setlistModeration.linkFreeText.mutate({
      userId,
      eventId,
      order,
      compositionId,
    });
    return data({ success: true });
  }

  if (intent === 'reject') {
    const userId = formData.get('userId') as string;
    const eventId = formData.get('eventId') as string;
    const order = Number(formData.get('order'));
    const reason = formData.get('reason') as RejectReason;
    await serverClient.setlistModeration.rejectFreeText.mutate({
      userId,
      eventId,
      order,
      reason,
    });
    return data({ success: true });
  }

  return data({ error: 'Invalid action' }, { status: 400 });
};

export default function SetlistItemsModeration() {
  const { items, nextToken, hasMore } = useLoaderData<{
    items: ConcertLogItem[];
    nextToken?: string;
    hasMore: boolean;
  }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Setlist: Pending Free Text</h1>
        <p className="text-muted-foreground">No pending free-text items. Queue is clear.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Setlist: Pending Free Text</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {items.length} item{items.length !== 1 ? 's' : ''} pending review
      </p>

      <div className="space-y-4">
        {items.map(item => (
          <div
            key={`${item.userId}-${item.eventId}-${item.order}`}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div>
              <p className="font-medium">{item.compositionTitle}</p>
              <p className="text-xs text-muted-foreground">
                Event: {item.eventId} · User: {item.userId} · Order: {item.order}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Form method="post" className="inline-flex gap-2 items-center">
                <input type="hidden" name="intent" value="link" />
                <input type="hidden" name="userId" value={item.userId} />
                <input type="hidden" name="eventId" value={item.eventId} />
                <input type="hidden" name="order" value={item.order} />
                {/* Inline single-row form; a visible label would break the flex row. */}
                <input
                  aria-label="Composition ID to link"
                  type="text"
                  name="compositionId"
                  placeholder="Composition ID"
                  className="px-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  Link
                </Button>
              </Form>

              <Form method="post" className="inline-flex gap-2 items-center">
                <input type="hidden" name="intent" value="reject" />
                <input type="hidden" name="userId" value={item.userId} />
                <input type="hidden" name="eventId" value={item.eventId} />
                <input type="hidden" name="order" value={item.order} />
                <select
                  aria-label="Rejection reason"
                  name="reason"
                  defaultValue={REJECT_REASONS[0]}
                  className="px-2 py-1 text-xs rounded border border-input bg-background"
                >
                  {REJECT_REASONS.map(r => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="ghost" disabled={isSubmitting}>
                  Reject
                </Button>
              </Form>
            </div>
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

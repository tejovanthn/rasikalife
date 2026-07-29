import type { ArtistClaim } from '@rasika/core/domain/artist-claim/client';
import type { ActionFunction, LoaderFunction, MetaFunction } from 'react-router';
import { Form, Link, data, useActionData, useLoaderData, useNavigation } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { requireModerator } from '~/lib/auth.server';

export const meta: MetaFunction = () => [
  { title: 'Artist claims - Moderator' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export const loader: LoaderFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken') ?? undefined;
  const result = await serverClient.artistClaim.pending.query({ limit: 20, nextToken });
  return data({ items: result.items, nextToken: result.nextToken, hasMore: result.hasMore });
};

export const action: ActionFunction = async ({ request }) => {
  await requireModerator(request);
  const serverClient = await createServerClient(request);
  const formData = await request.formData();

  const intent = formData.get('intent') as string;
  const artistId = ((formData.get('artistId') as string) || '').trim();
  const userId = ((formData.get('userId') as string) || '').trim();
  const moderatorNote = ((formData.get('moderatorNote') as string) || '').trim();

  // §8 makes this the audit trail for an identity check that happened entirely off the
  // record — a DM, a reply from an official address, a phone call. Approving without it
  // leaves no trace of why this person was believed, so refuse here as well as in core.
  if (!moderatorNote) {
    return data(
      { error: 'A note is required — it is the only record of how you verified.' },
      {
        status: 400,
      }
    );
  }

  try {
    if (intent === 'approve') {
      await serverClient.artistClaim.approve.mutate({ artistId, userId, moderatorNote });
    } else if (intent === 'reject') {
      await serverClient.artistClaim.reject.mutate({ artistId, userId, moderatorNote });
    } else {
      return data({ error: 'Invalid intent' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to action claim:', error);
    return data({ error: 'Could not action that claim' }, { status: 500 });
  }

  return data({ success: true });
};

export default function ClaimsModeration() {
  const { items, nextToken, hasMore } = useLoaderData<{
    items: ArtistClaim[];
    nextToken?: string;
    hasMore: boolean;
  }>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Artist claims</h1>

      {/* Without this a failed approve looked exactly like a success: the page revalidated,
          the claim was still listed, and nothing said why. Silent failure is the wrong
          default on a write that grants a capability. */}
      {actionData?.error && (
        <p className="mb-4 rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          {actionData.error}
        </p>
      )}
      <p className="mb-6 text-sm text-muted-foreground">
        People asking to manage an artist profile. Establish who they are off the record — a reply
        from an official address, a DM from a known handle — then record what convinced you.
        Approving grants them the profile.
      </p>

      {items.length === 0 ? (
        <p className="text-muted-foreground">No pending claims.</p>
      ) : (
        <ul className="space-y-4">
          {items.map(claim => (
            <li key={`${claim.artistId}#${claim.userId}`} className="rounded-md border p-4">
              <div className="mb-2">
                <Link
                  to={`/artists/${claim.artistId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {claim.artistName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {claim.userName} &middot; {claim.userEmail}
                </p>
                <p className="text-xs text-muted-foreground">
                  Claimed {new Date(claim.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>

              {claim.note && <p className="mb-3 whitespace-pre-wrap text-sm">{claim.note}</p>}

              <Form method="post" className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="artistId" value={claim.artistId} />
                <input type="hidden" name="userId" value={claim.userId ?? ''} />
                <Input
                  aria-label="How did you verify them?"
                  name="moderatorNote"
                  placeholder="How did you verify them?"
                  required
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button type="submit" name="intent" value="approve" disabled={isSubmitting}>
                    Approve
                  </Button>
                  <Button
                    type="submit"
                    name="intent"
                    value="reject"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Reject
                  </Button>
                </div>
              </Form>
            </li>
          ))}
        </ul>
      )}

      {hasMore && nextToken && (
        <Link
          to={`/moderator/claims?nextToken=${encodeURIComponent(nextToken)}`}
          className="mt-6 inline-block text-sm text-primary hover:underline"
        >
          Next page &rarr;
        </Link>
      )}
    </main>
  );
}

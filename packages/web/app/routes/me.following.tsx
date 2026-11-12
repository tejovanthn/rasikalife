import { FollowTargetTypeSchema } from '@rasika/core/domain/follow/client';
import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, data, useFetcher, useLoaderData } from 'react-router';
import { toast } from 'sonner';
import { createServerClient } from '~/api.server';
import { EmptyState } from '~/components/shared/EmptyState';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { requireUser } from '~/lib/auth.server';
import {
  FOLLOW_COPY,
  type FollowRow,
  followInitials,
  followSecondLine,
  groupFollows,
  refollowTarget,
  shareLabel,
  stopSharingTitle,
  unfollowLabel,
  unfollowedToast,
} from '~/lib/follow';

export const meta: MetaFunction = () => [
  { title: `${FOLLOW_COPY.pageTitle} - Rasika.life` },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const client = await createServerClient(request);
  const follows = await client.follow.mine.query();
  return data({ groups: groupFollows(follows) });
}

type ActionResult =
  | { ok: true; intent: 'unfollow'; name: string; type: string; id: string; share: boolean }
  | { ok: true; intent: 'refollow' | 'setShare' }
  | { ok: false; error: string };

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = form.get('intent');
  const type = FollowTargetTypeSchema.safeParse(form.get('type'));
  const id = form.get('id');
  if (!type.success || typeof id !== 'string' || id.length === 0) {
    return data<ActionResult>({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
  const client = await createServerClient(request);
  const share = form.get('share') === 'true';

  try {
    if (intent === 'unfollow') {
      await client.follow.bulkSet.mutate({ targets: [{ type: type.data, id, follow: false }] });
      return data<ActionResult>({
        ok: true,
        intent: 'unfollow',
        name: String(form.get('name') ?? ''),
        type: type.data,
        id,
        share: form.get('wasShared') === 'true',
      });
    }
    if (intent === 'refollow') {
      const target = refollowTarget({
        targetType: type.data,
        targetId: id,
        shareWithTarget: share,
      });
      await client.follow.bulkSet.mutate({ targets: [target] });
      return data<ActionResult>({ ok: true, intent: 'refollow' });
    }
    if (intent === 'setShare' && type.data !== 'artist') {
      await client.follow.setShare.mutate({ type: type.data, id, share });
      return data<ActionResult>({ ok: true, intent: 'setShare' });
    }
  } catch (error) {
    console.error('Following action failed:', error);
    return data<ActionResult>({ ok: false, error: 'Request failed' }, { status: 500 });
  }
  return data<ActionResult>({ ok: false, error: 'Invalid request' }, { status: 400 });
}

export default function MeFollowing() {
  const { groups } = useLoaderData<typeof loader>();
  const unfollow = useFetcher<ActionResult>();
  const undo = useFetcher<ActionResult>();
  const share = useFetcher<ActionResult>();
  const [confirming, setConfirming] = useState<FollowRow | null>(null);

  // The toast lives here, not in the row: the row is gone once the list reloads. It belongs to
  // one unfollow result, so `undo` is deliberately not a dependency.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const result = unfollow.data;
    if (!result || !result.ok || result.intent !== 'unfollow') return;
    toast(unfollowedToast(result.name), {
      action: {
        label: FOLLOW_COPY.undo,
        onClick: () =>
          undo.submit(
            { intent: 'refollow', type: result.type, id: result.id, share: String(result.share) },
            { method: 'post' }
          ),
      },
    });
  }, [unfollow.data]);

  const isSharing = (row: FollowRow) => {
    const form = share.formData;
    if (form && form.get('id') === row.targetId && form.get('type') === row.targetType) {
      return form.get('share') === 'true';
    }
    return row.shareWithTarget;
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="page-title mb-6">{FOLLOW_COPY.pageTitle}</h1>

      {groups.length === 0 && <EmptyState message={FOLLOW_COPY.empty} />}

      {groups.map(group => (
        <section key={group.type} className="mb-8">
          <h2 className="border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.heading}
          </h2>
          <ul>
            {group.rows.map(row => {
              const sharing = isSharing(row);
              return (
                <li
                  key={`${row.targetType}:${row.targetId}`}
                  className="flex items-start gap-3 border-b py-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-accent-foreground"
                  >
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      followInitials(row.targetName)
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link to={row.url} className="block truncate font-bold hover:underline">
                      {row.targetName}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {followSecondLine(row)}
                    </p>

                    {row.canShare && (
                      <share.Form
                        method="post"
                        className="mt-1 flex items-center gap-1"
                        onSubmit={event => {
                          // Turning sharing off asks first. Without JavaScript the form just posts.
                          if (sharing) {
                            event.preventDefault();
                            setConfirming(row);
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="setShare" />
                        <input type="hidden" name="type" value={row.targetType} />
                        <input type="hidden" name="id" value={row.targetId} />
                        <input type="hidden" name="share" value={String(!sharing)} />
                        <span
                          id={`share-${row.targetId}`}
                          className="text-xs text-muted-foreground"
                        >
                          {shareLabel(row.targetName)}
                        </span>
                        <button
                          type="submit"
                          role="switch"
                          aria-checked={sharing}
                          aria-labelledby={`share-${row.targetId}`}
                          className="relative -my-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center md:my-0 md:h-6 md:w-9"
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 rounded-full border transition-colors ${
                              sharing ? 'bg-primary border-primary' : 'bg-muted border-input'
                            }`}
                          />
                          <span
                            aria-hidden="true"
                            className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-background shadow transition-all ${
                              sharing ? 'right-2 md:right-0.5' : 'left-2 md:left-0.5'
                            }`}
                          />
                        </button>
                      </share.Form>
                    )}
                  </div>

                  <unfollow.Form method="post" className="shrink-0">
                    <input type="hidden" name="intent" value="unfollow" />
                    <input type="hidden" name="type" value={row.targetType} />
                    <input type="hidden" name="id" value={row.targetId} />
                    <input type="hidden" name="name" value={row.targetName} />
                    <input type="hidden" name="wasShared" value={String(row.shareWithTarget)} />
                    {/* "Following" at rest, "Unfollow" on hover or focus, as on X. A tap on a
                        touch screen unfollows at once; the Undo toast is the safety net. */}
                    <button
                      type="submit"
                      aria-label={unfollowLabel(row.targetName)}
                      className="group inline-flex min-h-11 min-w-[7rem] items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-destructive hover:text-destructive focus-visible:border-destructive focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
                    >
                      <span className="group-hover:hidden group-focus-visible:hidden">
                        {FOLLOW_COPY.following}
                      </span>
                      <span className="hidden group-hover:inline group-focus-visible:inline">
                        {FOLLOW_COPY.unfollow}
                      </span>
                    </button>
                  </unfollow.Form>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Dialog open={confirming !== null} onOpenChange={open => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming ? stopSharingTitle(confirming.targetName) : ''}</DialogTitle>
            <DialogDescription>{FOLLOW_COPY.stopSharingBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              {FOLLOW_COPY.cancel}
            </Button>
            <Button
              onClick={() => {
                if (confirming) {
                  share.submit(
                    {
                      intent: 'setShare',
                      type: confirming.targetType,
                      id: confirming.targetId,
                      share: 'false',
                    },
                    { method: 'post' }
                  );
                }
                setConfirming(null);
              }}
            >
              {FOLLOW_COPY.stopSharing}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

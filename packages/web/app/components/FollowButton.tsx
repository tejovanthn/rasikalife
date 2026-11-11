import type { FollowTargetType } from '@rasika/core/domain/follow/client';
import { Check, Plus } from 'lucide-react';
import { Link, useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  FOLLOW_ACTION,
  FOLLOW_COPY,
  followerCountLabel,
  optimisticFollow,
  signInToFollowHref,
} from '~/lib/follow';

/**
 * Follow button for a venue, organiser or artist page.
 *
 * Signed in: a form that posts to `/api/follow` (works without JavaScript; with it the state
 * flips at once). Signed out: a link into Google sign-in that returns to `<page>?follow=1`,
 * where the page's loader completes the follow. The count is a number only, never names.
 *
 * `isFollowing` is only ever true for a signed-in viewer, whose document is private; a signed-out
 * page is cached for everyone and always renders "Follow".
 */
export function FollowButton({
  targetType,
  targetId,
  pagePath,
  isSignedIn,
  isFollowing,
  followerCount,
}: {
  targetType: FollowTargetType;
  targetId: string;
  /** The page's own path, to come back to. */
  pagePath: string;
  isSignedIn: boolean;
  isFollowing: boolean;
  followerCount: number;
}) {
  const fetcher = useFetcher();
  const shown = optimisticFollow(
    { isFollowing, count: followerCount },
    fetcher.state !== 'idle' && fetcher.formData !== undefined
  );
  const countLabel = followerCountLabel(shown.count);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isSignedIn ? (
        <fetcher.Form method="post" action={FOLLOW_ACTION}>
          <input type="hidden" name="type" value={targetType} />
          <input type="hidden" name="id" value={targetId} />
          <input type="hidden" name="redirectTo" value={pagePath} />
          <Button
            type="submit"
            size="sm"
            variant={shown.isFollowing ? 'secondary' : 'default'}
            aria-pressed={shown.isFollowing}
            disabled={fetcher.state !== 'idle'}
            className="min-h-11 md:min-h-9"
          >
            {shown.isFollowing ? (
              <>
                <Check aria-hidden="true" className="h-4 w-4" />
                {FOLLOW_COPY.following}
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {FOLLOW_COPY.follow}
              </>
            )}
          </Button>
        </fetcher.Form>
      ) : (
        <Button asChild size="sm" className="min-h-11 md:min-h-9">
          <Link to={signInToFollowHref(pagePath)} rel="nofollow">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {FOLLOW_COPY.follow}
          </Link>
        </Button>
      )}
      {countLabel && <span className="text-sm text-muted-foreground">{countLabel}</span>}
    </div>
  );
}

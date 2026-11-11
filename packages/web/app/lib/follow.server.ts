import type { FollowTargetType } from '@rasika/core/domain/follow/client';
import { redirect } from 'react-router';
import type { createServerClient } from '~/api.server';
import { hasPendingFollow, stripFollowParam } from '~/lib/follow';

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Whether the signed-in viewer follows this target. Signed-out pages never call it: they are
 * cached for everyone, so they always render "Follow". Signed-in documents are `private` (the
 * cache key holds `rasika_session` and `applyDefaultCacheControl` marks them uncacheable), so
 * this per-viewer value cannot reach another reader.
 */
export async function isFollowing(
  client: ServerClient,
  user: { id: string } | null,
  type: FollowTargetType,
  id: string
): Promise<boolean> {
  if (!user) return false;
  try {
    const status = await client.follow.status.query({ targets: [{ type, id }] });
    return status[`${type}:${id}`]?.following === true;
  } catch (error) {
    console.error('Failed to read follow state:', error);
    return false;
  }
}

/**
 * Finishes a follow the reader started signed out. The sign-in callback returns them to
 * `<page>?follow=1`; this follows (idempotent: an existing follow is left as is) and redirects to
 * the same page without the parameter, so a reload or a shared link never repeats it. A failure
 * is logged and the page still loads. A signed-out request is left alone.
 */
export async function completePendingFollow(args: {
  request: Request;
  client: ServerClient;
  user: { id: string } | null;
  type: FollowTargetType;
  id: string;
}): Promise<void> {
  const { request, client, user, type, id } = args;
  if (!user || !hasPendingFollow(request.url)) return;
  try {
    await client.follow.bulkSet.mutate({ targets: [{ type, id, follow: true }] });
  } catch (error) {
    console.error('Failed to complete pending follow:', error);
  }
  throw redirect(stripFollowParam(request.url));
}

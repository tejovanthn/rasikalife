import { FollowTargetTypeSchema } from '@rasika/core/domain/follow/client';
import { data, redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { createServerClient } from '~/api.server';
import { getUser } from '~/lib/auth.server';
import { signInToFollowHref, wantsHtml } from '~/lib/follow';
import { safeRedirectPath } from '~/lib/safe-redirect';

/**
 * Resource route behind the Follow button. A plain form post works without JavaScript: the
 * browser asks for HTML and gets a redirect back to the page. The script path (a fetcher) gets
 * the new state as data. A signed-out post goes through Google and comes back to `?follow=1`.
 */
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const type = FollowTargetTypeSchema.safeParse(form.get('type'));
  const id = form.get('id');
  const back = safeRedirectPath(form.get('redirectTo')) ?? '/';
  if (!type.success || typeof id !== 'string' || id.length === 0) {
    return data({ error: 'Invalid follow request' }, { status: 400 });
  }

  const user = await getUser(request);
  if (!user) throw redirect(signInToFollowHref(back));

  const client = await createServerClient(request);
  try {
    const result = await client.follow.toggle.mutate({ type: type.data, id });
    if (wantsHtml(request.headers.get('Accept'))) throw redirect(back, 303);
    return data(result);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Failed to toggle follow:', error);
    if (wantsHtml(request.headers.get('Accept'))) throw redirect(back, 303);
    return data({ error: "Couldn't update follow." }, { status: 500 });
  }
}

// No UI: a GET goes home.
export function loader() {
  return redirect('/');
}

import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the moderator wizard's group-membership section. Unlike the rest of
// the wizard, these writes land immediately in their own junction entity —
// there is no draft and no Publish step — so add/remove each get their own
// round trip here rather than folding into the artist.update payload.
export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireModerator(request);

  const formData = await request.formData();
  const intent = formData.get('intent') as string;
  const groupId = ((formData.get('groupId') as string) || '').trim();

  if (!groupId) {
    return data({ error: 'Missing group' }, { status: 400 });
  }

  const serverClient = await createServerClient(request);

  if (intent === 'add') {
    const memberId = ((formData.get('memberId') as string) || '').trim() || undefined;
    const memberName = ((formData.get('memberName') as string) || '').trim() || undefined;

    if (!memberId && !memberName) {
      return data({ error: 'Missing member' }, { status: 400 });
    }

    try {
      const member = memberId
        ? await serverClient.artist.addMember.mutate({ groupId, memberId })
        : await serverClient.artist.addMember.mutate({
            groupId,
            memberName: memberName as string,
          });
      return data({ success: true, member });
    } catch (error) {
      console.error('Failed to add member:', error);
      const message = error instanceof Error ? error.message : 'Failed to add member';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'remove') {
    const memberId = ((formData.get('memberId') as string) || '').trim();
    if (!memberId) {
      return data({ error: 'Missing member' }, { status: 400 });
    }

    try {
      await serverClient.artist.removeMember.mutate({ groupId, memberId });
      return data({ success: true, memberId });
    } catch (error) {
      console.error('Failed to remove member:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

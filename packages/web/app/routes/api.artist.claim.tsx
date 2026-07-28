import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the moderator wizard's "hand this profile to the artist" field (§4.3.1). The email
// lands on an ArtistClaim invite row, never on the Artist record — artist.get is public and
// the profile is edge-cached, so an address there would be handed to every visitor.
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
  const artistId = ((formData.get('artistId') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim();

  if (!artistId || !email) {
    return data({ error: 'Missing artist or email' }, { status: 400 });
  }

  const serverClient = await createServerClient(request);

  if (intent === 'invite') {
    const moderatorNote = ((formData.get('moderatorNote') as string) || '').trim();
    // Required because this grant reaches 'verified' with no review — the note is the only
    // record of how the address was known to belong to the artist.
    if (!moderatorNote) {
      return data({ error: 'Say how you know this address is theirs' }, { status: 400 });
    }
    try {
      await serverClient.artistClaim.invite.mutate({ artistId, email, moderatorNote });
      return data({ success: true, intent, email });
    } catch (error) {
      console.error('Failed to invite claimant:', error);
      const message = error instanceof Error ? error.message : 'Could not send that invite';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'revoke') {
    try {
      await serverClient.artistClaim.revokeInvite.mutate({ artistId, email });
      return data({ success: true, intent, email });
    } catch (error) {
      console.error('Failed to revoke invite:', error);
      const message = error instanceof Error ? error.message : 'Could not withdraw that invite';
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

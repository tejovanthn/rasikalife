import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';
import { readOptionalInt } from '~/lib/form-fields';

// Backs the moderator wizard's affiliations section. Like memberships and unlike the rest of
// the wizard, these writes land immediately in their own junction entity — there is no draft
// and no Publish step — so add/remove each get their own round trip here rather than folding
// into the artist.update payload.
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

  if (!artistId) {
    return data({ error: 'Missing artist' }, { status: 400 });
  }

  const serverClient = await createServerClient(request);

  if (intent === 'add') {
    const organiserId = ((formData.get('organiserId') as string) || '').trim() || undefined;
    const organisationName =
      ((formData.get('organisationName') as string) || '').trim() || undefined;

    if (!organiserId && !organisationName) {
      return data({ error: 'Missing organisation' }, { status: 400 });
    }

    // readOptionalInt parses with Number rather than parseInt, so '2o17' is rejected instead
    // of silently becoming 2. A blank field stays undefined.
    const shared = {
      artistId,
      role: ((formData.get('role') as string) || '').trim() || undefined,
      discipline: ((formData.get('discipline') as string) || '').trim() || undefined,
      startYear: readOptionalInt(formData, 'startYear'),
      endYear: readOptionalInt(formData, 'endYear'),
      isCurrent: formData.get('isCurrent') === 'on' || formData.get('isCurrent') === 'true',
    };

    try {
      // The tRPC input is a strict union on exactly one of organiserId / organisationName, so
      // the two branches cannot be collapsed into one object with both keys present.
      const affiliation = organiserId
        ? await serverClient.artist.addAffiliation.mutate({ ...shared, organiserId })
        : await serverClient.artist.addAffiliation.mutate({
            ...shared,
            organisationName: organisationName as string,
          });
      return data({ success: true, affiliation });
    } catch (error) {
      console.error('Failed to add affiliation:', error);
      const message = error instanceof Error ? error.message : 'Failed to add affiliation';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'remove') {
    const organiserId = ((formData.get('organiserId') as string) || '').trim();
    if (!organiserId) {
      return data({ error: 'Missing organisation' }, { status: 400 });
    }

    try {
      await serverClient.artist.removeAffiliation.mutate({ artistId, organiserId });
      return data({ success: true, organiserId });
    } catch (error) {
      console.error('Failed to remove affiliation:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove affiliation';
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

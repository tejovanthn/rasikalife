import type { ActionFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireUser } from '~/lib/auth.server';

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request);
  const serverClient = await createServerClient(request);
  const body = await request.json();

  if (body.intent === 'getUploadUrl') {
    try {
      const result = await serverClient.event.getUploadUrl.mutate({
        fileName: body.fileName,
        contentType: body.contentType,
      });
      return data({
        uploadUrl: result.uploadUrl,
        posterUrl: result.posterUrl,
        posterUploadId: result.uploadId,
      });
    } catch (error) {
      console.error('Failed to get upload URL:', error);
      return data({ error: 'Failed to get upload URL' }, { status: 500 });
    }
  }

  if (body.intent === 'checkHash') {
    try {
      const result = await serverClient.event.checkPosterHash.query({ hash: body.hash });
      return data(result);
    } catch (error) {
      console.error('Failed to check poster hash:', error);
      return data({ duplicate: false });
    }
  }

  if (body.intent === 'extract') {
    try {
      const result = await serverClient.event.extractFromPoster.mutate({
        posterUploadId: body.posterUploadId,
        posterUrl: body.posterUrl,
        posterHash: body.posterHash,
      });
      return data({
        extraction: result.extraction,
        festivalId: result.festivalId,
        eventIds: result.eventIds,
      });
    } catch (error) {
      console.error('[API] Failed to extract from poster:', error);
      const message =
        error instanceof Error && error.message.includes('GEMINI_API_KEY')
          ? 'AI extraction service is not configured. Please contact support.'
          : error instanceof Error && error.message.includes('fetch')
            ? 'Could not retrieve the uploaded image. Please try again.'
            : 'Failed to extract event details from the poster. Please try again or enter details manually.';
      return data({ error: message }, { status: 500 });
    }
  }

  if (body.intent === 'submit') {
    try {
      const results = await serverClient.event.submitVerified.mutate({
        festivalId: body.festivalId,
        festivalData: body.festivalData,
        events: body.events,
      });
      return data({ success: true, eventIds: results.map((e: { id: string }) => e.id) });
    } catch (error) {
      console.error('Failed to submit events:', error);
      return data({ error: 'Failed to submit events' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

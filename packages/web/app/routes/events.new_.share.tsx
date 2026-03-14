import type { ActionFunction, LoaderFunction } from 'react-router';
import { redirect } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireUser } from '~/lib/auth.server';

async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeContentType(type: string | null | undefined): string {
  if (!type) return 'image/jpeg';
  if (type === 'image/jpg') return 'image/jpeg';
  return type;
}

export const loader: LoaderFunction = async () => {
  return redirect('/events/new');
};

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request);
  const serverClient = await createServerClient(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Malformed multipart body (can happen with some Android share sources)
    return redirect('/events/new');
  }

  const fileEntries = formData.getAll('files');

  // Accept both File and Blob (some Lambda/Node environments return Blob)
  const validFiles = fileEntries.filter(
    (f): f is File => (f instanceof File || f instanceof Blob) && f.size > 0
  ) as File[];

  if (!validFiles.length) {
    return redirect('/events/new');
  }

  const allEventIds: string[] = [];
  let lastFestivalId: string | undefined;
  let lastPosterUrl = '';

  for (const file of validFiles) {
    try {
      const buffer = await file.arrayBuffer();
      const hash = await computeHash(buffer);
      const contentType = safeContentType(file.type);

      // Skip duplicates, collecting their IDs
      try {
        const hashResult = await serverClient.event.checkPosterHash.query({ hash });
        if (hashResult.duplicate) {
          if (hashResult.festivalId) lastFestivalId = hashResult.festivalId;
          allEventIds.push(...hashResult.eventIds);
          lastPosterUrl = hashResult.posterUrl || lastPosterUrl;
          continue;
        }
      } catch {
        // ignore hash check failures, proceed with upload
      }

      // Get presigned upload URL — filename is ignored, KSUID used as key
      const uploadResult = await serverClient.event.getUploadUrl.mutate({
        fileName: '',
        contentType,
      });
      lastPosterUrl = uploadResult.posterUrl;

      // Upload to S3 from the server using the presigned URL
      const uploadResponse = await fetch(uploadResult.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: buffer,
      });

      if (!uploadResponse.ok) {
        console.error(`[share] S3 upload failed: ${uploadResponse.status}`);
        continue;
      }

      // Extract event details with Gemini
      const result = await serverClient.event.extractFromPoster.mutate({
        posterUploadId: uploadResult.uploadId,
        posterUrl: uploadResult.posterUrl,
        posterHash: hash,
      });

      if (result.festivalId) lastFestivalId = result.festivalId;
      allEventIds.push(...result.eventIds);
    } catch (err) {
      console.error('[share] Failed to process file:', err);
    }
  }

  if (!allEventIds.length && !lastFestivalId) {
    return redirect('/events/new');
  }

  const params = new URLSearchParams();
  if (lastFestivalId) params.set('festivalId', lastFestivalId);
  for (const id of allEventIds) params.append('eventId', id);
  if (lastPosterUrl) params.set('posterUrl', lastPosterUrl);

  return redirect(`/events/new/verify?${params.toString()}`);
};

// Shown briefly while the share action processes (SSR loading state)
export default function ShareTarget() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-medium">Processing shared files...</p>
        <p className="text-sm text-muted-foreground">
          Extracting event details from your poster. This may take a few seconds.
        </p>
      </div>
    </main>
  );
}

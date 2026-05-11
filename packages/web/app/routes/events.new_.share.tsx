import { useEffect } from 'react';
import type { ActionFunction, LoaderFunction } from 'react-router';
import { data, redirect, useLoaderData, useNavigate } from 'react-router';
import { createServerClient } from '~/api.server';
import { getUser, requireUser } from '~/lib/auth.server';

// ---------- Client-side IndexedDB helpers ----------

function openShareDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rasika-share', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readSharedFiles(): Promise<File[]> {
  try {
    const db = await openShareDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('files', 'readonly').objectStore('files').getAll();
      req.onsuccess = () => resolve((req.result as File[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function clearSharedFiles(): Promise<void> {
  try {
    const db = await openShareDB();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('files', 'readwrite').objectStore('files').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // best-effort cleanup
  }
}

// ---------- Server-side helpers ----------

async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

type FileResult = {
  eventIds: string[];
  festivalId?: string;
  posterUrl?: string;
};

async function processSharedFile(file: File, client: ServerClient): Promise<FileResult> {
  const buffer = await file.arrayBuffer();
  const hash = await computeHash(buffer);
  const contentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type || 'image/jpeg';

  const existing = await client.event.checkPosterHash.query({ hash }).catch(() => null);
  if (existing?.duplicate) {
    return {
      eventIds: existing.eventIds,
      festivalId: existing.festivalId,
      posterUrl: existing.posterUrl,
    };
  }

  const upload = await client.event.getUploadUrl.mutate({ fileName: file.name, contentType });
  const res = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);

  const extracted = await client.event.extractFromPoster.mutate({
    posterUploadId: upload.uploadId,
    posterUrl: upload.posterUrl,
    posterHash: hash,
  });
  return {
    eventIds: extracted.eventIds,
    festivalId: extracted.festivalId,
    posterUrl: upload.posterUrl,
  };
}

// ---------- Loader ----------

type LoaderData = { mode: 'sw' };

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.has('sw')) {
    const user = await getUser(request);
    if (!user) {
      return redirect(`/auth/login?redirectTo=${encodeURIComponent('/events/new/share?sw=1')}`);
    }
    return data({ mode: 'sw' as const } satisfies LoaderData);
  }
  return redirect('/events/new');
};

// ---------- Action ----------

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request);
  const client = await createServerClient(request);

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll('files') ?? []).filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (!files.length) return redirect('/events/new');

  const results = await Promise.all(
    files.map(file =>
      processSharedFile(file, client).catch(err => {
        console.error('[share] file failed:', err);
        return null;
      })
    )
  );

  const successful = results.filter((r): r is FileResult => r !== null);
  const eventIds = successful.flatMap(r => r.eventIds);
  const festivalId = successful
    .slice()
    .reverse()
    .find(r => r.festivalId)?.festivalId;
  const posterUrl = successful
    .slice()
    .reverse()
    .find(r => r.posterUrl)?.posterUrl;

  if (!eventIds.length && !festivalId) return redirect('/events/new');

  const params = new URLSearchParams();
  if (festivalId) params.set('festivalId', festivalId);
  for (const id of eventIds) params.append('eventId', id);
  if (posterUrl) params.set('posterUrl', posterUrl);
  return redirect(`/events/new/verify?${params}`);
};

// ---------- Component ----------

export default function ShareTarget() {
  const loaderData = useLoaderData() as LoaderData;
  const navigate = useNavigate();

  useEffect(() => {
    if (loaderData?.mode !== 'sw') return;
    let cancelled = false;

    (async () => {
      const files = await readSharedFiles();
      if (cancelled) return;
      if (!files.length) return navigate('/events/new');

      const body = new FormData();
      for (const file of files) body.append('files', file);

      // ?client=1 tells the SW to pass this POST straight to the server
      const res = await fetch('/events/new/share?client=1', { method: 'POST', body });
      await clearSharedFiles();
      window.location.href = res.url || '/events/new';
    })().catch(() => navigate('/events/new'));

    return () => {
      cancelled = true;
    };
  }, [loaderData, navigate]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-medium">Processing shared files...</p>
        <p className="text-sm text-muted-foreground">
          Extracting event details from your poster. This may take a few seconds.
        </p>
      </div>
    </main>
  );
}

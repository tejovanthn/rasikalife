import { AlertTriangle, FileText, ImageIcon, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, data, useLoaderData, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '~/components/auth-context';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { generateFestivalUrl } from '~/lib/url-slug';

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const festivalId = url.searchParams.get('festivalId');
  const festivalName = url.searchParams.get('festivalName');
  return data({ user, festivalId, festivalName });
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Add Event - Rasika.life' },
    {
      name: 'description',
      content: 'Upload an event poster and let AI extract event details automatically.',
    },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
};

type UploadStep = 'idle' | 'hashing' | 'uploading' | 'extracting' | 'error';

interface DuplicateInfo {
  posterUrl: string;
  festivalId?: string;
  eventIds: string[];
}

interface FileEntry {
  file: File;
  preview: string | null; // data URL for images, null for PDFs
  hash: string | null;
}

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function isInstagramPostUrl(url: string): boolean {
  return /instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]+/.test(url);
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function NewEvent() {
  const { festivalId, festivalName } = useLoaderData<typeof loader>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [step, setStep] = useState<UploadStep>('idle');
  const [processingIndex, setProcessingIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [extractingMessage, setExtractingMessage] = useState('Identifying poster type...');
  const [urlInput, setUrlInput] = useState('');
  const [urlStep, setUrlStep] = useState<'idle' | 'extracting' | 'error'>('idle');
  const [urlError, setUrlError] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isModerator = user?.role === 'moderator' || user?.role === 'admin';
  const isProcessing = step === 'uploading' || step === 'extracting' || step === 'hashing';

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: File[] = [];
    for (const f of newFiles) {
      if (!VALID_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: exceeds 20MB limit`);
        continue;
      }
      validFiles.push(f);
    }
    if (!validFiles.length) return;

    setError(null);
    setDuplicateInfo(null);

    const newEntries: FileEntry[] = validFiles.map(f => ({ file: f, preview: null, hash: null }));
    setEntries(prev => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      if (entry.file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
          setEntries(curr =>
            curr.map(ce =>
              ce.file === entry.file ? { ...ce, preview: e.target?.result as string } : ce
            )
          );
        };
        reader.readAsDataURL(entry.file);
      }

      computeFileHash(entry.file)
        .then(hash => {
          setEntries(curr => curr.map(ce => (ce.file === entry.file ? { ...ce, hash } : ce)));
        })
        .catch(() => {});
    }
  }, []);

  const removeFile = useCallback((file: File) => {
    setEntries(prev => prev.filter(e => e.file !== file));
    setError(null);
    setDuplicateInfo(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length) addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const navigateToVerify = (info: DuplicateInfo) => {
    const params = new URLSearchParams();
    const resolvedFestivalId = info.festivalId || festivalId || undefined;
    if (resolvedFestivalId) params.set('festivalId', resolvedFestivalId);
    for (const id of info.eventIds) {
      params.append('eventId', id);
    }
    params.set('posterUrl', info.posterUrl);
    if (festivalId) params.set('existingFestival', '1');
    navigate(`/events/new/verify?${params.toString()}`);
  };

  const handleUploadAndExtract = async (skipDuplicateCheck = false) => {
    if (!entries.length) return;

    try {
      setStep('uploading');
      setError(null);
      setDuplicateInfo(null);

      const isSingle = entries.length === 1;
      const allEventIds: string[] = [];
      let lastFestivalId: string | undefined;
      let lastPosterUrl = '';
      let errorCount = 0;

      for (let i = 0; i < entries.length; i++) {
        setProcessingIndex(i);
        const { file, hash } = entries[i];

        // Duplicate check
        if (!skipDuplicateCheck && hash) {
          setStep('hashing');
          try {
            const hashResponse = await fetch('/events/new/api', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ intent: 'checkHash', hash }),
            });
            if (hashResponse.ok) {
              const hashResult = await hashResponse.json();
              if (hashResult.duplicate) {
                if (isSingle) {
                  setStep('idle');
                  setDuplicateInfo({
                    posterUrl: hashResult.posterUrl,
                    festivalId: hashResult.festivalId,
                    eventIds: hashResult.eventIds,
                  });
                  return;
                }
                toast.info(`${file.name}: already processed, using existing events`);
                if (hashResult.festivalId) lastFestivalId = hashResult.festivalId;
                allEventIds.push(...hashResult.eventIds);
                lastPosterUrl = hashResult.posterUrl || lastPosterUrl;
                continue;
              }
            }
          } catch {
            // ignore hash check failures
          }
        }

        setStep('uploading');

        try {
          // Get presigned URL
          const response = await fetch('/events/new/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intent: 'getUploadUrl',
              fileName: file.name,
              contentType: file.type,
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.error || 'Failed to get upload URL');
          }

          const { uploadUrl, posterUrl, posterUploadId } = await response.json();
          lastPosterUrl = posterUrl;

          // Upload to S3
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
          }

          // Extract with Gemini
          setStep('extracting');
          setExtractingMessage('Identifying poster type...');
          messageTimerRef.current = setTimeout(() => {
            setExtractingMessage('Extracting event details...');
          }, 3000);

          const extractResponse = await fetch('/events/new/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intent: 'extract',
              posterUploadId,
              posterUrl,
              posterHash: hash,
              existingFestivalId: festivalId || undefined,
            }),
          });

          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);

          if (!extractResponse.ok) {
            const err = await extractResponse.json().catch(() => null);
            throw new Error(err?.error || 'Failed to extract event details');
          }

          const { festivalId: extractedFestivalId, eventIds } = await extractResponse.json();
          if (extractedFestivalId) lastFestivalId = extractedFestivalId;
          allEventIds.push(...eventIds);
        } catch (err) {
          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
          errorCount++;
          const message = err instanceof Error ? err.message : 'Upload failed';
          if (isSingle) {
            setStep('error');
            setError(message);
            toast.error(message);
            return;
          }
          toast.error(`${file.name}: ${message}`);
        }
      }

      if (!allEventIds.length && !lastFestivalId) {
        if (errorCount > 0) {
          setStep('error');
          setError(`Failed to process ${errorCount} file${errorCount > 1 ? 's' : ''}.`);
        } else {
          setStep('idle');
        }
        return;
      }

      const params = new URLSearchParams();
      const resolvedFestivalId = lastFestivalId || festivalId || undefined;
      if (resolvedFestivalId) params.set('festivalId', resolvedFestivalId);
      for (const id of allEventIds) params.append('eventId', id);
      if (lastPosterUrl) params.set('posterUrl', lastPosterUrl);
      if (festivalId) params.set('existingFestival', '1');
      navigate(`/events/new/verify?${params.toString()}`);
    } catch (err) {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      setStep('error');
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      toast.error(message);
    }
  };

  const handleExtractFromUrl = async () => {
    if (!isInstagramPostUrl(urlInput)) return;
    setUrlStep('extracting');
    setUrlError(null);
    try {
      const response = await fetch('/events/new/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'extractFromInstagram',
          instagramUrl: urlInput,
          existingFestivalId: festivalId || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to extract from Instagram URL');
      }
      navigateToVerify({
        posterUrl: '',
        festivalId: result.festivalId,
        eventIds: result.eventIds,
      });
    } catch (err) {
      setUrlStep('error');
      setUrlError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const handleRetry = () => {
    setStep('idle');
    setError(null);
    setDuplicateInfo(null);
  };

  const isMultiple = entries.length > 1;
  const progressLabel = isMultiple ? ` (${processingIndex + 1}/${entries.length})` : '';

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="page-title">Add Event</h1>
        {festivalId && festivalName ? (
          <p className="text-lg text-muted-foreground">
            Adding events to{' '}
            <Link
              to={generateFestivalUrl(festivalName, festivalId)}
              className="text-primary font-medium hover:underline"
            >
              {festivalName}
            </Link>
          </p>
        ) : (
          <p className="text-lg text-muted-foreground">
            Upload an event poster and we'll extract the details automatically.
          </p>
        )}
      </header>

      <button
        type="button"
        className={`
          relative border-2 border-dashed rounded-lg p-8 w-full
          transition-colors cursor-pointer text-left
          ${entries.length > 0 ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={e => {
            const selectedFiles = Array.from(e.target.files ?? []);
            if (selectedFiles.length) addFiles(selectedFiles);
            // Reset input so the same file can be re-selected if needed
            e.target.value = '';
          }}
        />

        {entries.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {entries.map(({ file, preview }) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="relative group"
                >
                  {file.type === 'application/pdf' ? (
                    <div className="aspect-[3/4] rounded-lg bg-muted flex flex-col items-center justify-center gap-2 p-3 overflow-hidden">
                      <FileText className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground text-center line-clamp-3 break-all">
                        {file.name}
                      </p>
                    </div>
                  ) : preview ? (
                    <img
                      src={preview}
                      alt={file.name}
                      className="aspect-[3/4] w-full rounded-lg object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="aspect-[3/4] rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => {
                      e.stopPropagation();
                      removeFile(file);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {entries.length} file{entries.length > 1 ? 's' : ''} selected · Click or drop to add
              more
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium">Drop poster images here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports: JPG, PNG, WebP, PDF · Up to 20MB each · Multiple files supported
            </p>
          </div>
        )}
      </button>

      {duplicateInfo && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                This poster has already been processed
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Events from this poster already exist. You can view them or upload a different
                poster.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigateToVerify(duplicateInfo)}>
              View existing events
            </Button>
            {isModerator && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDuplicateInfo(null);
                  handleUploadAndExtract(true);
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Re-extract anyway
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      )}

      {step === 'hashing' && (
        <p className="mt-4 text-sm text-muted-foreground text-center">
          Checking for duplicates{progressLabel}...
        </p>
      )}

      {step === 'extracting' && (
        <p className="mt-4 text-sm text-muted-foreground text-center">
          {extractingMessage}
          {progressLabel} This may take a few seconds...
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => handleUploadAndExtract()}
          disabled={!entries.length || isProcessing}
          size="lg"
        >
          {step === 'hashing' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking{progressLabel}...
            </>
          )}
          {step === 'uploading' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading{progressLabel}...
            </>
          )}
          {step === 'extracting' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {extractingMessage}
              {progressLabel}
            </>
          )}
          {(step === 'idle' || step === 'error') && (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {entries.length > 1 ? 'Upload & Extract All' : 'Upload & Extract'}
            </>
          )}
        </Button>
      </div>
      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or paste Instagram URL</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="url"
            placeholder="https://www.instagram.com/p/..."
            value={urlInput}
            onChange={e => {
              setUrlInput(e.target.value);
              setUrlError(null);
              if (urlStep === 'error') setUrlStep('idle');
            }}
            disabled={urlStep === 'extracting' || isProcessing}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            onClick={handleExtractFromUrl}
            disabled={!isInstagramPostUrl(urlInput) || urlStep === 'extracting' || isProcessing}
          >
            {urlStep === 'extracting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              'Extract'
            )}
          </Button>
        </div>

        {urlError && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{urlError}</span>
          </div>
        )}

        {urlStep === 'extracting' && (
          <p className="mt-2 text-sm text-muted-foreground">
            Fetching image from Instagram and extracting event details...
          </p>
        )}
      </div>
    </main>
  );
}

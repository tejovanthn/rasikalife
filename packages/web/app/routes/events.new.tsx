import { AlertTriangle, ImageIcon, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { data, useLoaderData, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '~/components/auth-context';
import { Button } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  return data({ user });
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

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function NewEvent() {
  useLoaderData<typeof loader>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [extractingMessage, setExtractingMessage] = useState('Identifying poster type...');
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isModerator = user?.role === 'moderator' || user?.role === 'admin';

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  const handleFile = useCallback(async (selectedFile: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setDuplicateInfo(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = e => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Compute hash in background
    try {
      const hash = await computeFileHash(selectedFile);
      setFileHash(hash);
    } catch {
      setFileHash(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const navigateToVerify = (info: DuplicateInfo) => {
    const params = new URLSearchParams();
    if (info.festivalId) params.set('festivalId', info.festivalId);
    for (const id of info.eventIds) {
      params.append('eventId', id);
    }
    params.set('posterUrl', info.posterUrl);
    navigate(`/events/new/verify?${params.toString()}`);
  };

  const handleUploadAndExtract = async (skipDuplicateCheck = false) => {
    if (!file) return;

    try {
      setStep('uploading');
      setError(null);
      setDuplicateInfo(null);

      // Check for duplicate poster before uploading
      if (!skipDuplicateCheck && fileHash) {
        setStep('hashing');
        const hashResponse = await fetch('/events/new/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: 'checkHash', hash: fileHash }),
        });

        if (hashResponse.ok) {
          const hashResult = await hashResponse.json();
          if (hashResult.duplicate) {
            setStep('idle');
            setDuplicateInfo({
              posterUrl: hashResult.posterUrl,
              festivalId: hashResult.festivalId,
              eventIds: hashResult.eventIds,
            });
            return;
          }
        }
      }

      setStep('uploading');

      // Step 1: Get presigned upload URL
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

      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Step 3: Extract with Gemini (two-step: classify then extract)
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
          posterHash: fileHash,
        }),
      });

      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);

      if (!extractResponse.ok) {
        const err = await extractResponse.json().catch(() => null);
        throw new Error(err?.error || 'Failed to extract event details');
      }

      const { festivalId, eventIds } = await extractResponse.json();

      // Step 4: Redirect to verification wizard
      const params = new URLSearchParams();
      if (festivalId) params.set('festivalId', festivalId);
      for (const id of eventIds) {
        params.append('eventId', id);
      }
      params.set('posterUrl', posterUrl);

      navigate(`/events/new/verify?${params.toString()}`);
    } catch (err) {
      setStep('error');
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      toast.error(message);
    }
  };

  const handleRetry = () => {
    setStep('idle');
    setError(null);
    setDuplicateInfo(null);
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="page-title">Add Event</h1>
        <p className="text-lg text-muted-foreground">
          Upload an event poster and we'll extract the details automatically.
        </p>
      </header>

      <button
        type="button"
        className={`
          relative border-2 border-dashed rounded-lg p-8 w-full
          transition-colors cursor-pointer text-left
          ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) handleFile(selectedFile);
          }}
        />

        {preview ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={preview}
              alt="Poster preview"
              className="max-h-96 rounded-lg object-contain"
            />
            <p className="text-sm text-muted-foreground">{file?.name}</p>
            <p className="text-xs text-muted-foreground">Click or drop to change image</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium">Drop poster image here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <p className="text-xs text-muted-foreground">Supports: JPG, PNG, WebP (max 10MB)</p>
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

      {step === 'extracting' && (
        <p className="mt-4 text-sm text-muted-foreground text-center">
          {extractingMessage} This may take a few seconds...
        </p>
      )}

      {step === 'hashing' && (
        <p className="mt-4 text-sm text-muted-foreground text-center">Checking for duplicates...</p>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => handleUploadAndExtract()}
          disabled={!file || step === 'uploading' || step === 'extracting' || step === 'hashing'}
          size="lg"
        >
          {step === 'hashing' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          )}
          {step === 'uploading' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading poster...
            </>
          )}
          {step === 'extracting' && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {extractingMessage}
            </>
          )}
          {(step === 'idle' || step === 'error') && (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload & Extract
            </>
          )}
        </Button>
      </div>
    </main>
  );
}

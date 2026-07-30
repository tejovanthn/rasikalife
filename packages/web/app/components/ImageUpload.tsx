import { Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Label } from '~/components/ui/label';
import { uploadImageFile } from '~/lib/image-upload';

interface ImageUploadProps {
  urlFieldName: string;
  uploadIdFieldName: string;
  currentUrl?: string;
  entityType: 'venue' | 'organiser' | 'artist';
  label?: string;
  /** Called after a successful upload. Lets a caller that submits via a
   *  fetcher (rather than the surrounding form) read the result, since the
   *  hidden inputs only help a native form submit. */
  onUploaded?: (result: { imageUrl: string; uploadId: string }) => void;
}

export function ImageUpload({
  urlFieldName,
  uploadIdFieldName,
  currentUrl,
  entityType,
  label = 'Photo',
  onUploaded,
}: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState(currentUrl || '');
  const [uploadId, setUploadId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentUrl || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError('');
    setIsUploading(true);

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const { imageUrl: finalImageUrl, uploadId: newUploadId } = await uploadImageFile(
        file,
        entityType
      );
      setImageUrl(finalImageUrl);
      setUploadId(newUploadId);
      onUploaded?.({ imageUrl: finalImageUrl, uploadId: newUploadId });
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      setPreview(currentUrl || '');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setImageUrl('');
    setUploadId('');
    setPreview('');
    setError('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const inputId = `image-upload-${urlFieldName}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-start gap-4">
        <div
          className="relative h-24 w-24 rounded-md border-2 border-dashed border-input bg-muted flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
          onClick={() => !isUploading && inputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-1 flex-1">
          <p className="text-xs text-muted-foreground">
            Click to {preview ? 'change' : 'upload'} image
          </p>
          {preview && !isUploading && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input type="hidden" name={urlFieldName} value={imageUrl} />
      <input type="hidden" name={uploadIdFieldName} value={uploadId} />
    </div>
  );
}

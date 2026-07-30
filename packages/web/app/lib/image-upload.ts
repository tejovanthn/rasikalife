export type ImageEntityType = 'venue' | 'organiser' | 'artist';

export interface UploadedImage {
  imageUrl: string;
  uploadId: string;
  /** Intrinsic pixel size, when the browser could decode the file. */
  width?: number;
  height?: number;
}

/**
 * Read a file's intrinsic dimensions before it is uploaded.
 *
 * The browser is the cheapest place to learn this. Sharp already runs in the image-processor
 * and the OG lambda, but neither is on this path, and adding a round trip to ask the server
 * about a file the client is holding would be perverse.
 *
 * Failure is not an error: a file the browser cannot decode still uploads, it simply has no
 * dimensions recorded. Callers treat them as optional because every photo stored before this
 * existed has none either.
 */
async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('could not decode image'));
      img.src = objectUrl;
    });
    // 0 would be a decode that technically succeeded and told us nothing; treat it as absent
    // rather than storing a zero that a later aspect-ratio would divide by.
    return size.width > 0 && size.height > 0 ? size : {};
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Presign, upload, and report back where the image landed.
 *
 * Extracted so the single-image picker and the gallery's multi-select share one
 * implementation. They had diverged in the obvious direction: the gallery could only ever
 * take one file at a time because the only uploader read `files[0]`.
 *
 * Throws on failure, so a caller uploading several can use `Promise.allSettled` and report
 * which ones landed rather than losing the batch to one bad file.
 */
export async function uploadImageFile(
  file: File,
  entityType: ImageEntityType
): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`);
  }

  // Started before the presign so the decode overlaps the round trip.
  const dimensions = readDimensions(file);

  const formData = new FormData();
  formData.append('entityType', entityType);
  formData.append('fileName', file.name);
  formData.append('contentType', file.type);

  const presign = await fetch('/api/upload/image', { method: 'POST', body: formData });
  if (!presign.ok) {
    throw new Error('Could not get an upload URL');
  }
  const { uploadUrl, imageUrl, uploadId } = (await presign.json()) as {
    uploadUrl: string;
    imageUrl: string;
    uploadId: string;
  };

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  // The presigned PUT is the step that actually stores the bytes, and it was previously
  // unchecked: a rejected upload still resolved and the caller recorded a URL serving nothing.
  if (!put.ok) {
    throw new Error(`Upload failed for ${file.name}`);
  }

  return { imageUrl, uploadId, ...(await dimensions) };
}

# ADR-028: CloudFront CDN + Async WebP Conversion for Event Posters

## Status
Accepted

## Context
Event posters are user-uploaded images (JPEG/PNG) served to visitors worldwide. Serving raw uploaded images directly from S3 has several problems:
- S3 per-request pricing adds up at scale
- No edge caching — every request goes to us-east-1
- Original upload formats (JPEG/PNG) are larger than modern equivalents
- No cache-control headers by default

We needed a strategy for efficient, globally-cached poster delivery with format optimization.

## Decision
Use a **CloudFront CDN fronting the EventPosters S3 bucket**, with **async WebP conversion via S3-triggered Lambda** (Sharp).

**Upload flow:**
1. Client uploads original image to S3 (via presigned URL — ADR-027)
2. S3 `ObjectCreated` notification triggers `ImageProcessor` Lambda
3. Lambda converts to WebP (quality 82, effort 4) and writes `{originalKey}.webp` alongside the original
4. CDN serves from cache on subsequent requests; 1-year immutable cache headers on WebP files

**Serving:** Frontend references the WebP URL directly (`posterUrl` stored on the event record points to the `.webp` path after upload).

**Three separate S3 notifications** (`.jpg`, `.jpeg`, `.png`) prevent the Lambda from triggering on its own `.webp` output.

## Consequences

### Positive
- ✅ **Global edge caching**: CloudFront PoPs serve cached images with low latency worldwide
- ✅ **~30-50% smaller files**: WebP at quality 82 vs. original JPEG/PNG
- ✅ **Non-blocking**: Conversion happens asynchronously — upload and event creation aren't delayed
- ✅ **1-year immutable cache**: WebP files never change (content-addressed via KSUID upload path), so `max-age=31536000, immutable` is safe
- ✅ **No double-trigger**: Extension filtering prevents the converter triggering on its own output

### Negative
- ❌ **WebP-only**: No JPEG fallback for older browsers (IE11, old Safari). Acceptable given target audience and browser stats.
- ❌ **Race condition**: Brief window where CloudFront may cache the original before WebP exists (first visitor post-upload)
- ❌ **Conversion failures are silent**: If Lambda fails, original remains but no WebP is created; frontend shows no image or broken link
- ❌ **One size fits all**: No responsive image variants (thumbnails, srcset)
- ❌ **Extra S3 storage**: Both original and WebP are stored

## Alternatives Considered

### On-demand image transformation (CloudFront + Lambda@Edge)
- **Pros**: Transform on request, format negotiation, responsive sizes
- **Cons**: Complex, adds latency to first request, expensive per-transformation
- **Why rejected**: Over-engineered for current scale; async conversion is simpler

### Serve originals directly from S3
- **Pros**: No infrastructure
- **Cons**: No CDN, no compression, S3 request pricing
- **Why rejected**: Poor performance and cost at scale

### Imgix / Cloudinary
- **Pros**: Managed, responsive images, format negotiation
- **Cons**: External vendor, per-transformation cost, unnecessary at current scale
- **Why rejected**: Cost and vendor dependency

## Implementation Details

**Infrastructure** (`infra/event-posters.ts`):
- `sst.aws.Bucket('EventPosters', { public: true })`
- `sst.aws.Cdn('EventPostersCdn')` with `CachingOptimized` managed policy
- Lambda: 1024MB memory, 5-minute timeout, triggered on `posters/` prefix with `.jpg`/`.jpeg`/`.png` suffixes

**Converter** (`packages/image-processor/src/handler.ts`):
- Sharp: `toFormat('webp', { quality: 82, effort: 4 })`
- Output key: `{originalKey}` with extension replaced by `.webp`
- Skips non-image content types; continues on per-file errors

## References
- `infra/event-posters.ts` — CDN and notification infrastructure
- `packages/image-processor/src/handler.ts` — WebP conversion Lambda
- ADR-027: Presigned URL uploads

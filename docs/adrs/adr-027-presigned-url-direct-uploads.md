# ADR-027: Presigned URL Pattern for Direct S3 Uploads

## Status
Accepted

## Context
Users submit event posters (JPEG/PNG images) when creating events. We needed to decide how to accept these uploads:

1. **Proxied upload**: Client → Lambda → S3. Lambda receives the raw bytes and forwards to S3.
2. **Direct upload**: Client gets a short-lived signed URL from the server, then PUTs directly to S3.

Lambda has a 6MB synchronous payload limit via API Gateway and a function timeout. Large images would exceed this, and even smaller images add unnecessary Lambda execution time and data transfer cost. The Lambda is also not the right place to buffer binary payloads.

## Decision
Use **AWS presigned URLs** for direct client-to-S3 uploads.

The server generates a presigned `PutObject` URL (5-minute expiry) and returns it along with a KSUID-based `uploadId`. The client PUTs the file directly to S3. The server never handles the binary data.

URL pattern: `posters/{uploadId}/{originalFileName}`
CDN URL returned immediately: `{CDN_URL}/posters/{uploadId}/{originalFileName}`

## Consequences

### Positive
- ✅ **No Lambda payload limits**: Images go directly to S3, bypassing API Gateway/Lambda
- ✅ **Cheaper**: Lambda executes only for URL generation (~10ms), not for file transfer
- ✅ **Faster uploads**: Client uploads in parallel with any other UI work; no double transfer
- ✅ **Scalable**: S3 handles any upload concurrency without Lambda scaling pressure
- ✅ **Poster URL is known upfront**: Client can reference the CDN URL before the upload completes

### Negative
- ❌ **Client complexity**: Multi-step flow (get URL → upload → submit form) vs. single form POST
- ❌ **Bucket must accept PUT from clients**: Requires appropriate S3 bucket policy
- ❌ **Orphaned uploads**: If the user abandons the form, the uploaded file remains in S3
- ❌ **5-minute window**: Upload must complete before presigned URL expires

## Alternatives Considered

### Proxied Lambda Upload
- **Pros**: Simpler client code, easier access control, can validate before storing
- **Cons**: 6MB API Gateway limit, Lambda timeout risk for slow connections, unnecessary cost
- **Why rejected**: Not viable for arbitrary-size poster images

### Multipart Upload via Lambda
- **Pros**: Handles very large files
- **Cons**: Significantly more complex, not needed for poster-size images
- **Why rejected**: Overkill; presigned URL is sufficient

## Implementation Details

- Presigned URL generation: `@aws-sdk/s3-request-presigner` `getSignedUrl()`
- Expiry: 300 seconds (5 minutes)
- Upload key: `posters/{KSUID}/{originalFileName}`
- `uploadId` (KSUID) is stored on the event/festival record for traceability
- After upload, the S3 key triggers async WebP conversion (see ADR-028)
- Deduplication uses a SHA-256 hash of the image checked before generating a presigned URL (see ADR-026)

## References
- `packages/core/src/domain/event/s3.ts` — presigned URL generation
- ADR-026: Gemini AI event extraction (poster deduplication via hash)
- ADR-028: CloudFront CDN and image optimization pipeline

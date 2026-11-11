import { database } from './database';

/**
 * Private files: QR batch PDFs (`qr-batches/{batchId}.pdf`) and, in phase 8, follower exports
 * (`exports/{targetType}/{targetId}/{timestamp}.csv`).
 *
 * Deliberately not `eventPostersBucket`, which is public and sits behind a CDN. Nothing here has
 * a public policy or a CDN: every read is a presigned URL that the tRPC function signs after its
 * own access check, valid for 5 minutes. Deliberately not `classUploadsBucket` either, which is
 * for payment screenshots and has its own namespace rules.
 */
export const privateFilesBucket = new sst.aws.Bucket('PrivateFiles');

// Exports hold personal details a sabha chose to receive. Seven days is longer than anyone needs.
new aws.s3.BucketLifecycleConfigurationV2('PrivateFilesLifecycle', {
  bucket: privateFilesBucket.name,
  rules: [
    {
      id: 'expire-exports',
      status: 'Enabled',
      filter: { prefix: 'exports/' },
      expiration: { days: 7 },
    },
  ],
});

/**
 * PDF rendering for QR batches.
 *
 * A queue and a Lambda of their own, not the tRPC function. Rendering 200 table tents takes
 * about 10 seconds and 100 MB, and the PDF libraries and the HarfBuzz WASM have no business in
 * the API bundle (the same reason `packages/og-image` is separate).
 *
 * One message is `{ batchId }`. The visibility timeout is longer than the function timeout, or a
 * slow render would be delivered a second time while it is still running.
 */
export const qrRenderQueue = new sst.aws.Queue('QrRenderQueue', {
  visibilityTimeout: '6 minutes',
});

qrRenderQueue.subscribe(
  {
    handler: 'packages/qr/src/handler.handler',
    link: [database, privateFilesBucket],
    memory: '2048 MB',
    timeout: '5 minutes',
    // hb.js reads hb.wasm from its own directory, so it must stay a real module on disk and not
    // be inlined by the bundler.
    nodejs: { install: ['harfbuzzjs'] },
    // Noto Sans and Noto Sans Kannada (OFL), read at /var/task/fonts. See packages/qr/fonts.
    copyFiles: [{ from: 'packages/qr/fonts', to: 'fonts' }],
    environment: {
      DYNAMODB_TABLE: database.name,
      PRIVATE_FILES_BUCKET: privateFilesBucket.name,
      QR_FONTS_DIR: '/var/task/fonts',
    },
  },
  { batch: { size: 1 } }
);

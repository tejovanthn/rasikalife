// infra/class-uploads.ts

/**
 * Private storage for payment screenshots.
 *
 * Deliberately not `eventPostersBucket`. That one is `public: true` and sits behind a
 * CloudFront distribution, which is right for a concert poster and unacceptable for a UPI
 * transaction screenshot — an object key is not a secret, and anything reachable without a
 * signature is public whether or not it is linked.
 *
 * So: no `public`, no `sst.aws.Cdn`, and no S3 notification. The WebP converter that runs over
 * the posters bucket must never see these — it writes derivatives back into the same bucket,
 * and a derivative of a private image is another copy to keep track of.
 *
 * Every read goes through `classes.packScreenshotUrl`, which runs the access check first and
 * then signs a short-lived GET. The row stores the key alone (`classPack.screenshotKey`), never
 * a URL, so there is nothing in the database that would work if it leaked.
 */
export const classUploadsBucket = new sst.aws.Bucket('ClassUploads');

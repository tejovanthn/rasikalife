export const eventPostersBucket = new sst.aws.Bucket('EventPosters', {
  public: true,
});

export const geminiApiKey = new sst.Secret('GeminiApiKey');

// CloudFront CDN in front of the bucket for global caching
export const eventPostersCdn = new sst.aws.Cdn('EventPostersCdn', {
  origins: [
    {
      domainName: $interpolate`${eventPostersBucket.name}.s3.amazonaws.com`,
      originId: 'S3Origin',
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: 'https-only',
        originSslProtocols: ['TLSv1.2'],
      },
    },
  ],
  defaultCacheBehavior: {
    targetOriginId: 'S3Origin',
    compress: true,
    viewerProtocolPolicy: 'redirect-to-https',
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    // AWS managed CachingOptimized policy
    cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
  },
});

// WebP converter: one notify() call with 3 entries for jpg/jpeg/png suffixes
// (avoids triggering on .webp files written by the converter itself)
const converterFunction = {
  handler: 'packages/image-processor/src/handler.handler',
  memory: '1024 MB',
  timeout: '5 minutes',
  link: [eventPostersBucket],
  nodejs: {
    install: ['sharp'],
  },
};

eventPostersBucket.notify({
  notifications: [
    {
      name: 'WebPConverterJpg',
      function: converterFunction,
      events: ['s3:ObjectCreated:*'],
      filterPrefix: 'posters/',
      filterSuffix: '.jpg',
    },
    {
      name: 'WebPConverterJpeg',
      function: converterFunction,
      events: ['s3:ObjectCreated:*'],
      filterPrefix: 'posters/',
      filterSuffix: '.jpeg',
    },
    {
      name: 'WebPConverterPng',
      function: converterFunction,
      events: ['s3:ObjectCreated:*'],
      filterPrefix: 'posters/',
      filterSuffix: '.png',
    },
  ],
});

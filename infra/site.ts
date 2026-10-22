import { auth } from './auth';
import { getCookieDomain, getDomain } from './domain';
import { blockBadBots } from './edge-security';
import { eventPostersBucket, eventPostersCdn } from './event-posters';
import { ogImageFunction } from './og-image';
import { siteDistributionParam } from './site-cache';
import { bucket } from './storage';
import { trpc } from './trpc';

// SST's own server cache policy leaves every cookie out of the key, so one cached copy would be
// served to signed-in readers and to every script and theme choice alike. These three are the
// only cookies that change a rendered page (packages/web/app/lib/page-cache.ts). A signed-in
// response is `private` and never stored, so keying on the session only routes it past the
// cache. Otherwise the same as SST's: TTL 0 unless the response says otherwise.
const serverCachePolicy = new aws.cloudfront.CachePolicy('RasikaWebServerCachePolicy', {
  comment: 'rasika.life server responses, keyed on the cookies that change a page',
  defaultTtl: 0,
  maxTtl: 31536000,
  minTtl: 0,
  parametersInCacheKeyAndForwardedToOrigin: {
    cookiesConfig: {
      cookieBehavior: 'whitelist',
      cookies: { items: ['rasika_session', 'theme', 'script_preference'] },
    },
    headersConfig: {
      headerBehavior: 'whitelist',
      headers: { items: ['x-open-next-cache-key', 'x-rasika-build'] },
    },
    queryStringsConfig: { queryStringBehavior: 'all' },
    enableAcceptEncodingBrotli: true,
    enableAcceptEncodingGzip: true,
  },
});

// Changes on every deploy, and the viewer-request function puts it in the cache key. Pages are
// cached for a week (packages/web/app/lib/page-cache.ts), and SST clears the cache on deploy
// only when the hashed assets change, so a loader-only change would otherwise keep serving the
// old HTML. A new key also strands old copies cleanly instead of racing an invalidation.
const buildId = Date.now().toString(36);
const tagBuild = `
event.request.headers['x-rasika-build'] = { value: '${buildId}' };
`;

// CloudFront access logs, prod only, kept 30 days. Lambda logs carry no path or user agent, so
// these are the only record of which pages crawlers hit and how often the cache answers.
let cdnLogsDomain: $util.Output<string> | undefined;
if ($app.stage === 'prod') {
  const cdnLogs = new aws.s3.BucketV2('RasikaWebCdnLogs');
  // CloudFront writes logs through bucket ACLs, which S3 disables by default.
  const ownership = new aws.s3.BucketOwnershipControls('RasikaWebCdnLogsOwnership', {
    bucket: cdnLogs.id,
    rule: { objectOwnership: 'BucketOwnerPreferred' },
  });
  new aws.s3.BucketLifecycleConfigurationV2('RasikaWebCdnLogsExpiry', {
    bucket: cdnLogs.id,
    rules: [{ id: 'expire-30-days', status: 'Enabled', filter: {}, expiration: { days: 30 } }],
  });
  // Through the ownership controls, so the distribution is not pointed at the bucket first.
  cdnLogsDomain = $resolve([ownership.id, cdnLogs.bucketDomainName]).apply(([, domain]) => domain);
}

const site = new sst.aws.React('RasikaWeb', {
  link: [bucket, trpc, auth, eventPostersBucket],
  path: 'packages/web/',
  domain: getDomain(''),
  cachePolicy: serverCachePolicy.id,
  edge: {
    viewerRequest: { injection: blockBadBots + tagBuild },
  },
  environment: {
    STAGE: $app.stage,
    VITE_STAGE: $app.stage,
    EVENT_POSTERS_BUCKET: eventPostersBucket.name,
    EVENT_POSTERS_CDN_URL: eventPostersCdn.url,
    OG_IMAGE_URL: ogImageFunction.url,
    // Scopes `rasika_session` to the stage root so classes.rasika.life shares the sign-in.
    SESSION_COOKIE_DOMAIN: getCookieDomain(),
  },
  server: {
    timeout: '60 seconds',
  },
  transform: {
    cdn: args => {
      if (!cdnLogsDomain) return;
      const bucket = cdnLogsDomain;
      args.transform = {
        ...args.transform,
        distribution: distribution => {
          distribution.loggingConfig = { bucket, prefix: 'rasika-web/', includeCookies: false };
        },
      };
    },
  },
});

// Read by `invalidateSiteCache` (packages/core/src/site-cache.ts). See infra/site-cache.ts.
if (site.nodes.cdn) {
  new aws.ssm.Parameter('RasikaWebDistributionId', {
    name: siteDistributionParam,
    type: 'String',
    value: site.nodes.cdn.nodes.distribution.id,
  });
}

export { bucket, site };

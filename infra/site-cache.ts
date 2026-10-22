// What a function needs to clear the site's CloudFront cache (`invalidateSiteCache`,
// packages/core/src/site-cache.ts). The site links tRPC, so tRPC cannot take the distribution
// id as an input without a cycle; site.ts writes it to this SSM parameter instead.
export const siteDistributionParam = `/rasika/${$app.stage}/web-distribution-id`;

const identity = aws.getCallerIdentityOutput();
const region = aws.getRegionOutput();

export const siteCacheEnvironment = { SITE_DISTRIBUTION_PARAM: siteDistributionParam };

export const siteCachePermissions = [
  {
    actions: ['ssm:GetParameter'],
    resources: [
      $interpolate`arn:aws:ssm:${region.name}:${identity.accountId}:parameter${siteDistributionParam}`,
    ],
  },
  {
    // The distribution's ARN is the input the cycle forbids, so this names the account's.
    actions: ['cloudfront:CreateInvalidation'],
    resources: [$interpolate`arn:aws:cloudfront::${identity.accountId}:distribution/*`],
  },
];

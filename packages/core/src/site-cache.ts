import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Clears rasika.life's CloudFront cache after a write that changes a public page.
 *
 * Signed-out pages are cached for a week (`DEFAULT_PUBLIC_CACHE_CONTROL` in
 * packages/web/app/lib/page-cache.ts), so a write has to clear them itself or readers see the old
 * page until it expires. It clears `/*`, not the changed page's own URL: one composition shows up
 * on its raga's, its composer's and every list page, and mapping each write to all of those would
 * be easy to get wrong. A `/*` invalidation counts as one path, and the first 1,000 paths a month
 * are free.
 *
 * The distribution id is read from SSM because the site links tRPC, so tRPC cannot take the
 * site's id as a deploy-time input without a cycle (`infra/site.ts` writes the parameter).
 *
 * Never throws: a write that landed must not fail because the cache could not be cleared. The
 * week-long TTL is the backstop.
 */

export const siteDistributionParam = (stage: string) => `/rasika/${stage}/web-distribution-id`;

const cloudfront = new CloudFrontClient({});
const ssm = new SSMClient({});
let distributionId: Promise<string | undefined> | undefined;

function paramName(): string | undefined {
  if (process.env.SITE_DISTRIBUTION_PARAM) return process.env.SITE_DISTRIBUTION_PARAM;
  // `sst shell` (the CLI scripts) sets this; Lambdas get SITE_DISTRIBUTION_PARAM from infra.
  try {
    const app = JSON.parse(process.env.SST_RESOURCE_App ?? '{}') as { stage?: string };
    return app.stage ? siteDistributionParam(app.stage) : undefined;
  } catch {
    return undefined;
  }
}

async function loadDistributionId(): Promise<string | undefined> {
  const name = paramName();
  if (!name) return undefined;
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: name }));
  return Parameter?.Value;
}

export async function invalidateSiteCache(reason: string): Promise<void> {
  try {
    distributionId ??= loadDistributionId();
    const id = await distributionId;
    if (!id) {
      console.warn(`[site-cache] No distribution id; not clearing (${reason})`);
      return;
    }
    await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: id,
        InvalidationBatch: {
          CallerReference: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          Paths: { Quantity: 1, Items: ['/*'] },
        },
      })
    );
    console.log(`[site-cache] Cleared /* (${reason})`);
  } catch (error) {
    // Forget a failed lookup so the next write tries again.
    distributionId = undefined;
    console.error(`[site-cache] Failed to clear (${reason})`, error);
  }
}

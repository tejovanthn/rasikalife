/**
 * Rate limit on the QR scan pages (`/q/*`): 300 requests per 5 minutes per IP, which is WAF's
 * smallest window and equals the 60 a minute in the spec (SCAN_RATE_LIMIT_PER_MIN).
 *
 * The rule is scoped to `/q/` by path, so the rest of the site is never counted or blocked. A
 * blocked request gets a 429 with the Copy "Too many scans" page as a WAF custom response, so
 * the reader sees the right words and not a CloudFront error.
 *
 * A CloudFront web ACL must live in us-east-1. Prod only, like the CDN logs: a WAF costs a
 * monthly fee and a personal stage has no crowd. The ACL id is set on the site's distribution
 * in `infra/site.ts`.
 */
const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Too many scans</title><style>body{font:20px/1.5 system-ui,sans-serif;max-width:28rem;margin:0 auto;padding:2rem 1rem}h1{font-size:1.9rem;line-height:1.2}</style></head><body><h1>Too many scans</h1><p>Please wait a minute and try again.</p></body></html>`;

export let scanWebAclArn: $util.Output<string> | undefined;

if ($app.stage === 'prod') {
  const usEast1 = new aws.Provider('RasikaWafUsEast1', { region: 'us-east-1' });
  const acl = new aws.wafv2.WebAcl(
    'RasikaWebScanAcl',
    {
      scope: 'CLOUDFRONT',
      description: 'Rate limit for rasika.life /q/* scan pages',
      defaultAction: { allow: {} },
      customResponseBodies: [{ key: 'too-many-scans', content: body, contentType: 'TEXT_HTML' }],
      rules: [
        {
          name: 'scan-rate-limit',
          priority: 1,
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'too-many-scans',
                responseHeaders: [{ name: 'Retry-After', value: '60' }],
              },
            },
          },
          statement: {
            rateBasedStatement: {
              limit: 300,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  searchString: '/q/',
                  positionalConstraint: 'STARTS_WITH',
                  fieldToMatch: { uriPath: {} },
                  textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                },
              },
            },
          },
          visibilityConfig: {
            cloudwatchMetricsEnabled: true,
            metricName: 'scan-rate-limit',
            sampledRequestsEnabled: true,
          },
        },
      ],
      visibilityConfig: {
        cloudwatchMetricsEnabled: true,
        metricName: 'rasika-web-scan',
        sampledRequestsEnabled: true,
      },
    },
    { provider: usEast1 }
  );
  scanWebAclArn = acl.arn;
}

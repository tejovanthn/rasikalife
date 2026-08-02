import type { Dns } from '../.sst/platform/src/components/dns';

interface MyDomain {
  name: string;
  redirects?: string[];
  dns: Dns;
}

const rootDomain = 'rasika.life';

/**
 * The domain the shared session cookie is scoped to.
 *
 * Every Rasika app on a stage signs in once, so the cookie must apply to the stage's root and
 * everything under it — `rasika.life` in prod, `dev.rasika.life` on a dev stage. Scoping a
 * non-prod stage to the production root instead would let two stages overwrite each other's
 * sessions, which is a confusing way to be logged out.
 */
export const getCookieDomain = (): string =>
  $app.stage === 'prod' ? rootDomain : `${$app.stage}.${rootDomain}`;

export const getDomain = (prefix = ''): MyDomain => {
  const domainName = $app.stage === 'prod' ? rootDomain : `${$app.stage}.${rootDomain}`;
  const dns = sst.aws.dns({
    zone: 'Z0190677U1NK4BAEXE0M',
  });
  const redirects =
    $app.stage === 'prod' ? [`www.${rootDomain}`] : [`www.${$app.stage}.${rootDomain}`];

  return {
    name: prefix ? `${prefix}.${domainName}` : domainName,
    redirects: prefix === '' ? redirects : undefined,
    dns,
  };
};

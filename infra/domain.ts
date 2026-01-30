import type { Dns } from '../.sst/platform/src/components/dns';

interface MyDomain {
  name: string;
  redirects?: string[];
  dns: Dns;
}

const rootDomain = 'rasika.life';

export const getDomain = (prefix = ''): MyDomain => {
  const domainName = $app.stage === 'prod' ? rootDomain : `${$app.stage}.${rootDomain}`;
  const dns = sst.aws.dns({
    zone: 'Z0190677U1NK4BAEXE0M',
  });
  const redirects =
    $app.stage === 'prod' ? [`www.${rootDomain}`] : [`www.${$app.stage}.${rootDomain}`];

  return {
    name: prefix ? `${prefix}.${domainName}` : domainName,
    redirects: prefix ? redirects : undefined,
    dns,
  };
};

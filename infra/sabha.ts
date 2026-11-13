import { auth } from './auth';
import { getCookieDomain, getDomain } from './domain';
import { blockBadBots } from './edge-security';
import { trpc } from './trpc';

/**
 * The sabha dashboard, `sabha.rasika.life` (`sabha.<stage>.rasika.life` off prod).
 *
 * A separate site from `RasikaWeb`, like `RasikaAdmin` and `RasikaClasses`: the wiki is public,
 * indexed and edge-cached, and this is private, `noindex`, and `private, no-store` on every
 * document, since every page is somebody's follower numbers.
 *
 * Not linked to `database` or the private bucket. Every read and write goes through `RasikaTRPC`,
 * which holds the membership check (`partnerProcedure`) and signs the export link. The export
 * file is written to the `PrivateFiles` bucket by the tRPC function, never by this site.
 *
 * Sign-in: the OpenAuth issuer already allows any `*.rasika.life` redirect URI, so the subdomain
 * needs no change there. `SESSION_COOKIE_DOMAIN` is what makes the `rasika_session` cookie reach
 * this host. The issuer also accepts a pending partner invite on every sign-in.
 */
export const sabhaSite = new sst.aws.React('RasikaSabha', {
  link: [trpc, auth],
  path: 'packages/sabha/',
  domain: getDomain('sabha'),
  // AWS managed "CachingDisabled". Every document here is `private, no-store`, so a policy of
  // our own would cache nothing and would count toward the account's limit of 20 cache policies
  // (the first prod deploy failed with TooManyCachePolicies). Cookies still reach the server: the
  // origin request policy forwards every viewer header but Host.
  cachePolicy: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
  edge: {
    viewerRequest: { injection: blockBadBots },
  },
  environment: {
    STAGE: $app.stage,
    VITE_STAGE: $app.stage,
    SESSION_COOKIE_DOMAIN: getCookieDomain(),
    // Each event row links to its public page on the main site.
    SITE_URL: `https://${getDomain().name}`,
  },
  server: {
    timeout: '30 seconds',
  },
});

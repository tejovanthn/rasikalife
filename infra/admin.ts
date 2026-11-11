import { auth } from './auth';
import { getCookieDomain, getDomain } from './domain';
import { blockBadBots } from './edge-security';
import { trpc } from './trpc';

/**
 * The admin app, `admin.rasika.life` (`admin.<stage>.rasika.life` off prod).
 *
 * A separate site from `RasikaWeb` for the reason `RasikaClasses` is: the wiki is public,
 * indexed and edge-cached, and this is private, `noindex`, and `private, no-store` on every
 * document. Sharing a deployment would mean every caching and robots decision on the main site
 * needing an exception.
 *
 * Not linked to `database` or the private bucket, on the same reasoning as Classes. Every read
 * and write goes through `RasikaTRPC`, which holds the role check (`moderatorProcedure`) and signs
 * the PDF download URL. Giving the web tier its own table access would be a second path to the
 * same rows with its own authorisation story. This departs from the brief, which listed the
 * table and the bucket, on purpose.
 *
 * Sign-in: the OpenAuth issuer already allows any `*.rasika.life` redirect URI
 * (`packages/auth/src/issuer.ts`), so the subdomain needs no change there.
 * `SESSION_COOKIE_DOMAIN` is what makes the `rasika_session` cookie reach this host.
 */
export const adminSite = new sst.aws.React('RasikaAdmin', {
  link: [trpc, auth],
  path: 'packages/admin/',
  domain: getDomain('admin'),
  edge: {
    viewerRequest: { injection: blockBadBots },
  },
  environment: {
    STAGE: $app.stage,
    VITE_STAGE: $app.stage,
    SESSION_COOKIE_DOMAIN: getCookieDomain(),
    // "Test scan" and "Create venue" link to the public site of the same stage.
    SITE_URL: `https://${getDomain().name}`,
  },
  server: {
    timeout: '30 seconds',
  },
});

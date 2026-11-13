import { ToastProvider } from '@rasika/ui';
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from 'react-router';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { getUser } from '~/lib/auth.server';
import { SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { pendingInviteCount } from '~/lib/sabha';
import styles from './globals.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: styles }];

/** `noindex` on every route; a child's `meta` replaces this, so each goes through `pageMeta`. */
export const meta: MetaFunction = () => pageMeta();

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/**
 * Nothing on this origin is ever shared-cacheable: every page is somebody's follower list.
 *
 * It also reads how many invites wait for the signed-in person, once, so the header's
 * "Invites (n)" is on every page without a call per tab. The root loader runs again after any
 * action (so accepting an invite updates it) and not on a plain move between tabs. A signed-out
 * visitor, or any failure, gives 0 and the link stays hidden: the header never breaks a page.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  let pendingInvites = 0;
  try {
    if (await getUser(request)) {
      const trpc = await createServerClient(request);
      pendingInvites = pendingInviteCount(await trpc.partner.pendingInvites.query());
    }
  } catch {
    pendingInvites = 0;
  }
  return data({ pendingInvites }, { headers: PRIVATE_HEADERS });
}

export function headers() {
  return PRIVATE_HEADERS;
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title =
    status === 403
      ? SABHA_EXTRA_COPY.forbiddenTitle
      : status === 404
        ? SABHA_EXTRA_COPY.notFoundTitle
        : SABHA_EXTRA_COPY.errorTitle;
  const body =
    status === 403
      ? SABHA_EXTRA_COPY.forbiddenBody
      : status === 404
        ? ''
        : SABHA_EXTRA_COPY.errorBody;

  return (
    <Document>
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {body ? <p className="text-muted-foreground">{body}</p> : null}
        <a className="text-primary underline" href="/">
          {SABHA_EXTRA_COPY.home}
        </a>
      </main>
    </Document>
  );
}

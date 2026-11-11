import { ToastProvider } from '@rasika/ui';
import type { LinksFunction, MetaFunction } from 'react-router';
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
import { SABHA_EXTRA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import styles from './globals.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: styles }];

/** `noindex` on every route; a child's `meta` replaces this, so each goes through `pageMeta`. */
export const meta: MetaFunction = () => pageMeta();

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Nothing on this origin is ever shared-cacheable: every page is somebody's follower list. */
export function loader() {
  return data({}, { headers: PRIVATE_HEADERS });
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

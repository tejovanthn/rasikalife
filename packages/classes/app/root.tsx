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
import { RegisterServiceWorker } from '~/components/register-sw';
import { pageMeta } from '~/lib/meta';
import styles from './globals.css?url';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  { rel: 'icon', href: '/icons/icon-192.png', type: 'image/png' },
];

/**
 * Every page here is private, so `noindex` is unconditional rather than per route — and because
 * a child's `meta` export replaces this one wholesale, every route emits it through the same
 * helper. See `~/lib/meta`.
 */
export const meta: MetaFunction = () => pageMeta();

/**
 * Headers only. It deliberately does **not** resolve the signed-in user.
 *
 * It used to, and nothing read the result: no component called `useRouteLoaderData('root')` and
 * the headers below do not depend on it. So every page load paid a token verification and a
 * `user.me` round trip for a value that was thrown away — and every route loader then did the
 * same work again through `requireUser`. Routes that genuinely need a name or an email ask for
 * one; the rest gate on `requireUserId`, which verifies the token and stops there.
 *
 * Nothing on this origin is ever shared-cacheable: every document is somebody's private ledger.
 * The main site has to decide that per request; here the answer is always the same.
 */
export function loader() {
  return data(
    {},
    { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } }
  );
}

export function headers() {
  return { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {/* `viewport-fit=cover` is what makes the safe-area insets in the shell resolve to real
            numbers on a notched phone. Without it they are all zero and the tab bar sits under
            the home indicator. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Meta />
        <Links />
        {/*
          What the app looks like with no JavaScript.

          `.js-only` hides every control that needs scripting to do anything — a dialog trigger,
          chiefly — so a fallback beside it is the only thing on screen rather than the second of
          two identical-looking buttons.

          The `<dialog>` rule is the other half, and it is what lets `FormDialog` render its form
          exactly once: a closed `<dialog>` is `display: none` by default, and here it becomes an
          ordinary block in the page instead. So the modal degrades into an inline form rather
          than into a second copy of itself with duplicated field ids.
        */}
        <noscript>
          <style>
            {'.js-only{display:none!important}' +
              'dialog.form-dialog{display:block;position:static;width:auto;max-width:none;margin:0 0 1rem;border:1px solid hsl(var(--border));border-radius:var(--radius)}'}
          </style>
        </noscript>
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
        <RegisterServiceWorker />
        <Outlet />
      </ToastProvider>
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Document>
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold">{is404 ? 'Not found' : 'Something went wrong'}</h1>
        <p className="text-muted-foreground">
          {is404
            ? 'That page is not here. It may belong to a learner you no longer follow.'
            : 'Try again in a moment. Nothing you have already recorded is affected.'}
        </p>
        <a className="text-primary underline" href="/">
          Back to your classes
        </a>
      </main>
    </Document>
  );
}

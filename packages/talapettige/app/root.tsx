import type { LinksFunction } from 'react-router';
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import { RegisterServiceWorker } from '~/components/register-sw';
import { TalapettigeShell } from '~/components/shell';
import styles from './globals.css?url';

// The service worker caches this stylesheet and the font files it names, so the font survives
// going offline after the first visit. Same family as rasika.life; Kannada for the app's name.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;600&display=swap';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: FONTS },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Two values, because one light value paints a cream status bar above a dark app. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffe9e0" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#130a06" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Talapettige" />
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
    <>
      <RegisterServiceWorker />
      <TalapettigeShell>
        <Outlet />
      </TalapettigeShell>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">{is404 ? 'Not found' : 'Something went wrong'}</h1>
      <p className="text-muted-foreground">
        {is404 ? 'That page is not here.' : 'Reload the page to try again.'}
      </p>
      <Link className="text-primary underline" to="/">
        Back to Talapettige
      </Link>
    </main>
  );
}

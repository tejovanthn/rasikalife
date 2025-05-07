import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from '@remix-run/react';
import clsx from 'clsx';
import { useEffect } from 'react';
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from 'remix-themes';

import { Footer } from './components/footer';
import { Header } from './components/header';
import { logAnalyticsEvent } from './firebase';
import styles from './globals.css?url';
import { themeSessionResolver } from './sessions.server';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: '/apple-touch-icon.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '16x16',
    href: '/favicon-16x16.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: '/favicon-32x32.png',
  },
  {
    rel: 'manifest',
    href: '/manifest.json',
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { getTheme } = await themeSessionResolver(request);
  return {
    theme: getTheme(),
  };
}

function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme();

  useEffect(() => {
    logAnalyticsEvent('page_view', {
      page_title: window.document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });
  }, []);

  return (
    <html lang="en" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data?.theme)} />
        <Links />
      </head>
      <body>
        <Header />
        <div className="mb-20 mt-10">{children}</div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function AppWithProviders() {
  const data = useLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={data?.theme || null} themeAction="/action/set-theme">
      <Layout>
        <Outlet />
      </Layout>
    </ThemeProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData<typeof loader>('root');

  return (
    <ThemeProvider specifiedTheme={data?.theme || null} themeAction="/action/set-theme">
      <Layout>
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">
            {isRouteErrorResponse(error)
              ? `${error.status} ${error.statusText}`
              : error instanceof Error
                ? error.message
                : 'Unknown Error'}
          </h1>
          <Link to="/">Go back to home</Link>
        </div>
      </Layout>
    </ThemeProvider>
  );
}

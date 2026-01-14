import clsx from 'clsx';
import { useContext, useEffect } from 'react';
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
  useRouteLoaderData,
} from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { useTheme } from 'react-router-theme';
import { ThemeContext } from './components/theme-context';

// Export loader and action from react-router-theme
export { loader, action } from 'react-router-theme';

import { Footer } from './components/footer';
import { Header } from './components/header';
import { logAnalyticsEvent } from './firebase';
import styles from './globals.css?url';

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
  // DNS prefetch for external resources
  { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
  { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
  // Preconnect to critical origins
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    logAnalyticsEvent('page_view', {
      page_title: window.document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });
  }, []);

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Header />
        <div className="">{children}</div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function AppWithProviders() {
  const loaderData = useLoaderData() as { theme: string };
  const fetcher = useFetcher();
  const [theme, setTheme] = useTheme(loaderData, fetcher, 'light');

  // Update the HTML class when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout>
        <Outlet />
      </Layout>
    </ThemeContext.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="container mx-auto p-8">
          <h1 className="text-2xl font-bold">
            {isRouteErrorResponse(error)
              ? `${error.status} ${error.statusText}`
              : error instanceof Error
                ? error.message
                : 'Unknown Error'}
          </h1>
          <Link to="/">Go back to home</Link>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

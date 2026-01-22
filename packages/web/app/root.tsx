import { ApplicationError, ErrorCode } from '@rasika/core';
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
  useLocation,
  useRouteError,
  useRouteLoaderData,
} from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { useTheme } from 'react-router-theme';
import { ThemeContext } from './components/theme-context';

// Export loader and action from react-router-theme
export { loader, action } from 'react-router-theme';

import { Footer } from './components/footer';
import { GlobalLoader } from './components/global-loader';
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

function Layout({ children, theme }: { children: React.ReactNode; theme: string }) {
  const location = useLocation();

  useEffect(() => {
    logAnalyticsEvent('page_view', {
      page_title: window.document.title,
      page_location: window.location.href,
      page_path: location.pathname,
    });
  }, [location.pathname]); // Track on initial load and route changes

  return (
    <html lang="en" data-theme={theme} className={theme === 'dark' ? 'dark' : ''}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <GlobalLoader />
        <Header />
        <div className="-mt-4 md:mt-0">{children}</div>
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

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout theme={theme}>
        <Outlet />
      </Layout>
    </ThemeContext.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  const getErrorContent = () => {
    if (error instanceof ApplicationError) {
      switch (error.code) {
        case ErrorCode.ARTIST_NOT_FOUND:
          return {
            title: '404 - Artist Not Found',
            message: error.message,
            suggestions: [
              'Check the artist name or ID',
              'Browse other artists',
              'Go back to the artists list',
            ],
          };
        case ErrorCode.COMPOSITION_NOT_FOUND:
          return {
            title: '404 - Composition Not Found',
            message: error.message,
            suggestions: [
              'Check the composition title or ID',
              'Browse other compositions',
              'Go back to the compositions list',
            ],
          };
        // Add more specific cases as needed
        default:
          return {
            title: 'Application Error',
            message: error.message,
            suggestions: ['Go back to the homepage', 'Try again later'],
          };
      }
    }

    if (isRouteErrorResponse(error)) {
      switch (error.status) {
        case 404:
          return {
            title: '404 - Page Not Found',
            message:
              "We couldn't find the page you're looking for. It might have been moved or deleted.",
            suggestions: [
              'Check the URL for typos',
              'Go back to the homepage',
              'Browse our collections of compositions, artists, ragas, and talas',
            ],
          };
        case 500:
          return {
            title: '500 - Server Error',
            message: 'Something went wrong on our end. Please try again later.',
            suggestions: [
              'Refresh the page',
              'Go back to the homepage',
              'If the problem persists, please contact support',
            ],
          };
        default:
          return {
            title: `${error.status} ${error.statusText}`,
            message: 'An unexpected error occurred.',
            suggestions: ['Go back to the homepage', 'Try again later'],
          };
      }
    }

    if (error instanceof Error) {
      return {
        title: 'Error',
        message: error.message,
        suggestions: ['Go back to the homepage', 'Try again later'],
      };
    }

    return {
      title: 'Unknown Error',
      message: 'An unexpected error occurred.',
      suggestions: ['Go back to the homepage', 'Try again later'],
    };
  };

  const { title, message, suggestions } = getErrorContent();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-6xl font-bold text-primary">
                {isRouteErrorResponse(error) ? error.status : '⚠️'}
              </h1>
              <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
              <p className="text-muted-foreground">{message}</p>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2 text-left">
                <h3 className="text-sm font-semibold text-foreground">What you can do:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {suggestions.map((suggestion, index) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Homepage
              </Link>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-md font-medium hover:bg-muted transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

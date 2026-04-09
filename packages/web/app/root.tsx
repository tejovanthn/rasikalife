import clsx from 'clsx';
import { useContext, useEffect } from 'react';
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from 'react-router';
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useLocation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
} from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { useTheme } from 'react-router-theme';
import { createServerClient } from '~/api.server';
import { type SessionUser, getUser } from '~/lib/auth.server';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { AuthContext } from './components/auth-context';
import { ScriptContext } from './components/script-context';
import { ThemeContext } from './components/theme-context';
import { DISPLAY_SCRIPTS, scriptSessionResolver, themeSessionResolver } from './sessions.server';
import type { DisplayScript } from './sessions.server';

export type { SessionUser } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const [theme, script, user] = await Promise.all([
    themeSessionResolver.getTheme(request),
    scriptSessionResolver.getScript(request),
    getUser(request),
  ]);

  return data({ theme, script, user });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const theme = formData.get('theme');
  const script = formData.get('script');

  if (typeof theme === 'string' && (theme === 'light' || theme === 'dark')) {
    const headers = await themeSessionResolver.setTheme(theme);
    return data({ success: true }, { headers });
  }

  if (typeof script === 'string' && DISPLAY_SCRIPTS.includes(script as DisplayScript)) {
    const headers = await scriptSessionResolver.setScript(script as DisplayScript);
    return data({ success: true }, { headers });
  }

  return data({ success: false });
}

import { Footer } from './components/footer';
import { GlobalLoader } from './components/global-loader';
import { Header } from './components/header';
import { Toaster } from './components/ui/sonner';
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
  // Noto Sans — covers Latin, Devanagari, Tamil, Telugu, and Kannada scripts
  // Preload the font CSS so it's fetched in parallel with the preconnect handshake
  {
    rel: 'preload',
    as: 'style',
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap',
  },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <GlobalLoader />
        <Header />
        <div className="-mt-4 md:mt-0" id="main-content">
          {children}
        </div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function AppWithProviders() {
  const loaderData = useLoaderData() as {
    theme: string;
    script: DisplayScript;
    user: SessionUser | null;
  };
  const themeFetcher = useFetcher();
  const scriptFetcher = useFetcher();
  const revalidator = useRevalidator();
  const [theme, setTheme] = useTheme(loaderData, themeFetcher, 'light');

  const pendingScript = scriptFetcher.formData?.get('script') as DisplayScript | null;
  const script = pendingScript ?? loaderData.script ?? 'iast';
  const setScript = (newScript: DisplayScript) => {
    scriptFetcher.submit({ script: newScript }, { method: 'POST', action: '/' });
  };

  useEffect(() => {
    if (scriptFetcher.state === 'idle' && scriptFetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [scriptFetcher.state, scriptFetcher.data, revalidator]);

  return (
    <AuthContext.Provider value={{ user: loaderData.user }}>
      <ThemeContext.Provider value={{ theme, setTheme, isPending: themeFetcher.state !== 'idle' }}>
        <ScriptContext.Provider
          value={{ script, setScript, isPending: scriptFetcher.state !== 'idle' }}
        >
          <Layout theme={theme}>
            <Outlet />
            <Toaster />
          </Layout>
        </ScriptContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
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

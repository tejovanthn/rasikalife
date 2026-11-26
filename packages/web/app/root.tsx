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
  useLocation,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
} from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { useTheme } from 'react-router-theme';
import { createServerClient } from '~/api.server';
import { type SessionUser, getUser } from '~/lib/auth.server';
import { errorContent } from '~/lib/error-content';
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
import { SwUpdateNotifier } from './components/pwa/sw-update-notifier';
import { Toaster } from './components/ui/sonner';
import { logAnalyticsEvent } from './firebase';
import styles from './globals.css?url';

/** Noto Sans: Latin, Devanagari, Tamil, Telugu and Kannada. `display=swap` shows text at once. */
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&display=swap';

/**
 * The font stylesheet, loaded without blocking the first paint: `media="print"` is fetched but
 * not waited for, and the script turns it on once it has loaded (or at once, if it already
 * has). Text paints in the fallback sans and swaps, which `display=swap` already allowed.
 * React 18 does not patch attributes on hydration, so the `all` the script set survives.
 */
function FontStylesheet() {
  return (
    <>
      <link id="noto-fonts" rel="stylesheet" href={FONT_CSS} media="print" />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no user input
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var l=document.getElementById('noto-fonts');if(!l)return;function on(){l.media='all'}if(l.sheet)on();else l.addEventListener('load',on)})();",
        }}
      />
      <noscript>
        <link rel="stylesheet" href={FONT_CSS} />
      </noscript>
    </>
  );
}

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
    href: FONT_CSS,
  },
  // The stylesheet itself is <FontStylesheet />, not a link here: as a plain stylesheet it
  // held the first paint for ~0.6 s on slow 4G (Lighthouse, Oct 2026).
];

function Layout({ children, theme }: { children: React.ReactNode; theme: string }) {
  const location = useLocation();
  const bare = location.pathname.startsWith('/q/');

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
        <FontStylesheet />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <GlobalLoader />
        {/* The scan pages (/q/...) are one phone screen with no site chrome. */}
        {!bare && <Header />}
        <div className={bare ? 'min-h-dvh' : '-mt-4 md:mt-0'} id="main-content">
          {children}
        </div>
        {!bare && <Footer />}
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
            <SwUpdateNotifier />
          </Layout>
        </ScriptContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { title, message, kind } = errorContent(error);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <Meta />
        <Links />
        <FontStylesheet />
      </head>
      <body>
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-foreground">{title}</h1>
              <p className="text-muted-foreground">{message}</p>
            </div>

            <nav aria-label="Browse" className="flex flex-wrap gap-x-5 gap-y-1">
              {[
                { to: '/events', label: 'Concerts' },
                { to: '/carnatic/ragas', label: 'Ragas' },
                { to: '/carnatic/compositions', label: 'Compositions' },
                { to: '/artists', label: 'Artists' },
                { to: '/', label: 'Home' },
              ].map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex min-h-11 items-center font-medium"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {kind === 'failed' && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-6 font-medium hover:bg-muted"
              >
                Try again
              </button>
            )}
          </div>
        </main>
        <Scripts />
      </body>
    </html>
  );
}

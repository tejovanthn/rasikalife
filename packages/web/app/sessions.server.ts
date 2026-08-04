import { createCookieSessionStorage } from 'react-router';
import { Resource } from 'sst/resource';

export type DisplayScript = 'roman' | 'iast' | 'devanagari' | 'tamil' | 'telugu' | 'kannada';
export const DISPLAY_SCRIPTS: DisplayScript[] = [
  'roman',
  'iast',
  'devanagari',
  'tamil',
  'telugu',
  'kannada',
];

/**
 * Anonymous visitors and Googlebot carry no script cookie, so this is the script
 * every indexed page is rendered in. It must be `roman`: IAST put scholarly
 * diacritics into every title and meta description, and the raga pages that rank
 * for "<name> arohanam avarohanam" were clicking at under 1%.
 */
export const DEFAULT_DISPLAY_SCRIPT: DisplayScript = 'roman';

// You can default to 'development' if process.env.NODE_ENV is not set
const isProduction = process.env.NODE_ENV === 'production';

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'theme',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: ['45]8[Pfb($^hEhM0P$Ug'],
    // Set domain and secure only if in production
    ...(isProduction ? { domain: Resource.RasikaWeb.url, secure: true } : {}),
  },
});

const scriptSessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'script_preference',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: ['45]8[Pfb($^hEhM0P$Ug'],
    ...(isProduction ? { domain: Resource.RasikaWeb.url, secure: true } : {}),
  },
});

export const scriptSessionResolver = {
  async getScript(request: Request): Promise<DisplayScript> {
    const session = await scriptSessionStorage.getSession(request.headers.get('Cookie'));
    const value = session.get('script');
    return (DISPLAY_SCRIPTS.includes(value) ? value : DEFAULT_DISPLAY_SCRIPT) as DisplayScript;
  },
  async setScript(script: DisplayScript) {
    const session = await scriptSessionStorage.getSession();
    session.set('script', script);
    return {
      'Set-Cookie': await scriptSessionStorage.commitSession(session),
    };
  },
};

export const themeSessionResolver = {
  async getTheme(request: Request) {
    const session = await sessionStorage.getSession(request.headers.get('Cookie'));
    return session.get('theme') || 'light';
  },
  async setTheme(theme: string) {
    const session = await sessionStorage.getSession();
    session.set('theme', theme);
    return {
      'Set-Cookie': await sessionStorage.commitSession(session),
    };
  },
  async commit(request: Request) {
    const session = await sessionStorage.getSession(request.headers.get('Cookie'));
    return {
      'Set-Cookie': await sessionStorage.commitSession(session),
    };
  },
};

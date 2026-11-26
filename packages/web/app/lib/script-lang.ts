import type { DisplayScript } from '~/sessions.server';

/**
 * The `lang` for text shown in a display script. Roman and IAST text has no single language
 * (it may be Tamil, Telugu or Sanskrit in Latin letters), so it gets none and inherits the
 * page's `en`. A script gets one so screen readers, hyphenation and font choice follow it.
 */
const LANG_BY_SCRIPT: Record<DisplayScript, string | undefined> = {
  roman: undefined,
  iast: undefined,
  devanagari: 'sa',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn',
};

export function scriptLang(script: DisplayScript): string | undefined {
  return LANG_BY_SCRIPT[script];
}

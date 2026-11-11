/**
 * In-app browsers (WhatsApp, Instagram and similar) block Google sign-in. Detected from the
 * user agent, which is all a server sees. Some webviews (WhatsApp on iOS) send an ordinary
 * Safari agent and cannot be told apart; those readers get the normal screen.
 */
const IN_APP_PATTERNS: RegExp[] = [
  /\bInstagram\b/i,
  /\bWhatsApp\b/i,
  /\bFBAN\b|\bFBAV\b|\bFB_IAB\b|\bFBIOS\b/,
  /\bMessenger\b/i,
  /\bSnapchat\b/i,
  /\bLine\//,
  /\bMicroMessenger\b/,
  /\bTwitter\b/i,
  /\bLinkedInApp\b/,
  /\bTikTok\b|\bmusical_ly\b|\bBytedanceWebview\b/i,
];

export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return IN_APP_PATTERNS.some(pattern => pattern.test(userAgent));
}

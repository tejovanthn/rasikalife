/**
 * Determines if a request is coming from a bot based on the User-Agent header
 */
export function isBotRequest(req: { headers: Record<string, string | undefined> }) {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';

  // Check for common bot identifiers
  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'slurp',
    'googlebot',
    'bingbot',
    'facebookexternalhit',
    'lighthouse',
    'pagespeed',
    'pingdom',
    'ahrefsbot',
    'semrushbot',
    'baiduspider',
    'yandexbot',
    'applebot',
    'duckduckbot',
  ];

  return botPatterns.some(pattern => userAgent.includes(pattern));
}

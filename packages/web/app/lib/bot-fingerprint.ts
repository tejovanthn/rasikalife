/**
 * The browser fingerprint of the GA4 "Direct" bot traffic.
 *
 * rasika.life GA4 Direct was about 90% one kind of visit: Chrome on Windows, a 1280x1200
 * screen, a Singapore timezone, sessions near 0.2 seconds, in bursts of 100 to 600 a day.
 * The edge cannot see screen size, so the match runs in the browser. A match does not block
 * or change anything: it only sets the GA4 `traffic_type` parameter, so the owner can filter
 * those sessions with a GA4 data filter (see CLAUDE.md, "GA4 bot traffic").
 *
 * Both signals are needed. 1280x1200 alone is rare but real; Asia/Singapore alone is a real
 * audience. Together they matched the bots and almost nothing else.
 */

export const TRAFFIC_TYPE_PARAM = 'traffic_type';
export const SUSPECTED_BOT_TRAFFIC_TYPE = 'suspected_bot';

const BOT_SCREEN = { width: 1280, height: 1200 } as const;
const BOT_TIME_ZONES: ReadonlySet<string> = new Set(['Asia/Singapore', 'Singapore']);

export function isSuspectedBot(env: {
  screenWidth?: number;
  screenHeight?: number;
  timeZone?: string;
}): boolean {
  return (
    env.screenWidth === BOT_SCREEN.width &&
    env.screenHeight === BOT_SCREEN.height &&
    !!env.timeZone &&
    BOT_TIME_ZONES.has(env.timeZone)
  );
}

/** Reads the running browser. Never throws: any failure counts as "not a bot". */
export function detectSuspectedBot(): boolean {
  try {
    if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
    return isSuspectedBot({
      screenWidth: screen.width,
      screenHeight: screen.height,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch {
    return false;
  }
}

/**
 * The gtag `config` parameters for this browser: `{ traffic_type: 'suspected_bot' }` on a
 * match, `undefined` for everyone else (their setup stays exactly as before).
 */
export function botTrafficConfig(
  suspected: boolean = detectSuspectedBot()
): Record<string, string> | undefined {
  return suspected ? { [TRAFFIC_TYPE_PARAM]: SUSPECTED_BOT_TRAFFIC_TYPE } : undefined;
}

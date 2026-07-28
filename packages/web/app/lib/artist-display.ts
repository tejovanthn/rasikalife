import { capitalize } from './utils';

/**
 * The "instrument · city" line §6 asks the profile hero to lead with, shared with the
 * artist card so the two never drift apart.
 *
 * Both fields are free text (§11.1) — they arrive from posters, scrapes and a moderator
 * typing into the wizard — so they are trimmed here and blanks are dropped rather than
 * rendered as a stray separator. Only the instrument is capitalized: a city is a proper
 * noun already, and forcing case on one would turn "Bengaluru" into someone's guess.
 *
 * Returns undefined when neither field is set, so callers can fall back with `??` instead
 * of testing for an empty string.
 */
export function artistTagline(artist: {
  instrument?: string | null;
  city?: string | null;
}): string | undefined {
  const instrument = artist.instrument?.trim();
  const city = artist.city?.trim();
  const parts = [instrument ? capitalize(instrument) : null, city || null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

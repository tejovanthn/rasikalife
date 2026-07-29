import { capitalize } from './utils';

/**
 * `instrument` holds a comma-separated list: a mridangam player who also sings is "mridangam,
 * vocal". It stays one free-text field rather than becoming an array or an enum, because the
 * values arrive from posters and scrapes where a closed set would reject real data (§11.1).
 * A picker is the likely future, and it can read this same format.
 *
 * Splitting here rather than at the call sites is what stops `capitalize()` being applied to
 * the whole string, which rendered "mridangam, vocal" as "Mridangam, vocal" with only the
 * first entry cased.
 *
 * Blank segments are dropped, so trailing commas and double commas from a hurried moderator
 * do not become empty list items.
 */
export function parseInstruments(raw?: string | null): string[] {
  return (raw ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(capitalize);
}

/**
 * The "instruments · city" line §6 asks the profile hero to lead with, shared with the artist
 * card so the two never drift apart.
 *
 * Both fields are free text, so they are trimmed here and blanks are dropped rather than
 * rendered as a stray separator. Only the instruments are capitalized: a city is a proper noun
 * already, and forcing case on one would turn "Bengaluru" into someone's guess.
 *
 * Instruments are joined with commas and the city follows a middot, so the two levels stay
 * legible: "Mridangam, Vocal · Chennai" reads as two instruments in one place, not three
 * things in a row.
 *
 * Returns undefined when neither field is set, so callers can fall back with `??` instead of
 * testing for an empty string.
 */
export function artistTagline(artist: {
  instrument?: string | null;
  city?: string | null;
}): string | undefined {
  const instruments = parseInstruments(artist.instrument);
  const city = artist.city?.trim();
  const parts = [instruments.length > 0 ? instruments.join(', ') : null, city || null].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

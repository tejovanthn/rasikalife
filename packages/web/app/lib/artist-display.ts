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

/**
 * The meta description for an artist profile, built from the fields the record
 * actually holds.
 *
 * What it replaces said: "Learn about X, a renowned artist in Indian classical
 * music. Discover their musical journey and contributions to classical traditions."
 * That is the same sentence for all 1,111 artists, carries no fact, and asserts
 * "renowned" of everybody — the exact inflation the guru `relationship` field
 * exists to prevent, applied site-wide. Search Console shows the cost: artist-name
 * queries take 2,469 impressions at 0.97% CTR, the largest class on the site and
 * nearly the worst-converting.
 *
 * So: instrument and city, the lineage that is the real credential here, and
 * whether there is a concert coming up. Nothing evaluative — a page that says what
 * an artist plays and who they studied under earns the click on its own.
 */
export function artistMetaDescription(artist: {
  name: string;
  isGroup?: boolean;
  instrument?: string | null;
  city?: string | null;
  gurus?: Array<{ name: string; relationship?: string }> | null;
  specialisations?: string[] | null;
  upcomingEventCount?: number;
}): string {
  const sentences: string[] = [];

  const tagline = artistTagline(artist);
  const specialisation = artist.specialisations?.filter(Boolean)[0];
  const lead = tagline ?? (specialisation ? capitalize(specialisation) : undefined);
  sentences.push(lead ? `${artist.name} — ${lead}.` : `${artist.name}.`);

  // Only lineage-grade relationships. A workshop teacher is not a guru, and
  // "disciple of" is precisely the claim that must not be inflated.
  const lineage = (artist.gurus ?? []).filter(
    g =>
      g.name && (!g.relationship || g.relationship === 'primary' || g.relationship === 'advanced')
  );
  if (lineage.length > 0) {
    const names = lineage.slice(0, 2).map(g => g.name);
    sentences.push(`${artist.isGroup ? 'Trained under' : 'Disciple of'} ${names.join(' and ')}.`);
  }

  const upcoming = artist.upcomingEventCount ?? 0;
  if (upcoming > 0) {
    sentences.push(`${upcoming} upcoming concert${upcoming === 1 ? '' : 's'}.`);
  } else if (sentences.length === 1) {
    // Nothing specific is known, so describe the page rather than the person.
    sentences.push(
      `Concerts, repertoire and recordings on Rasika.life, the Indian classical arts wiki.`
    );
  }

  return sentences.join(' ');
}

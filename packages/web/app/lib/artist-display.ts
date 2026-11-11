import {
  type CitableArtistField,
  type StoredCitation,
  numberArtistReferences,
} from '@rasika/core/domain/artist/client';
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
 * The <title> for an artist profile. It used to read "X - Artist - Rasika.life": the page
 * ranked #2 for "savita vasu" (139 impressions, 28 days) and got a 6% click rate, because
 * the one word that tells a searcher they found the right person — what they play — was
 * missing. Instrument only, not city: the title is the short form, the description carries
 * the rest.
 */
export function artistMetaTitle(artist: {
  name: string;
  instrument?: string | null;
  isHistorical?: boolean | null;
}): string {
  const instruments = parseInstruments(artist.instrument);
  const lead = instruments.length > 0 ? `${artist.name} – ${instruments.join(', ')}` : artist.name;
  // The lead is the same. A person who died in 1835 has no concerts, so the tail changes.
  return `${lead} | ${artist.isHistorical ? 'Life & Compositions' : 'Concerts & Repertoire'} – Rasika.life`;
}

/**
 * "1775–1835", "born 1775", or "died 1835". Years only: a source that gives a Saka year and an
 * AD year gives us the AD year, and the day and month are never claimed.
 */
export function lifeSpan(artist: {
  birthYear?: number | null;
  deathYear?: number | null;
}): string | undefined {
  const { birthYear, deathYear } = artist;
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `born ${birthYear}`;
  if (deathYear) return `died ${deathYear}`;
  return undefined;
}

/** A year and a place on one line: "1775, Tiruvarur". Either may be missing. */
function yearAndPlace(year?: number | null, place?: string | null): string | undefined {
  const parts = [year ? String(year) : '', place?.trim() ?? ''].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export interface LifeFact {
  label: string;
  value: string;
  /** The fields whose citations back this line, for its footnotes. */
  fields: CitableArtistField[];
}

/**
 * The Born, Died, Mudra and Also known as lines of the profile rail. Pure, so the rules are
 * tested here. The record has already been through `shownArtist`, so a historical person's
 * uncited fields are absent and their lines do not appear.
 */
export function lifeFacts(artist: {
  birthYear?: number | null;
  birthPlace?: string | null;
  deathYear?: number | null;
  deathPlace?: string | null;
  mudra?: string | null;
  alternateNames?: string[] | null;
}): LifeFact[] {
  const facts: LifeFact[] = [];
  const born = yearAndPlace(artist.birthYear, artist.birthPlace);
  if (born) facts.push({ label: 'Born', value: born, fields: ['birthYear', 'birthPlace'] });
  const died = yearAndPlace(artist.deathYear, artist.deathPlace);
  if (died) facts.push({ label: 'Died', value: died, fields: ['deathYear', 'deathPlace'] });
  const mudra = artist.mudra?.trim();
  if (mudra) facts.push({ label: 'Mudra', value: mudra, fields: ['mudra'] });
  const others = (artist.alternateNames ?? []).map(n => n.trim()).filter(Boolean);
  if (others.length > 0) {
    facts.push({ label: 'Also written', value: others.join(', '), fields: ['alternateNames'] });
  }
  return facts;
}

/** Page order, top to bottom. Footnotes are numbered in this order. */
export const ARTIST_PAGE_FIELDS: readonly CitableArtistField[] = [
  'birthYear',
  'birthPlace',
  'deathYear',
  'deathPlace',
  'mudra',
  'alternateNames',
  'instrument',
  'specialisations',
  'gurus',
  'works',
];

/** The numbered references for the fields the page shows, and each field's footnotes. */
export function artistReferences(artist: { citations?: StoredCitation[] | null }) {
  const { references, footnotes } = numberArtistReferences(artist, ARTIST_PAGE_FIELDS);
  return { references, footnotes };
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
  /** A person long dead, from a published source: no concerts, and the life span leads. */
  isHistorical?: boolean | null;
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  mudra?: string | null;
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

  if (artist.isHistorical) {
    const span = lifeSpan(artist);
    if (span) sentences.push(`${capitalize(span)}.`);
    const place = artist.birthPlace?.trim();
    if (place) sentences.push(`Born in ${place}.`);
    const mudra = artist.mudra?.trim();
    if (mudra) sentences.push(`Mudra: ${mudra}.`);
  }

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

  // A historical person has no concerts to count, and the line would only ever be wrong.
  const upcoming = artist.isHistorical ? 0 : (artist.upcomingEventCount ?? 0);
  if (upcoming > 0) {
    sentences.push(`${upcoming} upcoming concert${upcoming === 1 ? '' : 's'}.`);
  } else if (sentences.length === 1) {
    // Nothing specific is known, so describe the page rather than the person.
    sentences.push(
      artist.isHistorical
        ? 'Life, compositions and sources on Rasika.life, the Indian classical arts wiki.'
        : 'Concerts, repertoire and recordings on Rasika.life, the Indian classical arts wiki.'
    );
  }

  return sentences.join(' ');
}

/**
 * A stored `EventArtist` credit as words a reader can take in: "chief-guest" and
 * "guest_of_honour" are slugs typed by whoever verified the poster, and printing them raw put
 * hyphens in the middle of a cast list. Lowercase, so it sits inside a sentence or a bracket;
 * a caller that wants a heading can capitalise it with CSS.
 */
export function roleLabel(role: string): string {
  const label = role.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  // Billing positions, not instruments: the event crawl stores "main" and "accompanist" when a
  // listing names no instrument. "Sandeep Narayan (main)" tells a reader nothing.
  return GENERIC_ROLES.has(label) ? '' : label;
}

/** Roles that say where someone was billed, not what they played. Kept in step with core's
 * `shared/event-card.ts`. */
export const GENERIC_ROLES = new Set(['main', 'accompanist', 'performer', 'artist', 'artiste']);

/**
 * An event's cast on one line, each with what they played: "Vid. Sunil Gargyan (vocal),
 * Keshav Mohankumar (violin)". The role is the stored `EventArtist` credit, read off the
 * poster; the accompanists are who a rasika is often choosing between concerts for.
 */
export function castLine(
  artists: Array<{ title?: string | null; name: string; role?: string | null }>,
  opts: { max?: number } = {}
): string {
  const named = artists.map(a => {
    const name = `${a.title ? `${a.title} ` : ''}${a.name}`;
    const role = a.role ? roleLabel(a.role) : '';
    return role ? `${name} (${role})` : name;
  });
  // A card has room for a concert's cast, not a production's: one Ramayana presentation
  // credits about thirty singers. The event page lists everyone.
  const { max } = opts;
  if (!max || named.length <= max) return named.join(', ');
  return `${named.slice(0, max).join(', ')} and ${named.length - max} more`;
}

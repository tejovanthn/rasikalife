/**
 * Which artist facts the site may show, and the references behind them.
 *
 * Mirrors `raga/sourced.ts`, with one difference. On a raga, every field outside the legacy
 * set shows only when cited. Here that rule applies **only to an artist with `isHistorical`**.
 * A living artist's page does not change: the facts on it were never cited, and hiding them
 * would empty 1,169 pages. A historical person comes from a published source (SSP), so each
 * of that source's claims prints with its reference or not at all.
 *
 * Citations are a moderator's to set, as on a raga. Browser-safe and pure.
 */

import type { z } from 'zod';
import {
  type Cited,
  type Reference,
  type StoredCitation,
  citationSchemaFor,
  citationsOf,
  isEmptyValue,
  numberReferencesOf,
  pruneCitationsOf,
} from '../source/citations';

/** Every artist field a citation may back. */
export const CITABLE_ARTIST_FIELDS = [
  'birthYear',
  'deathYear',
  'birthPlace',
  'deathPlace',
  'mudra',
  'gurus',
  'works',
  'alternateNames',
  'instrument',
  'specialisations',
] as const;

export type CitableArtistField = (typeof CITABLE_ARTIST_FIELDS)[number];

/**
 * Shown while uncited, on a historical artist too, as raga's `LEGACY_FIELDS`. These were on
 * the record before citations existed: Tyagaraja, Muttuswami Dikshitar and Syama Sastri all
 * carry an uncited birthplace and specialisations, and marking them historical must not empty
 * their pages. Only what SSP brings for the first time (years, death place, mudra) needs a
 * citation to show.
 */
export const LEGACY_ARTIST_FIELDS: ReadonlySet<CitableArtistField> = new Set([
  'birthPlace',
  'gurus',
  'works',
  'alternateNames',
  'instrument',
  'specialisations',
]);

export const ArtistCitationSchema = citationSchemaFor(CITABLE_ARTIST_FIELDS);

export type ArtistCitation = z.infer<typeof ArtistCitationSchema>;

export type { Reference, StoredCitation };
export { isEmptyValue };

interface CitedArtist extends Cited {
  isHistorical?: boolean | null;
}

export function artistCitationsFor(artist: Cited, field: CitableArtistField): StoredCitation[] {
  return citationsOf(artist, field);
}

export function isArtistCited(artist: Cited, field: CitableArtistField): boolean {
  return artistCitationsFor(artist, field).length > 0;
}

/**
 * A field the page may show. Anyone who is not historical shows everything, as before. A
 * historical person shows a legacy field always and any other field only when it is cited.
 */
export function isArtistFieldShown(artist: CitedArtist, field: CitableArtistField): boolean {
  return !artist.isHistorical || LEGACY_ARTIST_FIELDS.has(field) || isArtistCited(artist, field);
}

/**
 * The record with every field it may not show removed. The page, the meta description and the
 * JSON-LD read this, never the record, so all three make the same claim.
 */
export function shownArtist<T extends CitedArtist>(artist: T): T {
  if (!artist.isHistorical) return artist;
  const out = { ...artist } as Record<string, unknown>;
  for (const field of CITABLE_ARTIST_FIELDS) {
    if (!isArtistFieldShown(artist, field)) delete out[field];
  }
  return out as T;
}

/** Numbered references in the order `fields` lists them (the order the page shows them). */
export function numberArtistReferences(artist: Cited, fields: readonly CitableArtistField[]) {
  return numberReferencesOf(artist, fields);
}

/** Clearing a field takes its citations with it. */
export function pruneArtistCitations<C extends StoredCitation>(
  artist: { citations?: C[] | null } & Record<string, unknown>
): C[] {
  return pruneCitationsOf(artist);
}

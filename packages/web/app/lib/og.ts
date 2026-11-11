const BASE_URL = 'https://rasika.life';

export function artistOgImageUrl(artistId: string): string {
  return `${BASE_URL}/og/artist/${artistId}`;
}

export function ragaOgImageUrl(ragaId: string): string {
  return `${BASE_URL}/og/raga/${ragaId}`;
}

export function compositionOgImageUrl(compositionId: string): string {
  return `${BASE_URL}/og/composition/${compositionId}`;
}

export function eventOgImageUrl(eventId: string): string {
  return `${BASE_URL}/og/event/${eventId}`;
}

export const GENERIC_OG_IMAGE_URL = `${BASE_URL}/og-image.png`;

/**
 * The share image for an event, first match wins: the 1200x630 poster crop, the poster itself
 * (may be portrait, still better than nothing), the festival's poster, the generated text card
 * (a posterless event has no picture of its own), and the generic image only as a last resort.
 * Whitespace-only strings count as missing.
 */
export function eventOgImage(
  event: { id?: string; posterOgUrl?: string | null; posterUrl?: string | null },
  festivalPosterUrl?: string | null
): string {
  const pick = (u?: string | null) => (u?.trim() ? u : undefined);
  return (
    pick(event.posterOgUrl) ||
    pick(event.posterUrl) ||
    pick(festivalPosterUrl) ||
    (event.id ? eventOgImageUrl(event.id) : GENERIC_OG_IMAGE_URL)
  );
}

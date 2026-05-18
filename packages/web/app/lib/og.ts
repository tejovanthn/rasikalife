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

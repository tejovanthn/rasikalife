// URL slug utilities for generating and parsing URL-safe slugs with special characters

/**
 * Generate a URL-safe slug from a title
 * @param title - The original title text
 * @returns URL-encoded slug safe for use in routes
 */
export function generateSlug(title: string): string {
  // Convert to lowercase and replace spaces with hyphens
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  // URL encode to handle special characters
  return encodeURIComponent(slug);
}

/**
 * Parse a slug from a route parameter, extracting the title and ID
 * KSUID is always 27 characters and contains hyphens, so we extract from the end
 * Also handles ID-only URLs (just the 27-char KSUID without a title prefix)
 * @param param - The route parameter (e.g., "title-slug-id" or just "id")
 * @returns Object with title and id, or null if invalid
 */
export function parseSlug(param: string): { title: string; id: string } | null {
  try {
    // URL decode first to handle encoded special characters
    const decoded = decodeURIComponent(param);

    // Handle ID-only URLs (exactly 27 characters = KSUID only)
    if (decoded.length === 27) {
      return { title: '', id: decoded };
    }

    // KSUID is always 27 characters, extract from the end
    if (decoded.length < 28) {
      return null; // Not enough characters for a valid slug
    }

    const id = decoded.slice(-27);
    const title = decoded.slice(0, -28); // Everything before the ID and its preceding hyphen

    if (!id) {
      return null; // Empty ID
    }

    return { title: title || '', id };
  } catch (error) {
    // Invalid URL encoding
    return null;
  }
}

/**
 * Generate a full URL path for a composition
 * @param title - Composition title
 * @param id - Composition ID
 * @returns Full URL path with proper encoding
 */
export function generateCompositionUrl(title: string, id: string): string {
  return `/carnatic/compositions/${generateSlug(title)}-${id}`;
}

/**
 * Generate a full URL path for an artist
 * @param name - Artist name
 * @param id - Artist ID
 * @returns Full URL path with proper encoding
 */
export function generateArtistUrl(name: string, id: string): string {
  return `/artists/${generateSlug(name)}-${id}`;
}

/**
 * Generate a full URL path for a raga
 * @param name - Raga name
 * @param id - Raga ID
 * @returns Full URL path with proper encoding
 */
export function generateRagaUrl(name: string, id: string): string {
  return `/carnatic/ragas/${generateSlug(name)}-${id}`;
}

/**
 * Generate a full URL path for a tala
 * @param name - Tala name
 * @param id - Tala ID
 * @returns Full URL path with proper encoding
 */
export function generateTalaUrl(name: string, id: string): string {
  return `/carnatic/talas/${generateSlug(name)}-${id}`;
}

/**
 * Generate a full URL path for a language
 * @param name - Language name
 * @returns Full URL path with proper encoding
 */
export function generateLanguageUrl(name: string): string {
  return `/carnatic/languages/${generateSlug(name)}`;
}

export function generateEventUrl(title: string, id: string): string {
  return `/events/${generateSlug(title)}-${id}`;
}

export function generateFestivalUrl(name: string, id: string): string {
  return `/festivals/${generateSlug(name)}-${id}`;
}

export function generateVenueUrl(name: string, id: string): string {
  return `/venues/${generateSlug(name)}-${id}`;
}

export function generateOrganiserUrl(name: string, id: string): string {
  return `/organisers/${generateSlug(name)}-${id}`;
}

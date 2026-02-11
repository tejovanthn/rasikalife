# SEO-Friendly URLs with KSUID - Best of Both Worlds

## Introduction

URLs are a critical part of user experience and SEO. Readable URLs help users understand content and improve search rankings, while stable IDs prevent broken links. This blog post explores how to combine human-readable slugs with K-Sortable Unique Identifiers (KSUIDs) to create URLs that are both SEO-friendly and technically robust.

**Related ADRs:**
- [ADR-009: Overall Architecture Patterns](../adrs/adr-009-overall-architecture-patterns.md)

## The URL Challenge

### Competing Requirements

**Users and SEO want:**
```
/artists/m-s-subbulakshmi
/compositions/raghuvamsa-sudha
/ragas/bhairavi
```

**Developers need:**
```
/artists/2YN7xZX9pO7VG8m4k1jK8qB2YxE
/compositions/2YN8mPXK2L9VH3n5k2jL9rC3ZyF
/ragas/2YN9nQYL3M0WI4o6l3kM0sD4AzG
```

### Traditional Approaches and Problems

#### 1. Slug-Only URLs

```typescript
// Problem: Slugs can collide
/artists/ms-subbulakshmi   // MS Subbulakshmi
/artists/ms-subbulakshmi   // M S Subbulakshmi (different artist!)

// Solution requires complex logic
/artists/ms-subbulakshmi-1
/artists/ms-subbulakshmi-2  // Ugly and arbitrary
```

#### 2. ID-Only URLs

```typescript
// Problem: Not SEO-friendly or user-friendly
/artists/2YN7xZX9pO7VG8m4k1jK8qB2YxE  // What artist is this?
```

#### 3. Separate Slug Database Table

```typescript
// Problem: Extra queries and complexity
// Route: /artists/ms-subbulakshmi
// 1. Query slugs table: slug -> artistId
// 2. Query artists table: artistId -> artist data
```

## The Hybrid Solution: Slug + KSUID

### URL Format

```
/artists/{slug}-{ksuid}
/artists/m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE
         ^readable slug^   ^27-char KSUID^
```

**Benefits:**
- ✅ SEO-friendly: Contains readable keywords
- ✅ Stable: ID doesn't change if name changes
- ✅ Unique: KSUID guarantees uniqueness
- ✅ Simple: No slug collision handling needed
- ✅ Parseable: KSUID's fixed length makes parsing reliable

### Why KSUID is Perfect for This

**KSUID Properties:**
- **Fixed length**: Always 27 characters
- **URL-safe**: Base62-encoded (alphanumeric only)
- **No special characters**: No hyphens in the KSUID itself
- **Globally unique**: Collision-free
- **Time-sortable**: Bonus benefit for ordering

**Related Reading:** [KSUID vs UUID](./ksuid-vs-uuid-dynamodb.md)

## Implementation

### URL Generation

```typescript
// packages/web/app/lib/url-slug.ts

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
 * Generate a full URL path for an artist
 * @param name - Artist name
 * @param id - Artist KSUID
 * @returns Full URL path with proper encoding
 */
export function generateArtistUrl(name: string, id: string): string {
  return `/carnatic/artists/${generateSlug(name)}-${id}`;
}

// Usage examples
generateArtistUrl('M.S. Subbulakshmi', '2YN7xZX9pO7VG8m4k1jK8qB2YxE')
// Returns: /carnatic/artists/m.s.-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE

generateArtistUrl('Rāga Bhairavi', '2YN9nQYL3M0WI4o6l3kM0sD4AzG')
// Returns: /carnatic/ragas/r%C4%81ga-bhairavi-2YN9nQYL3M0WI4o6l3kM0sD4AzG
```

### URL Parsing

```typescript
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

// Usage examples
parseSlug('m.s.-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE')
// Returns: { title: 'm.s.-subbulakshmi', id: '2YN7xZX9pO7VG8m4k1jK8qB2YxE' }

parseSlug('2YN7xZX9pO7VG8m4k1jK8qB2YxE')
// Returns: { title: '', id: '2YN7xZX9pO7VG8m4k1jK8qB2YxE' }

parseSlug('invalid')
// Returns: null
```

### Entity-Specific URL Generators

```typescript
/**
 * Generate a full URL path for a composition
 */
export function generateCompositionUrl(title: string, id: string): string {
  return `/carnatic/compositions/${generateSlug(title)}-${id}`;
}

/**
 * Generate a full URL path for a raga
 */
export function generateRagaUrl(name: string, id: string): string {
  return `/carnatic/ragas/${generateSlug(name)}-${id}`;
}

/**
 * Generate a full URL path for a tala
 */
export function generateTalaUrl(name: string, id: string): string {
  return `/carnatic/talas/${generateSlug(name)}-${id}`;
}

/**
 * Generate a full URL path for a language
 */
export function generateLanguageUrl(name: string): string {
  return `/carnatic/languages/${generateSlug(name)}`;
}
```

## Remix Route Integration

### Dynamic Route Definition

```typescript
// packages/web/app/routes/carnatic.artists.$artistid.tsx

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { parseSlug } from '~/lib/url-slug';
import { trpc } from '~/lib/trpc';

export async function loader({ params }: LoaderFunctionArgs) {
  const parsed = parseSlug(params.artistid!);

  if (!parsed) {
    throw new Response('Invalid artist URL', { status: 400 });
  }

  // Fetch artist by ID (ignore the slug part)
  const artist = await trpc.artist.getById.query({ id: parsed.id });

  if (!artist) {
    throw new Response('Artist not found', { status: 404 });
  }

  return json({ artist });
}

export default function ArtistPage() {
  const { artist } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{artist.name}</h1>
      {/* Artist details */}
    </div>
  );
}
```

### Generating Links

```tsx
// Component that generates artist links
import { generateArtistUrl } from '~/lib/url-slug';

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <div>
      <Link to={generateArtistUrl(artist.name, artist.id)}>
        {artist.name}
      </Link>
    </div>
  );
}

// Rendered HTML
<a href="/carnatic/artists/m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE">
  M.S. Subbulakshmi
</a>
```

## Advanced Patterns

### Canonical URL Handling

```typescript
// Redirect to canonical URL if slug is outdated
export async function loader({ params, request }: LoaderFunctionArgs) {
  const parsed = parseSlug(params.artistid!);

  if (!parsed) {
    throw new Response('Invalid URL', { status: 400 });
  }

  const artist = await trpc.artist.getById.query({ id: parsed.id });

  if (!artist) {
    throw new Response('Not found', { status: 404 });
  }

  // Generate canonical URL from current artist name
  const canonicalSlug = generateSlug(artist.name);
  const currentSlug = parsed.title;

  // If slug doesn't match current name, redirect to canonical URL
  if (currentSlug !== canonicalSlug && currentSlug !== '') {
    const canonicalUrl = generateArtistUrl(artist.name, artist.id);
    return redirect(canonicalUrl, 301); // Permanent redirect
  }

  return json({ artist });
}

// Example:
// Old URL: /artists/ms-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE
// Artist name changed to: "M.S. Subbulakshmi"
// Redirects to: /artists/m.s.-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE
```

### Special Character Handling

```typescript
// Handle various special characters
export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')      // Spaces to hyphens
    .replace(/['']/g, '')      // Remove apostrophes
    .replace(/[.]/g, '')       // Remove periods
    .replace(/[\/\\]/g, '-');  // Forward/backslashes to hyphens

  // URL encode to handle remaining special characters
  return encodeURIComponent(slug);
}

// Examples
generateSlug("M.S. Subbulakshmi")     // "ms-subbulakshmi"
generateSlug("Rāga Bhairavi")          // "r%C4%81ga-bhairavi"
generateSlug("Thyāgarāja's Kriti")     // "thy%C4%81gar%C4%81jas-kriti"
generateSlug("Adi Tala (8 beats)")    // "adi-tala-%288-beats%29"
```

### ID-Only URL Support

```typescript
// Support both formats:
// 1. Full: /artists/m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE
// 2. ID-only: /artists/2YN7xZX9pO7VG8m4k1jK8qB2YxE

export function parseSlug(param: string): { title: string; id: string } | null {
  const decoded = decodeURIComponent(param);

  // ID-only URL (exactly 27 characters)
  if (decoded.length === 27) {
    return { title: '', id: decoded };
  }

  // Full slug-id URL (28+ characters)
  if (decoded.length >= 28) {
    const id = decoded.slice(-27);
    const title = decoded.slice(0, -28);
    return { title, id };
  }

  return null;
}

// Both work:
parseSlug('m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE')
parseSlug('2YN7xZX9pO7VG8m4k1jK8qB2YxE')
```

### URL Validation

```typescript
// Validate URL structure
export function isValidSlugParam(param: string): boolean {
  const parsed = parseSlug(param);

  if (!parsed) {
    return false;
  }

  // Validate KSUID format (27 alphanumeric characters)
  const ksuidRegex = /^[0-9A-Za-z]{27}$/;
  return ksuidRegex.test(parsed.id);
}

// Usage in routes
export async function loader({ params }: LoaderFunctionArgs) {
  if (!isValidSlugParam(params.artistid!)) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  // ... rest of loader
}
```

## SEO Optimization

### Meta Tags with Proper URLs

```tsx
// packages/web/app/routes/carnatic.artists.$artistid.tsx
export function meta({ data }: Route.MetaArgs) {
  if (!data?.artist) {
    return [{ title: 'Artist not found' }];
  }

  const { artist } = data;
  const canonicalUrl = `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`;

  return [
    { title: `${artist.name} - Rasika.life` },
    { name: 'description', content: artist.description || `Carnatic artist ${artist.name}` },

    // Canonical URL
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },

    // Open Graph
    { property: 'og:title', content: artist.name },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'profile' },

    // Twitter Card
    { name: 'twitter:title', content: artist.name },
    { name: 'twitter:url', content: canonicalUrl },
  ];
}
```

### Structured Data

```tsx
// Add JSON-LD structured data
export function loader({ params }: LoaderFunctionArgs) {
  const parsed = parseSlug(params.artistid!);
  const artist = await trpc.artist.getById.query({ id: parsed!.id });

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: artist.name,
    url: `https://rasika.life${generateArtistUrl(artist.name, artist.id)}`,
    description: artist.description,
    // ... more fields
  };

  return json({ artist, structuredData });
}

export default function ArtistPage() {
  const { artist, structuredData } = useLoaderData<typeof loader>();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Rest of page */}
    </>
  );
}
```

### Sitemap Generation

```typescript
// packages/web/app/routes/sitemap[.]xml.tsx
import { Artist } from '@rasika/core';
import { generateArtistUrl } from '~/lib/url-slug';

export async function loader() {
  // Fetch all artists
  let allArtists: Artist[] = [];
  let nextToken: string | undefined;

  do {
    const result = await Artist.listArtists({ limit: 1000, nextToken });
    allArtists = allArtists.concat(result.items);
    nextToken = result.nextToken;
  } while (nextToken);

  // Generate sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allArtists
    .map(
      artist => `
  <url>
    <loc>https://rasika.life${generateArtistUrl(artist.name, artist.id)}</loc>
    <lastmod>${artist.updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlug, parseSlug, generateArtistUrl } from '~/lib/url-slug';

describe('URL Slug Utilities', () => {
  describe('generateSlug', () => {
    it('should convert title to lowercase and replace spaces', () => {
      expect(generateSlug('M.S. Subbulakshmi')).toBe('m.s.-subbulakshmi');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Rāga Bhairavi')).toBe('r%C4%81ga-bhairavi');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('Word  With   Spaces')).toBe('word-with-spaces');
    });
  });

  describe('parseSlug', () => {
    const testId = '2YN7xZX9pO7VG8m4k1jK8qB2YxE';

    it('should parse full slug-id URL', () => {
      const result = parseSlug(`m-s-subbulakshmi-${testId}`);
      expect(result).toEqual({
        title: 'm-s-subbulakshmi',
        id: testId,
      });
    });

    it('should parse ID-only URL', () => {
      const result = parseSlug(testId);
      expect(result).toEqual({
        title: '',
        id: testId,
      });
    });

    it('should handle URL-encoded slugs', () => {
      const result = parseSlug(`r%C4%81ga-bhairavi-${testId}`);
      expect(result).toEqual({
        title: 'rāga-bhairavi',
        id: testId,
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseSlug('invalid')).toBeNull();
      expect(parseSlug('too-short')).toBeNull();
    });
  });

  describe('generateArtistUrl', () => {
    it('should generate complete URL path', () => {
      const url = generateArtistUrl('M.S. Subbulakshmi', '2YN7xZX9pO7VG8m4k1jK8qB2YxE');
      expect(url).toBe('/carnatic/artists/m.s.-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE');
    });
  });
});
```

### Integration Tests

```typescript
describe('Artist URL Routes', () => {
  it('should load artist with full slug URL', async () => {
    const artist = await createTestArtist({ name: 'M.S. Subbulakshmi' });
    const url = generateArtistUrl(artist.name, artist.id);

    const response = await fetch(`http://localhost:3000${url}`);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('M.S. Subbulakshmi');
  });

  it('should load artist with ID-only URL', async () => {
    const artist = await createTestArtist({ name: 'M.S. Subbulakshmi' });

    const response = await fetch(`http://localhost:3000/carnatic/artists/${artist.id}`);

    expect(response.status).toBe(200);
  });

  it('should redirect to canonical URL for outdated slug', async () => {
    const artist = await createTestArtist({ name: 'M.S. Subbulakshmi' });

    // Update artist name
    await updateArtist(artist.id, { name: 'M. S. Subbulakshmi' });

    // Access with old slug
    const oldUrl = `/carnatic/artists/m.s.-subbulakshmi-${artist.id}`;
    const response = await fetch(`http://localhost:3000${oldUrl}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(
      `/carnatic/artists/m.-s.-subbulakshmi-${artist.id}`
    );
  });
});
```

## Best Practices

### 1. Always Use ID for Data Fetching
```typescript
// Correct - use ID, not slug
const artist = await trpc.artist.getById.query({ id: parsed.id });

// Wrong - don't query by slug
const artist = await trpc.artist.getBySlug.query({ slug: parsed.title });
```

### 2. Redirect to Canonical URLs
```typescript
// Always redirect to current slug for SEO
if (currentSlug !== canonicalSlug) {
  return redirect(generateArtistUrl(artist.name, artist.id), 301);
}
```

### 3. Handle URL Encoding Properly
```typescript
// Always encode when generating, decode when parsing
const slug = encodeURIComponent(title.toLowerCase());
const decoded = decodeURIComponent(param);
```

### 4. Support ID-Only URLs
```typescript
// Both should work for backwards compatibility
/artists/m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE
/artists/2YN7xZX9pO7VG8m4k1jK8qB2YxE
```

### 5. Include Canonical Meta Tags
```tsx
// Always specify canonical URL
<link rel="canonical" href={canonicalUrl} />
```

## Common Pitfalls

### 1. Using Slug for Queries
**Problem**: Querying by slug instead of ID
```typescript
// Wrong
const artist = await Artist.getBySlug(parsed.title);
```

**Solution**: Always use ID
```typescript
// Correct
const artist = await Artist.getById(parsed.id);
```

### 2. Not Handling Name Changes
**Problem**: Broken links when names change

**Solution**: Redirect old slugs to new canonical URLs

### 3. Inconsistent Slug Generation
**Problem**: Different slug generation in different places

**Solution**: Centralize slug generation logic

### 4. Not URL-Encoding Special Characters
**Problem**: Special characters break URLs

**Solution**: Always use encodeURIComponent

## Conclusion

Combining human-readable slugs with KSUIDs provides the best of both worlds: SEO-friendly URLs that users and search engines love, with stable identifiers that prevent broken links. KSUID's fixed 27-character length makes parsing reliable and straightforward.

For the Rasika.life platform, this approach enables beautiful, meaningful URLs like `/artists/m-s-subbulakshmi-2YN7xZX9pO7VG8m4k1jK8qB2YxE` that work well for users, search engines, and developers.

**Related Reading:**
- [KSUID Implementation](./ksuid-vs-uuid-dynamodb.md)
- [Remix v2 Frontend Patterns](./remix-frontend-patterns.md)

## Resources

- [KSUID Specification](https://github.com/segmentio/ksuid)
- [URL Structure and SEO](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Remix Route Parameters](https://remix.run/docs/en/main/guides/routing#dynamic-segments)
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';

// Artist type from @rasika/core domain/artist
type Artist = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export async function loader({ params }: { params: { artistid?: string } }) {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const slugId = artistid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const artist = await client.artist.get.query({ id: slugId });

    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    return json({
      artist,
      breadcrumbs: [
        { name: 'Home', href: '/' },
        { name: 'Carnatic', href: '/carnatic' },
        { name: 'Artists', href: '/carnatic/artists' },
        { name: artist.name, href: `/carnatic/artists/${artistid}` },
      ],
    });
  } catch (error) {
    console.error('Failed to load artist:', error);
    throw new Response('Failed to load artist', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const artist = (data as any)?.artist;

  if (artist) {
    return [
      { title: `${artist.name} - Artist - Rasika.life` },
      {
        name: 'description',
        content: `Learn about ${artist.name}, a renowned artist in Indian classical music. Discover their musical journey and contributions to classical traditions.`,
      },
      {
        name: 'keywords',
        content: `${artist.name}, Indian classical music artist, Carnatic musician, Hindustani artist, classical music`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${artist.name} - Indian Classical Music Artist` },
      {
        property: 'og:description',
        content: `Learn about ${artist.name} and their contributions to Indian classical music`,
      },
      { property: 'og:type', content: 'profile' },
      {
        property: 'og:url',
        content: `https://rasika.life/carnatic/artists/${artist.name.toLowerCase().replace(/\s+/g, '-')}-${artist.id}`,
      },
      // Profile-specific Open Graph
      { property: 'profile:first_name', content: artist.name.split(' ')[0] },
      { property: 'profile:last_name', content: artist.name.split(' ').slice(1).join(' ') },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${artist.name} - Artist` },
      { name: 'twitter:description', content: `Indian classical music artist ${artist.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life/carnatic/artists/${artist.name.toLowerCase().replace(/\s+/g, '-')}-${artist.id}`,
      },
      // Breadcrumb structured data
      {
        tagName: 'script',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://rasika.life' },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Carnatic',
              item: 'https://rasika.life/carnatic',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Artists',
              item: 'https://rasika.life/carnatic/artists',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: artist.name,
              item: `https://rasika.life/carnatic/artists/${artist.name.toLowerCase().replace(/\s+/g, '-')}-${artist.id}`,
            },
          ],
        }),
      },
    ];
  }

  return [
    { title: 'Artist - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about artists in Indian classical music.',
    },
  ];
};

interface Artist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function ArtistDetails() {
  const { artist } = useLoaderData<{
    artist: Artist;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
        <p className="text-lg text-muted-foreground">Indian Classical Music Artist</p>
      </header>

      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {artist.name}
          </p>
          <p>
            <strong>Added:</strong> {new Date(artist.createdAt).toLocaleDateString()}
          </p>
        </div>
      </section>

      {/* Cross-linking section */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore More</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/carnatic/artists"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Artists</h3>
            <p className="text-sm text-muted-foreground">Browse other musicians</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Explore musical works</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Discover the tradition</p>
          </Link>
        </div>
      </section>
    </main>
  );
}

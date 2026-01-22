interface StructuredDataProps {
  type: 'organization' | 'website' | 'breadcrumb' | 'person' | 'music';
  data: Record<string, unknown>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type':
      type === 'organization'
        ? 'Organization'
        : type === 'website'
          ? 'WebSite'
          : type === 'breadcrumb'
            ? 'BreadcrumbList'
            : type === 'person'
              ? 'Person'
              : type === 'music'
                ? 'MusicComposition'
                : 'Thing',
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD structured data
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}

// Specific components for different types
export function OrganizationStructuredData() {
  return (
    <StructuredData
      type="organization"
      data={{
        name: 'Rasika.life',
        url: 'https://rasika.life',
        description: 'Indian Classical Music Database',
        sameAs: [
          // Add social media URLs when available
        ],
      }}
    />
  );
}

export function WebsiteStructuredData() {
  return (
    <StructuredData
      type="website"
      data={{
        name: 'Rasika.life',
        url: 'https://rasika.life',
        description: 'Explore the world of Indian classical music',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://rasika.life/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

export function BreadcrumbStructuredData({
  items,
}: { items: Array<{ name: string; item: string }> }) {
  return (
    <StructuredData
      type="breadcrumb"
      data={{
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.item,
        })),
      }}
    />
  );
}

export function PersonStructuredData({ person }: { person: { name: string; url: string } }) {
  return (
    <StructuredData
      type="person"
      data={{
        name: person.name,
        description: 'Renowned classical musician in Indian classical music',
        url: person.url,
        knowsAbout: ['Carnatic Music', 'Indian Classical Music'],
        hasOccupation: {
          '@type': 'Occupation',
          name: 'Classical Musician',
          occupationalCategory: 'Arts and Entertainment',
        },
      }}
    />
  );
}

export function MusicCompositionStructuredData({
  composition,
}: {
  composition: {
    title: string;
    composer: { name: string };
    ragas: Array<{ name: string }>;
    talas: Array<{ name: string }>;
    language: string;
    url: string;
    datePublished?: string;
  };
}) {
  return (
    <StructuredData
      type="music"
      data={{
        name: composition.title,
        composer: {
          '@type': 'Person',
          name: composition.composer.name,
        },
        inAlbum:
          composition.ragas.length > 0
            ? {
                '@type': 'MusicAlbum',
                name: `${composition.ragas[0].name} Raga Collection`,
              }
            : undefined,
        genre: 'Carnatic Music',
        inLanguage: composition.language,
        url: composition.url,
        datePublished: composition.datePublished,
        description: `A ${composition.language} composition in ${composition.ragas.map(r => r.name).join(', ')} raga(s) composed by ${composition.composer.name}`,
        keywords: [
          ...composition.ragas.map(r => r.name),
          ...composition.talas.map(t => t.name),
          composition.language,
          'Carnatic Music',
          composition.composer.name,
        ].filter(Boolean),
      }}
    />
  );
}

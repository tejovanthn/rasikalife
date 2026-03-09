interface StructuredDataProps {
  type: 'organization' | 'website' | 'breadcrumb' | 'person' | 'music' | 'event' | 'festival';
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
                : type === 'event'
                  ? 'MusicEvent'
                  : type === 'festival'
                    ? 'Festival'
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

export function EventStructuredData({
  event,
}: {
  event: {
    title: string;
    description?: string;
    startDateTime: string;
    endDateTime?: string;
    venueName?: string;
    organiserName?: string;
    organiserUrl?: string;
    posterUrl?: string;
    entryType?: string;
    artists?: Array<{ name: string }>;
    url: string;
    ticketing?: {
      url?: string;
      prices?: Record<string, number>;
    };
  };
}) {
  const offers = (() => {
    if (event.entryType === 'free') {
      return [
        {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        },
      ];
    }
    if (event.ticketing?.prices && Object.keys(event.ticketing.prices).length > 0) {
      return Object.entries(event.ticketing.prices).map(([, price]) => ({
        '@type': 'Offer',
        price: String(price),
        priceCurrency: 'INR',
        ...(event.ticketing?.url ? { url: event.ticketing.url } : {}),
        availability: 'https://schema.org/InStock',
      }));
    }
    if (event.ticketing?.url) {
      return [
        { '@type': 'Offer', url: event.ticketing.url, availability: 'https://schema.org/InStock' },
      ];
    }
    return undefined;
  })();

  return (
    <StructuredData
      type="event"
      data={{
        name: event.title,
        description: event.description || `${event.title} - Indian classical arts event`,
        startDate: event.startDateTime,
        endDate: event.endDateTime,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        image: event.posterUrl,
        url: event.url,
        location: {
          '@type': 'Place',
          name: event.venueName || 'India',
        },
        organizer: event.organiserName
          ? {
              '@type': 'Organization',
              name: event.organiserName,
              ...(event.organiserUrl ? { url: event.organiserUrl } : {}),
            }
          : undefined,
        performer: event.artists?.map(a => ({
          '@type': 'Person',
          name: a.name,
        })),
        offers,
        isAccessibleForFree: event.entryType === 'free',
      }}
    />
  );
}

export function FestivalStructuredData({
  festival,
}: {
  festival: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    organiserName?: string;
    posterUrl?: string;
    url: string;
  };
}) {
  return (
    <StructuredData
      type="festival"
      data={{
        name: festival.name,
        description: festival.description || `${festival.name} - Indian classical arts festival`,
        startDate: festival.startDate,
        endDate: festival.endDate,
        image: festival.posterUrl,
        url: festival.url,
        organizer: festival.organiserName
          ? {
              '@type': 'Organization',
              name: festival.organiserName,
            }
          : undefined,
      }}
    />
  );
}

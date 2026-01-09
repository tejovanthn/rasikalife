import { client } from '~/api.server';
import type { EntityCardField } from '~/components/shared';

export interface DetailConfig {
  type: 'artists' | 'compositions' | 'ragas' | 'talas';
  singular: string;
  plural: string;
  apiEndpoint: 'artist' | 'composition' | 'raga' | 'tala';
  basePath: string;
  paramName: string; // artistid, compositionid, ragaid, talaid

  // SEO Configuration
  titleTemplate: (item: any) => string;
  descriptionTemplate: (item: any) => string;
  keywordsTemplate: (item: any) => string;
  schemaType: 'Person' | 'MusicComposition' | 'Article';

  // Layout Configuration
  hasImage: boolean;
  imageField?: string;
  nameField: string;
  subtitleField?: string;
  bioField?: string;

  // Header sections configuration
  getHeaderSections: (item: any) => Array<{
    title: string;
    items: Array<{ label: string; value: string | string[] | undefined }>;
  }>;

  // Main content sections
  getContentSections: (item: any) => Array<{
    title: string;
    content: string;
    format?: 'text' | 'pre-line' | 'list';
  }>;

  // Related items configuration
  relatedItemsConfig?: {
    title: string;
    getRelatedItems: (item: any) => Promise<any[]>;
  };

  // Breadcrumb configuration
  getBreadcrumbs: (item: any, paramValue: string) => Array<{ name: string; href: string }>;
}

export const detailConfigs: Record<string, DetailConfig> = {
  artists: {
    type: 'artists',
    singular: 'Artist',
    plural: 'Artists',
    apiEndpoint: 'artist',
    basePath: '/carnatic/artists',
    paramName: 'artistid',

    titleTemplate: artist => `${artist.name} - Indian Classical Music Artist`,
    descriptionTemplate: artist =>
      `Learn about ${artist.name}, ${artist.artistType} specializing in ${artist.traditions?.join(', ') || 'Indian classical music'}. ${artist.bio ? `${artist.bio.substring(0, 150)}...` : 'Discover their musical journey and contributions.'}`,
    keywordsTemplate: artist =>
      `${artist.name}, ${artist.artistType}, ${artist.instruments?.join(', ')}, ${artist.traditions?.join(', ')}, Indian classical music`,
    schemaType: 'Person',

    hasImage: true,
    imageField: 'profileImage',
    nameField: 'name',
    subtitleField: 'artistType',
    bioField: 'bio',

    getHeaderSections: artist => [
      {
        title: 'Quick Info',
        items: [
          { label: 'Instruments', value: artist.instruments },
          { label: 'Traditions', value: artist.traditions },
          { label: 'Profile Views', value: artist.viewCount?.toLocaleString() },
        ],
      },
    ],

    getContentSections: artist => [
      ...(artist.bio
        ? [
            {
              title: 'Biography',
              content: artist.bio,
              format: 'pre-line' as const,
            },
          ]
        : []),
      {
        title: 'Musical Profile',
        content: '', // Will be rendered as custom sections
      },
    ],

    relatedItemsConfig: {
      title: 'Related Artists',
      getRelatedItems: async artist => {
        const result = await client.artist.search.query({
          tradition: artist.traditions?.[0] as any,
          limit: 6,
        });
        return result.items.filter(a => a.id !== artist.id);
      },
    },

    getBreadcrumbs: (artist, paramValue) => [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Artists', href: '/carnatic/artists' },
      { name: artist.name, href: `/carnatic/artists/${paramValue}` },
    ],
  },

  compositions: {
    type: 'compositions',
    singular: 'Composition',
    plural: 'Compositions',
    apiEndpoint: 'composition',
    basePath: '/carnatic/compositions',
    paramName: 'compositionid',

    titleTemplate: composition =>
      `${composition.title} - ${composition.ragaName || 'Unknown Raga'} - Indian Classical Music`,
    descriptionTemplate: composition =>
      `Learn about ${composition.title}, a beautiful composition in Raga ${composition.ragaName || 'Unknown'} and Tala ${composition.talaName || 'Unknown'}. ${composition.meaning ? `${composition.meaning.substring(0, 150)}...` : 'Explore lyrics, meaning, and musical details.'}`,
    keywordsTemplate: composition =>
      `${composition.title}, ${composition.ragaName}, ${composition.talaName}, Indian classical music, Carnatic music, composition, lyrics`,
    schemaType: 'MusicComposition',

    hasImage: false,
    nameField: 'title',

    getHeaderSections: composition => [
      {
        title: 'Musical Details',
        items: [
          { label: 'Raga', value: composition.ragaName },
          { label: 'Tala', value: composition.talaName },
          { label: 'Language', value: composition.language },
          { label: 'Alternative Titles', value: composition.alternativeTitles },
        ],
      },
    ],

    getContentSections: composition => [
      // Display structured verses if available, otherwise fall back to simple lyrics
      ...(composition.structuredVerses && composition.structuredVerses.length > 0
        ? [
            {
              title: 'Lyrics',
              content: composition.structuredVerses
                .sort((a: any, b: any) => a.order - b.order)
                .map(
                  (verse: any) =>
                    `${verse.type.charAt(0).toUpperCase() + verse.type.slice(1)}:\n${verse.text}`
                )
                .join('\n\n'),
              format: 'pre-line' as const,
            },
          ]
        : composition.lyrics
          ? [
              {
                title: 'Lyrics',
                content: composition.lyrics,
                format: 'pre-line' as const,
              },
            ]
          : []),
      ...(composition.meaning
        ? [
            {
              title: 'Meaning',
              content: composition.meaning,
              format: 'pre-line' as const,
            },
          ]
        : []),
    ],

    getBreadcrumbs: (composition, paramValue) => [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Compositions', href: '/carnatic/compositions' },
      { name: composition.title, href: `/carnatic/compositions/${paramValue}` },
    ],
  },

  ragas: {
    type: 'ragas',
    singular: 'Raga',
    plural: 'Ragas',
    apiEndpoint: 'raga',
    basePath: '/carnatic/ragas',
    paramName: 'ragaid',

    titleTemplate: raga =>
      `${raga.name} - ${raga.melakarta ? `Melakarta ${raga.melakarta}` : 'Janya Raga'} - Indian Classical Music`,
    descriptionTemplate: raga =>
      `Learn about ${raga.name}, a ${raga.melakarta ? `melakarta raga (${raga.melakarta})` : 'janya raga'} in Carnatic music. ${raga.description || 'Explore the melodic characteristics and compositions in this raga.'}`,
    keywordsTemplate: raga =>
      `${raga.name}, raga, Carnatic music, Indian classical music, melakarta, janya, ${raga.melakarta || ''}`,
    schemaType: 'Article',

    hasImage: false,
    nameField: 'name',

    getHeaderSections: raga => [
      {
        title: 'Raga Details',
        items: [
          { label: 'Melakarta', value: raga.melakarta?.toString() },
          { label: 'Arohanam', value: raga.arohana },
          { label: 'Avarohanam', value: raga.avarohana },
          { label: 'Mood', value: raga.mood },
        ],
      },
    ],

    getContentSections: raga => [
      ...(raga.description
        ? [
            {
              title: 'Description',
              content: raga.description,
              format: 'pre-line' as const,
            },
          ]
        : []),
      ...(raga.musicalPhrases
        ? [
            {
              title: 'Musical Phrases',
              content: raga.musicalPhrases.join('\n'),
              format: 'pre-line' as const,
            },
          ]
        : []),
    ],

    getBreadcrumbs: (raga, paramValue) => [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Ragas', href: '/carnatic/ragas' },
      { name: raga.name, href: `/carnatic/ragas/${paramValue}` },
    ],
  },

  talas: {
    type: 'talas',
    singular: 'Tala',
    plural: 'Talas',
    apiEndpoint: 'tala',
    basePath: '/carnatic/talas',
    paramName: 'talaid',

    titleTemplate: tala => `${tala.name} - Carnatic Tala - Indian Classical Music`,
    descriptionTemplate: tala =>
      `Learn about ${tala.name}, a ${tala.aksharas ? `${tala.aksharas}-beat` : ''} tala in Carnatic music. ${tala.description || 'Explore the rhythmic patterns and structure of this tala.'}`,
    keywordsTemplate: tala =>
      `${tala.name}, tala, Carnatic music, Indian classical music, rhythm, ${tala.aksharas ? `${tala.aksharas} beats` : ''}, ${tala.type || ''}`,
    schemaType: 'Article',

    hasImage: false,
    nameField: 'name',

    getHeaderSections: tala => [
      {
        title: 'Tala Details',
        items: [
          { label: 'Aksharas (Beats)', value: tala.aksharas?.toString() },
          { label: 'Pattern', value: tala.pattern },
          { label: 'Type', value: tala.type },
          { label: 'Structure', value: tala.structure },
        ],
      },
    ],

    getContentSections: tala => [
      ...(tala.description
        ? [
            {
              title: 'Description',
              content: tala.description,
              format: 'pre-line' as const,
            },
          ]
        : []),
      ...(tala.notation
        ? [
            {
              title: 'Notation',
              content: tala.notation,
              format: 'pre-line' as const,
            },
          ]
        : []),
    ],

    getBreadcrumbs: (tala, paramValue) => [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Talas', href: '/carnatic/talas' },
      { name: tala.name, href: `/carnatic/talas/${paramValue}` },
    ],
  },
};

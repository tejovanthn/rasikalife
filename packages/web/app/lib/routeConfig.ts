import type { EntityCardField, SearchFilter } from '~/components/shared';

export interface EntityConfig {
  type: 'artists' | 'compositions' | 'ragas' | 'talas';
  singular: string;
  plural: string;
  apiEndpoint: 'artist' | 'composition' | 'raga' | 'tala';
  basePath: string;

  // Search configuration
  searchPlaceholder: string;
  searchLabel: string;
  filters: SearchFilter[];

  // Meta configuration
  title: string;
  description: string;
  keywords: string;

  // Display configuration
  hasPopularSection: boolean;
  popularLimit?: number;
  defaultLimit: number;
  gridCols: string;

  // Card field mapping
  getCardFields: (item: any) => EntityCardField[];
  getCardSubtitle?: (item: any) => string | undefined;
  getCardDescription?: (item: any) => string | undefined;
  getCardImage?: (item: any) => string | undefined;
  getCardMetadata?: (item: any) => { updatedAt?: string; viewCount?: number } | undefined;
}

export const entityConfigs: Record<string, EntityConfig> = {
  artists: {
    type: 'artists',
    singular: 'Artist',
    plural: 'Artists',
    apiEndpoint: 'artist',
    basePath: '/carnatic/artists',

    searchPlaceholder: 'Search by name, instrument, or tradition...',
    searchLabel: 'Search Artists',
    filters: [
      {
        name: 'tradition',
        label: 'Filter by Tradition',
        type: 'select',
        options: [
          { value: '', label: 'All Traditions' },
          { value: 'carnatic', label: 'Carnatic' },
          { value: 'hindustani', label: 'Hindustani' },
        ],
      },
    ],

    title: 'Indian Classical Music Artists - Rasika.life',
    description:
      'Explore renowned artists of Indian classical music. Discover their biographies, musical styles, and contributions to classical traditions.',
    keywords:
      'Indian classical music artists, Carnatic musicians, Hindustani artists, classical musicians, maestros',

    hasPopularSection: true,
    popularLimit: 12,
    defaultLimit: 20,
    gridCols: 'md:grid-cols-2 lg:grid-cols-2',

    getCardFields: artist => [
      { label: 'Instruments', value: artist.instruments, render: 'array' as const },
      { label: 'Traditions', value: artist.traditions, render: 'array' as const },
    ],
    getCardSubtitle: artist => artist.artistType,
    getCardDescription: artist => artist.bio,
    getCardImage: artist => artist.profileImage,
    getCardMetadata: artist => ({
      updatedAt: artist.updatedAt,
      viewCount: artist.viewCount,
    }),
  },

  compositions: {
    type: 'compositions',
    singular: 'Composition',
    plural: 'Compositions',
    apiEndpoint: 'composition',
    basePath: '/carnatic/compositions',

    searchPlaceholder: 'Search by title, lyrics, or composer...',
    searchLabel: 'Search Compositions',
    filters: [],

    title: 'Indian Classical Music Compositions - Rasika.life',
    description:
      'Explore a comprehensive collection of Indian classical music compositions. Discover lyrics, meanings, ragas, talas, and attributions.',
    keywords:
      'Indian classical music, Carnatic music, Hindustani music, compositions, ragas, talas, lyrics, classical songs',

    hasPopularSection: true,
    popularLimit: 10,
    defaultLimit: 20,
    gridCols: 'md:grid-cols-2 lg:grid-cols-3',

    getCardFields: composition => [
      { label: 'Raga', value: composition.ragaIds },
      { label: 'Tala', value: composition.talaIds },
      { label: 'Language', value: composition.language },
    ],
    getCardSubtitle: composition =>
      composition.alternativeTitles && composition.alternativeTitles.length > 0
        ? `Also: ${composition.alternativeTitles.join(', ')}`
        : undefined,
    getCardDescription: composition => composition.meaning,
    getCardMetadata: composition => ({
      updatedAt: composition.updatedAt,
      viewCount: composition.viewCount,
    }),
  },

  ragas: {
    type: 'ragas',
    singular: 'Raga',
    plural: 'Ragas',
    apiEndpoint: 'raga',
    basePath: '/carnatic/ragas',

    searchPlaceholder: 'Search by name...',
    searchLabel: 'Search Ragas',
    filters: [],

    title: 'Carnatic Ragas - Rasika.life',
    description:
      'Explore the melodic frameworks of Carnatic music. Learn about ragas, their characteristics, and musical applications.',
    keywords: 'Carnatic ragas, melakarta, janya ragas, Indian classical music scales',

    hasPopularSection: false,
    defaultLimit: 24,
    gridCols: 'md:grid-cols-2 lg:grid-cols-3',

    getCardFields: raga => [],
  },

  talas: {
    type: 'talas',
    singular: 'Tala',
    plural: 'Talas',
    apiEndpoint: 'tala',
    basePath: '/carnatic/talas',

    searchPlaceholder: 'Search by name...',
    searchLabel: 'Search Talas',
    filters: [],

    title: 'Carnatic Talas - Rasika.life',
    description:
      'Explore the rhythmic cycles of Carnatic music. Learn about talas, their beat patterns, and musical applications.',
    keywords: 'Carnatic talas, rhythmic cycles, aksharas, Suladi Sapta Talas, Chapu talas',

    hasPopularSection: false,
    defaultLimit: 24,
    gridCols: 'md:grid-cols-2 lg:grid-cols-3',

    getCardFields: tala => [],
    getCardDescription: undefined,
  },
};

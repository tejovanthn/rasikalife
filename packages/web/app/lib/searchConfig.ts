export type SearchMode = 'simple' | 'advanced' | 'global' | 'entity';

export interface SearchFilterOption {
  value: string;
  label: string;
}

export interface SearchFilterField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio';
  placeholder?: string;
  min?: number;
  max?: number;
  options?: SearchFilterOption[];
  defaultValue?: string | number;
  description?: string;
}

export interface SearchEntityType {
  value: string;
  label: string;
  pluralLabel: string;
}

export interface SearchResultItem {
  id: string;
  title?: string;
  name?: string;
  type: 'composition' | 'artist' | 'raga' | 'tala';
  url: string;
  raga?: string;
  tala?: string;
  artistType?: string;
  melakarta?: number;
  aksharas?: number;
  metadata?: Record<string, any>;
}

export interface SearchResults {
  compositions: SearchResultItem[];
  artists: SearchResultItem[];
  ragas: SearchResultItem[];
  talas: SearchResultItem[];
}

export interface SearchConfig {
  mode: SearchMode;

  // Basic configuration
  placeholder: string;
  searchLabel?: string;
  submitAction: string;
  clearPath?: string;

  // Features
  showEntityTypeFilter?: boolean;
  showAdvancedFilters?: boolean;
  showInstantResults?: boolean;
  enableKeyboardShortcuts?: boolean;
  debounceMs?: number;
  minQueryLength?: number;

  // Entity types (for type filtering)
  entityTypes?: SearchEntityType[];

  // Advanced filters
  advancedFilters?: SearchFilterField[];

  // Instant search configuration
  instantSearch?: {
    apiEndpoint: string;
    maxResults?: number;
    groupResults?: boolean;
  };

  // Styling
  className?: string;
  compact?: boolean;

  // Callbacks
  onSubmit?: (params: URLSearchParams) => void;
  onResultSelect?: (result: SearchResultItem) => void;
  onClear?: () => void;
}

// Predefined search configurations
export const searchConfigs = {
  // Simple search for entity index pages (replaces current SearchForm)
  entityIndex: (
    entityType: string,
    basePath: string,
    filters: SearchFilterField[]
  ): SearchConfig => ({
    mode: 'simple' as const,
    placeholder: `Search ${entityType}...`,
    submitAction: basePath,
    clearPath: basePath,
    advancedFilters: filters,
    className: 'mb-8',
  }),

  // Advanced search for global search page (replaces AdvancedSearch)
  globalAdvanced: (): SearchConfig => ({
    mode: 'advanced' as const,
    placeholder: 'Search compositions, artists, ragas, talas...',
    searchLabel: 'Search Everything',
    submitAction: '/carnatic/search',
    clearPath: '/carnatic/search',
    showEntityTypeFilter: true,
    showAdvancedFilters: true,

    entityTypes: [
      { value: 'all', label: 'All', pluralLabel: 'All' },
      { value: 'compositions', label: 'Composition', pluralLabel: 'Compositions' },
      { value: 'artists', label: 'Artist', pluralLabel: 'Artists' },
      { value: 'ragas', label: 'Raga', pluralLabel: 'Ragas' },
      { value: 'talas', label: 'Tala', pluralLabel: 'Talas' },
    ],

    advancedFilters: [
      {
        name: 'tradition',
        label: 'Tradition',
        type: 'select',
        options: [
          { value: '', label: 'Any Tradition' },
          { value: 'CARNATIC', label: 'Carnatic' },
          { value: 'HINDUSTANI', label: 'Hindustani' },
          { value: 'FOLK', label: 'Folk' },
          { value: 'DEVOTIONAL', label: 'Devotional' },
        ],
      },
      {
        name: 'language',
        label: 'Language',
        type: 'select',
        options: [
          { value: '', label: 'Any Language' },
          { value: 'telugu', label: 'Telugu' },
          { value: 'tamil', label: 'Tamil' },
          { value: 'kannada', label: 'Kannada' },
          { value: 'sanskrit', label: 'Sanskrit' },
          { value: 'malayalam', label: 'Malayalam' },
          { value: 'hindi', label: 'Hindi' },
        ],
      },
      {
        name: 'artistType',
        label: 'Artist Type',
        type: 'select',
        options: [
          { value: '', label: 'Any Type' },
          { value: 'COMPOSER', label: 'Composer' },
          { value: 'VOCALIST', label: 'Vocalist' },
          { value: 'INSTRUMENTALIST', label: 'Instrumentalist' },
          { value: 'PERCUSSIONIST', label: 'Percussionist' },
          { value: 'MUSICOLOGIST', label: 'Musicologist' },
        ],
      },
      {
        name: 'melakarta',
        label: 'Melakarta Number',
        type: 'number',
        min: 1,
        max: 72,
        placeholder: '1-72',
        description: 'For ragas',
      },
      {
        name: 'aksharas',
        label: 'Aksharas (Beats)',
        type: 'select',
        description: 'For talas',
        options: [
          { value: '', label: 'Any Count' },
          { value: '3', label: '3 Aksharas' },
          { value: '4', label: '4 Aksharas' },
          { value: '5', label: '5 Aksharas' },
          { value: '6', label: '6 Aksharas' },
          { value: '7', label: '7 Aksharas' },
          { value: '8', label: '8 Aksharas' },
          { value: '9', label: '9 Aksharas' },
          { value: '10', label: '10 Aksharas' },
          { value: '14', label: '14 Aksharas' },
          { value: '16', label: '16 Aksharas' },
        ],
      },
    ],
  }),

  // Global instant search (replaces GlobalSearch)
  globalInstant: (): SearchConfig => ({
    mode: 'global' as const,
    placeholder: 'Search compositions, artists, ragas, talas...',
    submitAction: '/carnatic/search',
    showInstantResults: true,
    enableKeyboardShortcuts: true,
    debounceMs: 300,
    minQueryLength: 2,
    compact: true,

    instantSearch: {
      apiEndpoint: '/api/search',
      maxResults: 20,
      groupResults: true,
    },
  }),
};

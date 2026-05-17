import { useDebounce } from '@uidotdev/usehooks';
import { Clock, Search as SearchIcon, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useFetcher, useNavigate } from 'react-router';
import { useHydrated } from '~/lib/progressive-enhancement';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateEventUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  generateRagaUrl,
  generateTalaUrl,
  generateVenueUrl,
} from '~/lib/url-slug';
import type { SearchEntityType, SearchResultItem } from '~/types/search';

interface SearchResults {
  compositions: SearchResultItem[];
  artists: SearchResultItem[];
  ragas: SearchResultItem[];
  talas: SearchResultItem[];
  venues: SearchResultItem[];
  organisers: SearchResultItem[];
  events: SearchResultItem[];
  festivals: SearchResultItem[];
}

type FilterType = SearchEntityType | 'all';

interface RecentEntity {
  id: string;
  type: SearchEntityType;
  name: string;
  url: string;
}

type SearchState = {
  isOpen: boolean;
  query: string;
  results: SearchResults | null;
  isLoading: boolean;
  selectedIndex: number;
  filter: FilterType;
};

type SearchAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_RESULTS'; results: SearchResults }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SELECT_NEXT'; maxIndex: number }
  | { type: 'SELECT_PREV' }
  | { type: 'SELECT_RESET' }
  | { type: 'SET_FILTER'; filter: FilterType };

const initialState: SearchState = {
  isOpen: false,
  query: '',
  results: null,
  isLoading: false,
  selectedIndex: -1,
  filter: 'all',
};

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true };
    case 'CLOSE':
      return { ...initialState };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'SET_RESULTS':
      return { ...state, results: action.results, isLoading: false };
    case 'CLEAR_RESULTS':
      return { ...state, results: null, selectedIndex: -1 };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
        results: action.isLoading ? null : state.results,
      };
    case 'SELECT_NEXT':
      return { ...state, selectedIndex: Math.min(state.selectedIndex + 1, action.maxIndex) };
    case 'SELECT_PREV':
      return { ...state, selectedIndex: Math.max(state.selectedIndex - 1, -1) };
    case 'SELECT_RESET':
      return { ...state, selectedIndex: -1 };
    case 'SET_FILTER':
      return { ...state, filter: action.filter, selectedIndex: -1 };
    default:
      return state;
  }
}

function getEntityUrl(item: SearchResultItem): string {
  switch (item.type) {
    case 'composition':
      return generateCompositionUrl(item.name, item.id);
    case 'artist':
      return generateArtistUrl(item.name, item.id);
    case 'raga':
      return generateRagaUrl(item.name, item.id);
    case 'tala':
      return generateTalaUrl(item.name, item.id);
    case 'venue':
      return generateVenueUrl(item.name, item.id);
    case 'organiser':
      return generateOrganiserUrl(item.name, item.id);
    case 'event':
      return generateEventUrl(item.name, item.id);
    case 'festival':
      return generateFestivalUrl(item.name, item.id);
  }
}

const RESULT_SECTIONS = [
  {
    key: 'compositions',
    label: 'Compositions',
    filterType: 'composition',
    path: '/carnatic/compositions',
  },
  { key: 'artists', label: 'Artists', filterType: 'artist', path: '/artists' },
  { key: 'ragas', label: 'Ragas', filterType: 'raga', path: '/carnatic/ragas' },
  { key: 'talas', label: 'Talas', filterType: 'tala', path: '/carnatic/talas' },
  { key: 'venues', label: 'Venues', filterType: 'venue', path: '/venues' },
  { key: 'organisers', label: 'Organisers', filterType: 'organiser', path: '/organisers' },
  { key: 'events', label: 'Events', filterType: 'event', path: '/events' },
  { key: 'festivals', label: 'Festivals', filterType: 'festival', path: '/festivals' },
] as const;

const FILTER_TABS: FilterType[] = [
  'all',
  'composition',
  'artist',
  'raga',
  'tala',
  'venue',
  'organiser',
  'event',
  'festival',
];

const ResultItem = memo(function ResultItem({
  result,
  globalIndex,
  selectedIndex,
  onResultClick,
}: {
  result: SearchResultItem;
  globalIndex: number;
  selectedIndex: number;
  onResultClick: (result: SearchResultItem) => void;
}) {
  const url = getEntityUrl(result);

  return (
    <Link
      id={`result-${result.id}`}
      to={url}
      onClick={() => onResultClick(result)}
      className={`block px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
        selectedIndex === globalIndex ? 'bg-accent/50 border-accent' : 'hover:bg-accent/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-foreground">{result.name}</div>
          <div className="text-sm text-muted-foreground">
            {result.type === 'composition' && <span>Composition</span>}
            {result.type === 'artist' && <span>Artist</span>}
            {result.type === 'raga' && <span>Raga</span>}
            {result.type === 'tala' && <span>Tala</span>}
            {result.type === 'venue' && <span>Venue</span>}
            {result.type === 'organiser' && <span>Organiser</span>}
            {result.type === 'event' && <span>Event</span>}
            {result.type === 'festival' && <span>Festival</span>}
          </div>
        </div>
        <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
          {result.type}
        </span>
      </div>
    </Link>
  );
});

export function GlobalSearch() {
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { isOpen, query, results, isLoading, selectedIndex, filter } = state;

  const [recentEntities, setRecentEntities] = useState<RecentEntity[]>([]);

  const isHydrated = useHydrated();
  const navigate = useNavigate();
  const fetcher = useFetcher<SearchResults>();
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const latestQueryRef = useRef<string>('');

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rasika:recent-entities');
      if (stored) setRecentEntities(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const addRecentEntity = useCallback((result: SearchResultItem) => {
    setRecentEntities(prev => {
      const filtered = prev.filter(e => e.id !== result.id);
      const updated = [
        { id: result.id, type: result.type, name: result.name, url: getEntityUrl(result) },
        ...filtered,
      ].slice(0, 5);
      try {
        localStorage.setItem('rasika:recent-entities', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const removeRecentEntity = useCallback((id: string) => {
    setRecentEntities(prev => {
      const updated = prev.filter(e => e.id !== id);
      try {
        localStorage.setItem('rasika:recent-entities', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const handleFilterChange = useCallback((newFilter: FilterType) => {
    dispatch({ type: 'SET_FILTER', filter: newFilter });
  }, []);

  const getVisibleResults = useCallback((): SearchResultItem[] => {
    if (!results) return [];

    if (filter === 'all') {
      // Ranked list sorted by score
      return [
        ...results.compositions,
        ...results.artists,
        ...results.ragas,
        ...results.talas,
        ...results.venues,
        ...results.organisers,
        ...results.events,
        ...results.festivals,
      ].sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
    }

    // Filtered by specific type
    const all: SearchResultItem[] = [];
    for (const section of RESULT_SECTIONS) {
      if (filter === section.filterType) {
        all.push(...results[section.key]);
      }
    }
    return all;
  }, [results, filter]);

  const scrollSelectedIntoView = useCallback((result: SearchResultItem | undefined) => {
    if (!result) return;
    const element = document.getElementById(`result-${result.id}`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // Reset selection when results change (filter change already resets in reducer)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on results change
  useEffect(() => {
    dispatch({ type: 'SELECT_RESET' });
  }, [results]);

  // Sync fetcher.data to state only if query matches
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (latestQueryRef.current === debouncedQuery) {
        dispatch({ type: 'SET_RESULTS', results: fetcher.data });
      }
    }
  }, [fetcher.state, fetcher.data, debouncedQuery]);

  // Trigger search when debounced query changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetcher.load is stable, including fetcher causes infinite loop
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      dispatch({ type: 'CLEAR_RESULTS' });
      return;
    }

    latestQueryRef.current = debouncedQuery;
    dispatch({ type: 'SET_LOADING', isLoading: true });
    fetcher.load(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        dispatch({ type: 'CLOSE' });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        previousFocus.current = document.activeElement as HTMLElement;
        dispatch({ type: 'OPEN' });
      }

      if (event.key === 'Escape') {
        dispatch({ type: 'CLOSE' });
        previousFocus.current?.focus();
      }

      if (isOpen && results) {
        const visibleResults = getVisibleResults();
        const maxIndex = visibleResults.length - 1;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            dispatch({ type: 'SELECT_NEXT', maxIndex });
            scrollSelectedIntoView(visibleResults[Math.min(selectedIndex + 1, maxIndex)]);
            break;
          case 'ArrowUp':
            event.preventDefault();
            dispatch({ type: 'SELECT_PREV' });
            scrollSelectedIntoView(visibleResults[selectedIndex - 1]);
            break;
          case 'Enter':
            if (selectedIndex >= 0 && visibleResults[selectedIndex]) {
              addRecentEntity(visibleResults[selectedIndex]);
              dispatch({ type: 'CLOSE' });
              navigate(getEntityUrl(visibleResults[selectedIndex]));
            }
            break;
        }
      }
    };

    if (isHydrated) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    isHydrated,
    isOpen,
    results,
    selectedIndex,
    getVisibleResults,
    scrollSelectedIntoView,
    navigate,
    addRecentEntity,
  ]);

  const handleResultClick = useCallback(
    (result: SearchResultItem) => {
      addRecentEntity(result);
      dispatch({ type: 'CLOSE' });
    },
    [addRecentEntity]
  );

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // Calculate which sections to show based on filter
  const visibleSections = useMemo(
    () => RESULT_SECTIONS.filter(section => filter === 'all' || filter === section.filterType),
    [filter]
  );

  return (
    <>
      {isHydrated ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            previousFocus.current = document.activeElement as HTMLElement;
            dispatch({ type: 'OPEN' });
          }}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
        >
          <SearchIcon size={16} />
          <span className="hidden sm:inline">Search...</span>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            {/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
          </span>
        </button>
      ) : null}

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-start justify-center px-4 pt-16">
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay is decorative, keyboard handled globally */}
            <div
              className="fixed inset-0 bg-black bg-opacity-25"
              onClick={() => dispatch({ type: 'CLOSE' })}
              aria-hidden="true"
            />

            <div
              ref={resultsRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              className="relative bg-background rounded-lg shadow-xl w-full max-w-2xl border"
            >
              <div className="flex items-center border-b border-border px-4">
                <SearchIcon size={20} className="text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={e => dispatch({ type: 'SET_QUERY', query: e.target.value })}
                  placeholder="Search compositions, artists, ragas, events..."
                  aria-label="Search"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-controls="search-results"
                  className="flex-1 px-4 py-4 text-lg placeholder:text-muted-foreground outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CLOSE' })}
                  aria-label="Close search"
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto" id="search-results" aria-live="polite">
                {isLoading && (
                  <div className="px-4 py-8 text-center text-muted-foreground">Searching...</div>
                )}

                {results && !isLoading && (
                  <>
                    <div
                      className="relative flex border-b border-border overflow-x-auto scrollbar-none after:pointer-events-none after:absolute after:right-0 after:inset-y-0 after:w-8 after:bg-gradient-to-l after:from-background after:to-transparent"
                      role="tablist"
                    >
                      {FILTER_TABS.map(type => (
                        <button
                          key={type}
                          type="button"
                          role="tab"
                          aria-selected={filter === type}
                          aria-controls="search-results"
                          onClick={() => handleFilterChange(type)}
                          className={`px-4 py-2 text-sm transition-colors flex-shrink-0 whitespace-nowrap ${
                            filter === type
                              ? 'border-b-2 border-primary text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>

                    {filter === 'all'
                      ? // Ranked list view for "All" - sorted by relevance score
                        (() => {
                          const allResults = getVisibleResults();
                          if (allResults.length === 0) return null;
                          return (
                            <div>
                              {allResults.map((result, index) => (
                                <ResultItem
                                  key={result.id}
                                  result={result}
                                  globalIndex={index}
                                  selectedIndex={selectedIndex}
                                  onResultClick={handleResultClick}
                                />
                              ))}
                            </div>
                          );
                        })()
                      : // Grouped view for specific type filters
                        (() => {
                          let globalIndex = 0;
                          return visibleSections.map(section => {
                            const sectionResults = results[section.key];
                            if (sectionResults.length === 0) return null;

                            const sectionStartIndex = globalIndex;
                            globalIndex += sectionResults.length;

                            return (
                              <div key={section.key}>
                                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted flex justify-between">
                                  <span>{section.label}</span>
                                  <Link
                                    to={`${section.path}?q=${encodeURIComponent(query)}`}
                                    onClick={handleClose}
                                    className="text-primary hover:underline"
                                  >
                                    View all →
                                  </Link>
                                </div>
                                {sectionResults.map((result, index) => (
                                  <ResultItem
                                    key={result.id}
                                    result={result}
                                    globalIndex={sectionStartIndex + index}
                                    selectedIndex={selectedIndex}
                                    onResultClick={handleResultClick}
                                  />
                                ))}
                              </div>
                            );
                          });
                        })()}

                    {Object.values(results).every(arr => arr.length === 0) && (
                      <div className="px-4 py-8 text-center text-muted-foreground">
                        No results found for &quot;{query}&quot;
                      </div>
                    )}
                  </>
                )}

                {query.length < 3 && !isLoading && !results && (
                  <div className="px-4 py-8" aria-live="polite">
                    {recentEntities.length > 0 && (
                      <div className="mb-6">
                        <div className="text-sm text-muted-foreground mb-2">Recently visited</div>
                        <div className="flex flex-col gap-1">
                          {recentEntities.map(entity => (
                            <div
                              key={entity.id}
                              className="flex items-center justify-between group"
                            >
                              <Link
                                to={entity.url}
                                onClick={handleClose}
                                className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors py-1 flex-1"
                              >
                                <Clock size={14} className="text-muted-foreground shrink-0" />
                                <div>
                                  <div className="font-medium">{entity.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
                                  </div>
                                </div>
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeRecentEntity(entity.id)}
                                className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label={`Remove "${entity.name}" from recently visited`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground mb-4">Browse by category</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to="/carnatic/compositions"
                        onClick={handleClose}
                        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                      >
                        Compositions
                      </Link>
                      <Link
                        to="/artists"
                        onClick={handleClose}
                        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                      >
                        Artists
                      </Link>
                      <Link
                        to="/carnatic/ragas"
                        onClick={handleClose}
                        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                      >
                        Ragas
                      </Link>
                      <Link
                        to="/carnatic/talas"
                        onClick={handleClose}
                        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                      >
                        Talas
                      </Link>
                      <Link
                        to="/events"
                        onClick={handleClose}
                        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
                      >
                        Events
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground flex justify-between">
                <span>Press ↵ to select, ↑↓ to navigate</span>
                <span>ESC to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

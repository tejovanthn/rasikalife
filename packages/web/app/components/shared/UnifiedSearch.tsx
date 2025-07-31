import { Form, Link, useFetcher, useSearchParams, useSubmit } from '@remix-run/react';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useHydrated } from '~/lib/progressive-enhancement';
import type { SearchConfig, SearchResultItem, SearchResults } from '~/lib/searchConfig';

interface UnifiedSearchProps {
  config: SearchConfig;
  className?: string;
}

export function UnifiedSearch({ config, className = '' }: UnifiedSearchProps) {
  const [searchParams] = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const isHydrated = useHydrated();
  const submit = useSubmit();
  const fetcher = useFetcher<SearchResults>();
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Extract current values from URL params
  const getCurrentValues = () => {
    const values: Record<string, string> = {};
    values.q = searchParams.get('q') || '';

    if (config.entityTypes) {
      values.type = searchParams.get('type') || config.entityTypes[0]?.value || 'all';
    }

    config.advancedFilters?.forEach(filter => {
      values[filter.name] = searchParams.get(filter.name) || filter.defaultValue?.toString() || '';
    });

    return values;
  };

  const currentValues = getCurrentValues();
  const hasActiveFilters =
    config.advancedFilters?.some(
      filter => currentValues[filter.name] && currentValues[filter.name] !== filter.defaultValue
    ) || false;

  // Debounced instant search
  useEffect(() => {
    if (!config.showInstantResults || !config.instantSearch) return;
    if (query.length < (config.minQueryLength || 2)) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      fetcher.load(`${config.instantSearch?.apiEndpoint}?q=${encodeURIComponent(query)}`);
    }, config.debounceMs || 300);

    return () => clearTimeout(timeoutId);
  }, [query, config, fetcher]);

  // Handle fetcher results
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      setResults(fetcher.data);
      setIsLoading(false);
    }
  }, [fetcher.data, fetcher.state]);

  // Keyboard shortcuts and navigation
  useEffect(() => {
    if (!isHydrated || !config.enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Global search shortcut
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (config.mode === 'global') {
          setIsModalOpen(true);
          setTimeout(() => searchRef.current?.focus(), 0);
        } else {
          searchRef.current?.focus();
        }
      }

      // Modal controls
      if (config.mode === 'global' && isModalOpen) {
        if (event.key === 'Escape') {
          setIsModalOpen(false);
          setQuery('');
          setResults(null);
          setSelectedIndex(-1);
        }

        // Result navigation
        if (results) {
          const allResults = [
            ...results.compositions,
            ...results.artists,
            ...results.ragas,
            ...results.talas,
          ];

          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
              break;
            case 'ArrowUp':
              event.preventDefault();
              setSelectedIndex(prev => Math.max(prev - 1, -1));
              break;
            case 'Enter':
              if (selectedIndex >= 0 && allResults[selectedIndex]) {
                handleResultClick(allResults[selectedIndex]);
              }
              break;
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHydrated, config, isModalOpen, results, selectedIndex]);

  // Close modal on outside click
  useEffect(() => {
    if (config.mode !== 'global') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [config.mode]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (value && value !== 'all' && value !== '') {
        params.set(key, value.toString());
      }
    }

    if (config.onSubmit) {
      config.onSubmit(params);
    } else {
      submit(params, { method: 'get', action: config.submitAction });
    }
  };

  const handleClear = () => {
    if (config.onClear) {
      config.onClear();
    } else if (config.clearPath) {
      const params = new URLSearchParams();
      if (currentValues.q) {
        params.set('q', currentValues.q);
      }
      submit(params, { method: 'get', action: config.clearPath });
    }
  };

  const handleResultClick = (result: SearchResultItem) => {
    if (config.onResultSelect) {
      config.onResultSelect(result);
    } else {
      window.location.href = result.url;
    }

    setIsModalOpen(false);
    setQuery('');
    setResults(null);
    setSelectedIndex(-1);
  };

  // Render different modes
  if (config.mode === 'global') {
    return <GlobalSearchModal />;
  }

  return <StandardSearchForm />;

  function GlobalSearchModal() {
    return (
      <>
        {/* Trigger button */}
        {isHydrated ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
          >
            <Search size={16} />
            <span>{config.placeholder}</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">⌘K</span>
          </button>
        ) : (
          <Link
            to={config.submitAction}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
          >
            <Search size={16} />
            <span>Browse...</span>
          </Link>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-start justify-center px-4 pt-16">
              <div
                className="fixed inset-0 bg-black bg-opacity-25"
                onClick={() => setIsModalOpen(false)}
              />

              <div
                ref={resultsRef}
                className="relative bg-background rounded-lg shadow-xl w-full max-w-2xl border"
              >
                {/* Search input */}
                <div className="flex items-center border-b border-border px-4">
                  <Search size={20} className="text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={config.placeholder}
                    className="flex-1 px-4 py-4 text-lg placeholder:text-muted-foreground outline-none bg-transparent"
                  />
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto">
                  {isLoading && (
                    <div className="px-4 py-8 text-center text-muted-foreground">Searching...</div>
                  )}

                  {results && !isLoading && <SearchResultsList />}

                  {query.length < (config.minQueryLength || 2) && !isLoading && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      Type at least {config.minQueryLength || 2} characters to search
                    </div>
                  )}
                </div>

                {/* Footer */}
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

  function StandardSearchForm() {
    return (
      <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
        <Form
          method="get"
          onSubmit={isHydrated ? handleSubmit : undefined}
          action={config.submitAction}
        >
          {/* Main Search Row */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  size={20}
                />
                <input
                  ref={searchRef}
                  type="text"
                  name="q"
                  placeholder={config.placeholder}
                  defaultValue={currentValues.q}
                  className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                />
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            {config.showAdvancedFilters && isHydrated && (
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`px-4 py-3 border rounded-lg transition-colors flex items-center gap-2 ${
                  showAdvanced || hasActiveFilters
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-input text-muted-foreground hover:bg-accent'
                }`}
              >
                <Filter size={16} />
                Filters
                {hasActiveFilters && (
                  <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1">
                    Active
                  </span>
                )}
              </button>
            )}

            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Search
            </button>
          </div>

          {/* Entity Type Filter */}
          {config.showEntityTypeFilter && config.entityTypes && (
            <div className="mb-4">
              <div className="flex gap-2 flex-wrap">
                {config.entityTypes.map(({ value, label }) => (
                  <label key={value} className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      defaultChecked={currentValues.type === value}
                      className="sr-only peer"
                    />
                    <div className="px-4 py-2 border border-input rounded-full cursor-pointer text-sm transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary hover:bg-accent">
                      {label}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {config.advancedFilters && (showAdvanced || !isHydrated) && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-foreground">
                  {config.searchLabel
                    ? `${config.searchLabel} - Advanced Filters`
                    : 'Advanced Filters'}
                </h3>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
                  >
                    <X size={14} />
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config.advancedFilters.map(filter => (
                  <div key={filter.name}>
                    <label
                      htmlFor={filter.name}
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      {filter.label}
                      {filter.description && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({filter.description})
                        </span>
                      )}
                    </label>

                    {filter.type === 'select' ? (
                      <select
                        id={filter.name}
                        name={filter.name}
                        defaultValue={currentValues[filter.name]}
                        className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                      >
                        {filter.options?.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={filter.type}
                        id={filter.name}
                        name={filter.name}
                        defaultValue={currentValues[filter.name]}
                        placeholder={filter.placeholder}
                        {...(filter.type === 'number' && {
                          min: filter.min,
                          max: filter.max,
                        })}
                        className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Form>
      </div>
    );
  }

  function SearchResultsList() {
    if (!results) return null;

    let itemIndex = 0;
    const hasResults = Object.values(results).some(arr => arr.length > 0);

    if (!hasResults) {
      return (
        <div className="px-4 py-8 text-center text-muted-foreground">
          No results found for "{query}"
        </div>
      );
    }

    return (
      <>
        {results.compositions.length > 0 && (
          <ResultSection title="Compositions" items={results.compositions} />
        )}
        {results.artists.length > 0 && <ResultSection title="Artists" items={results.artists} />}
        {results.ragas.length > 0 && <ResultSection title="Ragas" items={results.ragas} />}
        {results.talas.length > 0 && <ResultSection title="Talas" items={results.talas} />}
      </>
    );

    function ResultSection({ title, items }: { title: string; items: SearchResultItem[] }) {
      return (
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted">
            {title}
          </div>
          {items.map(result => (
            <ResultItem key={result.id} result={result} index={itemIndex++} />
          ))}
        </div>
      );
    }

    function ResultItem({ result, index }: { result: SearchResultItem; index: number }) {
      return (
        <button
          onClick={() => handleResultClick(result)}
          className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
            selectedIndex === index ? 'bg-accent/50 border-accent' : 'hover:bg-accent/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{result.title || result.name}</div>
              <div className="text-sm text-muted-foreground">
                {result.type === 'composition' && (
                  <span>
                    {result.raga && `Raga: ${result.raga}`}
                    {result.raga && result.tala && ' • '}
                    {result.tala && `Tala: ${result.tala}`}
                  </span>
                )}
                {result.type === 'artist' && <span>{result.artistType}</span>}
                {result.type === 'raga' && result.melakarta && (
                  <span>Melakarta: {result.melakarta}</span>
                )}
                {result.type === 'tala' && result.aksharas && (
                  <span>{result.aksharas} aksharas</span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
              {result.type}
            </span>
          </div>
        </button>
      );
    }
  }
}

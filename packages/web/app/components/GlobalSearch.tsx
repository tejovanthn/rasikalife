import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { useHydrated } from '~/lib/progressive-enhancement';

interface SearchResult {
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
}

interface SearchResults {
  compositions: SearchResult[];
  artists: SearchResult[];
  ragas: SearchResult[];
  talas: SearchResult[];
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const isHydrated = useHydrated();
  const fetcher = useFetcher<SearchResults>();
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      fetcher.load(`/api/search?q=${encodeURIComponent(query)}`);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, fetcher]);

  // Handle fetcher results
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      setResults(fetcher.data);
      setIsLoading(false);
    }
  }, [fetcher.data, fetcher.state]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global shortcuts (only when hydrated)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults(null);
        setSelectedIndex(-1);
      }

      // Navigation within search results
      if (isOpen && results) {
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
              // Navigate to selected item
              window.location.href = allResults[selectedIndex].url;
            }
            break;
        }
      }
    };

    if (isHydrated) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isHydrated, isOpen, results, selectedIndex]);

  const handleResultClick = () => {
    setIsOpen(false);
    setQuery('');
    setResults(null);
    setSelectedIndex(-1);
  };

  const ResultItem = ({ result, index }: { result: SearchResult; index: number }) => (
    <Link
      to={result.url}
      onClick={handleResultClick}
      className={`block px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
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
            {result.type === 'tala' && result.aksharas && <span>{result.aksharas} aksharas</span>}
          </div>
        </div>
        <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-1 rounded">
          {result.type}
        </span>
      </div>
    </Link>
  );

  return (
    <>
      {/* Search trigger button - Progressive Enhancement */}
      {isHydrated ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
        >
          <Search size={16} />
          <span>Search...</span>
          <span className="hidden sm:inline text-xs text-muted-foreground">⌘K</span>
        </button>
      ) : (
        <Link
          to="/carnatic/compositions"
          className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md hover:bg-accent transition-colors"
        >
          <Search size={16} />
          <span>Browse...</span>
        </Link>
      )}

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-start justify-center px-4 pt-16">
            <div
              className="fixed inset-0 bg-black bg-opacity-25"
              onClick={() => setIsOpen(false)}
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
                  placeholder="Search compositions, artists, ragas, talas..."
                  className="flex-1 px-4 py-4 text-lg placeholder:text-muted-foreground outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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

                {results &&
                  !isLoading &&
                  (() => {
                    let itemIndex = 0;
                    return (
                      <>
                        {results.compositions.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted">
                              Compositions
                            </div>
                            {results.compositions.map(result => (
                              <ResultItem key={result.id} result={result} index={itemIndex++} />
                            ))}
                          </div>
                        )}

                        {results.artists.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted">
                              Artists
                            </div>
                            {results.artists.map(result => (
                              <ResultItem key={result.id} result={result} index={itemIndex++} />
                            ))}
                          </div>
                        )}

                        {results.ragas.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted">
                              Ragas
                            </div>
                            {results.ragas.map(result => (
                              <ResultItem key={result.id} result={result} index={itemIndex++} />
                            ))}
                          </div>
                        )}

                        {results.talas.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted">
                              Talas
                            </div>
                            {results.talas.map(result => (
                              <ResultItem key={result.id} result={result} index={itemIndex++} />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}

                {results && Object.values(results).every(arr => arr.length === 0) && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No results found for "{query}"
                  </div>
                )}

                {query.length < 2 && !isLoading && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    Type at least 2 characters to search
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

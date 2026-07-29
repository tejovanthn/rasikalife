import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import type { CompositionSuggestion } from './types';

type Props = {
  value?: string;
  displayValue: string;
  onSelect: (suggestion: CompositionSuggestion | null) => void;
  onFreeText: (title: string) => void;
};

type SearchResult = { id: string; name: string; score: number };

export function CompositionSearch({ value, displayValue, onSelect, onFreeText }: Props) {
  const fetcher = useFetcher<SearchResult[] | null>();
  const [inputValue, setInputValue] = useState(displayValue);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open the dropdown when results arrive from the server
  useEffect(() => {
    if (fetcher.data !== undefined) setIsOpen(true);
  }, [fetcher.data]);

  function handleChange(q: string) {
    setInputValue(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      fetcher.load(`/api/search/composition?q=${encodeURIComponent(q)}`);
    }, 250);
  }

  function handleSelect(s: SearchResult) {
    setInputValue(s.name);
    setIsOpen(false);
    onSelect({ id: s.id, name: s.name, score: s.score });
  }

  function handleClear() {
    setInputValue('');
    setIsOpen(false);
    onSelect(null);
  }

  function handleFreeText() {
    setIsOpen(false);
    onFreeText(inputValue.trim());
  }

  const suggestions = Array.isArray(fetcher.data) ? fetcher.data : [];
  const hasError = fetcher.state === 'idle' && fetcher.data === null;
  const loading = fetcher.state !== 'idle';

  return (
    <div className="relative">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          value={inputValue}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => setIsOpen(false)}
          placeholder="Search composition…"
          // Compact row editor with no room for a visible Label — see DESIGN.md density rule.
          aria-label="Search composition"
          className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {(value || inputValue) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        // biome-ignore lint/a11y/useSemanticElements: custom combobox — <select> cannot support this UX
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md max-h-56 overflow-auto text-sm"
        >
          {loading && <div className="px-3 py-2 text-muted-foreground text-xs">Searching…</div>}
          {hasError && <div className="px-3 py-2 text-destructive text-xs">Search unavailable</div>}
          {!loading &&
            !hasError &&
            suggestions.map(s => (
              // biome-ignore lint/a11y/useSemanticElements: role=option is correct inside a custom listbox
              <button
                type="button"
                role="option"
                key={s.id}
                aria-selected={s.id === value}
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 cursor-pointer hover:bg-accent"
              >
                {s.name}
              </button>
            ))}
          {!loading && (
            // biome-ignore lint/a11y/useSemanticElements: role=option is correct inside a custom listbox
            <button
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={handleFreeText}
              className="w-full text-left px-3 py-2 cursor-pointer hover:bg-accent text-muted-foreground italic text-xs border-t border-border"
            >
              Can't find it — enter as free text
            </button>
          )}
        </div>
      )}
    </div>
  );
}

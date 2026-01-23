# GlobalSearch UI Improvements (Iteration 2)

## Overview

Improve the existing `GlobalSearch.tsx` component with entity type tabs, "View all" links, URL state for filtering, accessibility fixes, and a better empty state. All changes in a single file.

## Specific Changes to GlobalSearch.tsx

### 1. Add Entity Type Tabs (above results)

```tsx
// Add state for active filter
const [filter, setFilter] = useState<SearchResult['type'] | 'all'>('all');

// Filtered results based on active tab
const filteredResults = useMemo(() => {
  if (filter === 'all') return results;
  return {
    compositions: filter === 'composition' ? results.compositions : [],
    artists: filter === 'artist' ? results.artists : [],
    ragas: filter === 'raga' ? results.ragas : [],
    talas: filter === 'tala' ? results.talas : [],
  };
}, [results, filter]);

// Add tabs before results section
{results && (
  <div className="flex border-b border-border" role="tablist">
    {(['all', 'composition', 'artist', 'raga', 'tala'] as const).map(type => (
      <button
        key={type}
        type="button"
        role="tab"
        aria-selected={filter === type}
        onClick={() => setFilter(type)}
        className={`px-4 py-2 text-sm ${
          filter === type
            ? 'border-b-2 border-primary text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
      </button>
    ))}
  </div>
)}
```

### 2. Add "View All" Links

After each result group section:

```tsx
{results.compositions.length > 0 && (
  <div>
    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted flex justify-between">
      <span>Compositions</span>
      <Link
        to="/carnatic/compositions?q=${query}"
        onClick={handleResultClick}
        className="text-primary hover:underline"
      >
        View all →
      </Link>
    </div>
    {/* ResultItem components */}
  </div>
)}
```

Repeat pattern for artists, ragas, talas with corresponding routes.

### 3. Use URL State for Filter Persistence

Remove `useState<filter>` and replace with URL search params:

```tsx
import { useSearchParams } from 'react-router';

export function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('type') as SearchResult['type'] | null) || 'all';

  // Update filter
  const handleFilterChange = (newFilter: typeof filter) => {
    if (newFilter === 'all') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', newFilter);
    }
    setSearchParams(searchParams);
  };
}
```

### 4. Replace Empty State with Browse Categories

```tsx
{query.length < 2 && !isLoading && (
  <div className="px-4 py-8">
    <div className="text-sm text-muted-foreground mb-4">Browse by category</div>
    <div className="grid grid-cols-2 gap-2">
      <Link to="/carnatic/compositions" onClick={handleResultClick} className="...">
        Compositions
      </Link>
      <Link to="/carnatic/artists" onClick={handleResultClick} className="...">
        Artists
      </Link>
      <Link to="/carnatic/ragas" onClick={handleResultClick} className="...">
        Ragas
      </Link>
      <Link to="/carnatic/talas" onClick={handleResultClick} className="...">
        Talas
      </Link>
    </div>
  </div>
)}
```

### 5. Accessibility Checklist

| Issue | Fix |
|-------|-----|
| Missing focus trap | Add `@radix-ui/react-focus-scope` or implement manual trap |
| Overlay needs aria-hidden on main content | Add `aria-hidden="true"` to main content when modal open |
| Search input needs label | Add `aria-label="Search"` to input |
| Missing combobox role | Change wrapper to role="combobox" |
| Results need aria-live | Add `aria-live="polite"` to results container |
| Focus not returned to trigger | Store trigger ref, restore focus on close |
| Escape key on overlay | Add key handler on overlay div |

Minimal focus trap implementation:

```tsx
// In modal open effect, when closing:
previousFocus.current?.focus();

// Store trigger ref
const triggerRef = useRef<HTMLButtonElement>(null);
const previousFocus = useRef<HTMLElement | null>(null);

// On open
previousFocus.current = document.activeElement as HTMLElement;
triggerRef.current?.focus();
```

## Implementation Plan (Single Session)

1. Add `filter` state with URL search params
2. Add tabs UI above results
3. Add "View all" links after each section header
4. Replace "Type at least 2 characters" with browse categories grid
5. Fix accessibility issues (focus trap, ARIA, keyboard return)
6. Update keyboard navigation to respect active filter
7. Test keyboard flow: Tab → input → filter tabs → results → Escape

## Files Modified

- `packages/web/app/components/GlobalSearch.tsx` (single file, ~350 lines after changes)

## Removed from Original Spec

- Recent searches / localStorage persistence
- Dedicated search page (Phase 5)
- Separate hook file (`useSearch.ts`)
- tRPC integration (keep existing `/api/search`)
- 5-phase rollout (consolidated to single session)

## Code Diff Summary

```diff
+ const [searchParams, setSearchParams] = useSearchParams();
+ const filter = (searchParams.get('type') as ...) || 'all';

+ <div className="flex border-b border-border" role="tablist">
+   {(['all', 'composition', 'artist', 'raga', 'tala'] as const).map(...)}
+ </div>

- {query.length < 2 && !isLoading && (
-   <div>Type at least 2 characters to search</div>
- )}

+ {query.length < 2 && !isLoading && (
+   <div className="grid grid-cols-2 gap-2">Browse links...</div>
+ )}

+ <div className="px-4 py-2 text-xs font-semibold ... flex justify-between">
+   <span>Compositions</span>
+   <Link to="/carnatic/compositions?q=${query}">View all →</Link>
+ </div>

+ {/* Accessibility: focus trap, aria attributes, focus restoration */}
```

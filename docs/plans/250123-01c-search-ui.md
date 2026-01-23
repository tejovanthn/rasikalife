# GlobalSearch UI Improvements (Final Iteration)

## Overview

Improve the existing `GlobalSearch.tsx` component with entity type tabs, "View all" links, URL state for filtering, accessibility fixes, and a better empty state. All changes in a single file.

## Key Changes from Iteration 2

1. **Clean URL params pattern**: Uses `new URLSearchParams(searchParams)` instead of mutating
2. **Simplified filter logic**: Filter in render with boolean flags, no `useMemo`
3. **Keyboard navigation with filter**: Arrow keys respect active filter tab

## Implementation Details

### 1. Entity Type Tabs with URL State

Add tabs above results that filter by entity type, persisted in URL:

```tsx
import { useSearchParams } from 'react-router';

// In component
const [searchParams, setSearchParams] = useSearchParams();
const filter = (searchParams.get('type') as SearchResult['type'] | null) || 'all';

const handleFilterChange = (newFilter: typeof filter) => {
  const newParams = new URLSearchParams(searchParams);
  if (newFilter === 'all') {
    newParams.delete('type');
  } else {
    newParams.set('type', newFilter);
  }
  setSearchParams(newParams);
};

// Filter flags for render (no useMemo needed)
const showCompositions = filter === 'all' || filter === 'composition';
const showArtists = filter === 'all' || filter === 'artist';
const showRagas = filter === 'all' || filter === 'raga';
const showTalas = filter === 'all' || filter === 'tala';
```

Tabs UI:

```tsx
{results && (
  <div className="flex border-b border-border" role="tablist">
    {(['all', 'composition', 'artist', 'raga', 'tala'] as const).map(type => (
      <button
        key={type}
        type="button"
        role="tab"
        aria-selected={filter === type}
        onClick={() => handleFilterChange(type)}
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

### 2. "View All" Links

After each result group section:

```tsx
{showCompositions && results.compositions.length > 0 && (
  <div>
    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted flex justify-between">
      <span>Compositions</span>
      <Link
        to="/carnatic/compositions?q=${encodeURIComponent(query)}"
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

Repeat pattern for artists, ragas, talas with corresponding routes:
- Artists → `/carnatic/artists`
- Ragas → `/carnatic/ragas`
- Talas → `/carnatic/talas`

### 3. Keyboard Navigation with Active Filter

Arrow key navigation respects the active filter tab, only cycling through visible results:

```tsx
// Collect visible results based on active filter
const getVisibleResults = (): SearchResult[] => {
  const all: SearchResult[] = [];
  if (showCompositions) all.push(...results.compositions);
  if (showArtists) all.push(...results.artists);
  if (showRagas) all.push(...results.ragas);
  if (showTalas) all.push(...results.talas);
  return all;
};

// In keyboard handler
if (isOpen && results) {
  const visibleResults = getVisibleResults();

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, visibleResults.length - 1));
      scrollSelectedIntoView(visibleResults[selectedIndex + 1]);
      break;
    case 'ArrowUp':
      event.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      scrollSelectedIntoView(visibleResults[selectedIndex - 1]);
      break;
    case 'Enter':
      if (selectedIndex >= 0 && visibleResults[selectedIndex]) {
        window.location.href = visibleResults[selectedIndex].url;
      }
      break;
  }
}

// Helper to scroll selected item into view
const scrollSelectedIntoView = (result: SearchResult | undefined) => {
  if (!result) return;
  const element = document.getElementById(`result-${result.id}`);
  element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
```

Update `ResultItem` to include ID for scroll targeting:

```tsx
const ResultItem = ({ result, index }: { result: SearchResult; index: number }) => (
  <Link
    id={`result-${result.id}`}
    to={result.url}
    onClick={handleResultClick}
    className={`block px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
      selectedIndex === index ? 'bg-accent/50 border-accent' : 'hover:bg-accent/20'
    }`}
  >
    {/* ... content */}
  </Link>
);
```

### 4. Empty State with Browse Categories

Replace "Type at least 2 characters" with browse links:

```tsx
{query.length < 2 && !isLoading && (
  <div className="px-4 py-8">
    <div className="text-sm text-muted-foreground mb-4">Browse by category</div>
    <div className="grid grid-cols-2 gap-2">
      <Link
        to="/carnatic/compositions"
        onClick={handleResultClick}
        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
      >
        Compositions
      </Link>
      <Link
        to="/carnatic/artists"
        onClick={handleResultClick}
        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
      >
        Artists
      </Link>
      <Link
        to="/carnatic/ragas"
        onClick={handleResultClick}
        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
      >
        Ragas
      </Link>
      <Link
        to="/carnatic/talas"
        onClick={handleResultClick}
        className="px-4 py-3 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
      >
        Talas
      </Link>
    </div>
  </div>
)}
```

### 5. Accessibility Checklist

| Issue | Fix |
|-------|-----|
| Missing focus trap | Manual implementation: restore focus on close |
| Overlay needs aria-hidden | Add `aria-hidden="true"` to main content when modal open |
| Search input needs label | Add `aria-label="Search"` to input |
| Missing combobox role | Change wrapper to `role="combobox"` |
| Results need aria-live | Add `aria-live="polite"` to results container |
| Focus not returned to trigger | Store trigger ref, restore focus on close |

Focus management implementation:

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);
const previousFocus = useRef<HTMLElement | null>(null);

// On open
previousFocus.current = document.activeElement as HTMLElement;
triggerRef.current?.focus();

// On close
previousFocus.current?.focus();

// Escape key handler
if (event.key === 'Escape') {
  setIsOpen(false);
  previousFocus.current?.focus();
}
```

## Implementation Plan

### Session 1: Core Changes

1. Add `useSearchParams` for filter state
2. Add tabs UI above results section
3. Update results rendering with filter flags
4. Add "View all" links after section headers
5. Replace empty state with browse categories

### Session 2: Keyboard & Accessibility

1. Update keyboard navigation to use filtered results
2. Add scroll-into-view for arrow navigation
3. Add focus restoration on close
4. Add ARIA attributes (combobox, aria-live, aria-hidden)
5. Test keyboard flow: `⌘K` → input → tabs → results → `ESC`

## Files Modified

- `packages/web/app/components/GlobalSearch.tsx` (single file, ~380 lines after changes)

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
+
+ const handleFilterChange = (newFilter) => {
+   const newParams = new URLSearchParams(searchParams);  // Clean pattern
+   newParams.delete('type') / newParams.set('type', newFilter);
+   setSearchParams(newParams);
+ };
+
+ // Filter flags (no useMemo)
+ const showCompositions = filter === 'all' || filter === 'composition';
+
+ <div className="flex border-b border-border" role="tablist">
+   {(['all', 'composition', 'artist', 'raga', 'tala'] as const).map(...)}
+ </div>
+
- {query.length < 2 && !isLoading && (
-   <div>Type at least 2 characters to search</div>
- )}
+
+ {query.length < 2 && !isLoading && (
+   <div className="grid grid-cols-2 gap-2">Browse links...</div>
+ )}
+
+ const getVisibleResults = () => { /* ... filter based on show* flags */ };
+
+ // Arrow keys use visibleResults, scrollIntoView
+
+ <div className="px-4 py-2 text-xs font-semibold ... flex justify-between">
+   <span>Compositions</span>
+   <Link to="/carnatic/compositions?q=${query}">View all →</Link>
+ </div>
+
+ {/* Accessibility: focus restoration, ARIA attributes */}
```

## Testing Checklist

- [ ] `⌘K` opens modal, focus on input
- [ ] Typing 2+ characters shows results
- [ ] Clicking tabs updates URL (`?type=artist`)
- [ ] Back/forward browser buttons work with filter
- [ ] "View all" links navigate to entity pages
- [ ] Empty state shows browse categories
- [ ] Arrow keys navigate only visible results
- [ ] `Enter` on selection navigates
- [ ] `ESC` closes modal, restores focus to trigger
- [ ] Click outside closes modal
- [ ] Screen reader announces results

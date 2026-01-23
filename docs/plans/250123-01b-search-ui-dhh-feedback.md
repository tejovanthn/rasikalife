# DHH Code Review: Search UI Iteration 2

**Document:** `docs/plans/250123-01b-search-ui.md`
**Reviewer:** DHH-Style Code Review
**Date:** January 23, 2026

---

## Overall Assessment

This iteration is a dramatic improvement over the original spec. The team listened to feedback and made hard cuts: 858 lines → 194 lines, 14+ component files → 1 file, 5-phase rollout → single session. The spec now focuses on what actually matters: improving an existing component rather than building a parallel architecture.

**Verdict:** Framework-worthy with minor caveats. This spec flows with Remix conventions rather than fighting them.

---

## Critical Issues

### 1. Minor: `searchParams` Mutation Pattern

The URL state implementation mutates the params object before calling `setSearchParams`:

```tsx
const handleFilterChange = (newFilter: typeof filter) => {
  if (newFilter === 'all') {
    searchParams.delete('type');  // Mutating
  } else {
    searchParams.set('type', newFilter);  // Mutating
  }
  setSearchParams(searchParams);
};
```

While `setSearchParams` in Remix creates a fresh URLSearchParams internally, mutating first is sloppy. Cleaner:

```tsx
const handleFilterChange = (newFilter: typeof filter) => {
  const newParams = new URLSearchParams(searchParams);
  if (newFilter === 'all') {
    newParams.delete('type');
  } else {
    newParams.set('type', newFilter);
  }
  setSearchParams(newParams);
};
```

**Not blocking approval** — the current pattern works and is common in React Router codebases. But the cleaner version is trivial and worth doing.

---

## What Works Well

### 1. Single File Focus

The spec explicitly targets one file: `packages/web/app/components/GlobalSearch.tsx`. No new directories, no hook files, no "service layer." This is exactly what was requested.

### 2. URL State for Filtering

Using `useSearchParams` instead of `useState` for the entity type filter is the right call. It makes the filter:
- Shareable via URL
- Work with browser back/forward
- Work without JavaScript (if implemented carefully)

### 3. Empty State Redesign

Replacing "Type at least 2 characters" with browse category links is better UX. The user sees actionable navigation instead of a blocking message.

### 4. Accessibility Checklist

The accessibility section is practical and scoped:
- Focus trap (simple manual implementation, no new dependency needed)
- ARIA labels and roles
- Focus restoration on close
- Keyboard navigation

The spec correctly avoids adding `@radix-ui/react-focus-scope` — a dependency for a few lines of code is over-engineering.

### 5. View All Links

Linking to existing entity pages (`/carnatic/compositions`, `/carnatic/artists`, etc.) instead of building a dedicated search page is pragmatic. The existing pages already exist and handle pagination. This is "convention over configuration" done right.

---

## Improvements Needed

### 1. Filter Logic Can Be Simplified

The `useMemo` filter implementation is verbose:

```tsx
const filteredResults = useMemo(() => {
  if (filter === 'all') return results;
  return {
    compositions: filter === 'composition' ? results.compositions : [],
    artists: filter === 'artist' ? results.artists : [],
    ragas: filter === 'raga' ? results.ragas : [],
    talas: filter === 'tala' ? results.talas : [],
  };
}, [results, filter]);
```

More elegant approach:

```tsx
const filteredResults = useMemo(() => {
  if (filter === 'all') return results;
  const key = `${filter}s` as keyof typeof results;
  return {
    [key]: results[key],
    ...Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, k === key ? v : []])
    ),
  };
}, [results, filter]);
```

Or even simpler — the tabs can be purely visual filtering. The API returns all results; the UI just shows a subset. This keeps the `results` object unchanged and avoids derived state entirely.

**Recommendation:** Skip the filteredResults memoization. Just filter in the render:

```tsx
const showCompositions = filter === 'all' || filter === 'composition';
// ... render conditionally based on showCompositions
```

### 2. Missing: Accessibility Implementation Detail

The spec mentions "Update keyboard navigation to respect active filter" but doesn't show how. When tabs are active, should arrow key navigation only cycle through visible results? This needs a concrete implementation, not just a bullet point.

---

## Approved Changes

The following changes are approved and ready for implementation:

| Change | Status |
|--------|--------|
| Entity type tabs with URL state | ✅ Approved |
| "View all" links after each section | ✅ Approved |
| Empty state with browse categories | ✅ Approved |
| Focus trap (manual implementation) | ✅ Approved |
| ARIA labels and roles | ✅ Approved |
| Focus restoration on close | ✅ Approved |

---

## Final Verdict

**Approved for implementation.**

This spec does exactly what iteration 1 asked: it improves the existing `GlobalSearch.tsx` rather than replacing it with over-engineered abstractions. The 76% reduction in spec length (858 → 194 lines) reflects genuine focus on what matters.

The team made the hard cuts that matter:
- No component directory
- No localStorage persistence
- No dedicated search page
- No custom hooks
- No new dependencies
- Single file change

Ship it.

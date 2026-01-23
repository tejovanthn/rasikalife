# DHH Code Review: Search UI Technical Specification

**Document:** `docs/plans/250123-01a-search-ui.md`
**Reviewer:** DHH-Style Code Review
**Date:** January 23, 2026

---

## Overall Assessment

This specification is a masterclass in over-engineering. You've taken a working feature—the existing `GlobalSearch.tsx` that's a reasonable 310 lines—and proposed replacing it with a sprawling 14+ component architecture, multiple hook files, localStorage persistence, and a five-phase implementation plan that includes a dedicated search page with pagination. This is scope creep dressed up as architecture.

The existing `GlobalSearch` component already does 80% of what you need. It uses `useFetcher` correctly, embraces progressive enhancement, handles keyboard navigation, and groups results by entity type. Your spec throws all of that away to build something more "enterprise-ready" that nobody asked for.

**Verdict:** Not framework-worthy. This is fighting against the Remix conventions the project already uses, adding complexity where simplicity would suffice.

---

## Critical Issues

### 1. You Already Have This Code

The `packages/web/app/components/GlobalSearch.tsx` file already implements:
- Modal-based search overlay
- `Cmd+K` keyboard shortcut
- Debounced search at 300ms
- Results grouped by entity type (compositions, artists, ragas, talas)
- Keyboard navigation (arrow keys, Enter, Escape)
- Progressive enhancement via `useHydrated`
- Results clearing on outside click

Instead of iterating on this working code, you've written a spec that discards it entirely and rebuilds everything with unnecessary abstraction. **This is the definition of YAGNI violation.** The spec doesn't even acknowledge the existing implementation except as a reference link.

### 2. The Component Hierarchy Is Absurd

```
SearchModal
├── SearchTrigger
│   ├── SearchIcon          ← A BUTTON WITH AN ICON IS NOT A COMPONENT
│   └── KeyboardHint
├── ModalOverlay
│   └── SearchDialog
│       ├── SearchHeader
│       │   ├── SearchIcon  ← DUPLICATE
│       │   ├── SearchInput
│       │   └── CloseButton
│       ├── EntityTypeTabs
│       │   ├── AllTab      ← TABS ARE CONTENT, NOT COMPONENTS
│       │   ├── ArtistTab
│       │   ├── CompositionTab
│       │   ├── RagaTab
│       │   └── TalaTab
```

**This is not architecture. This is bureaucratizing UI code.**

DHH would ask: Why does `AllTab` need its own file? Why does `SearchIcon` exist separately from `SearchInput`? These are not reusable components—they're fragments of a single UI that you've shredded into meaningless pieces.

The existing `GlobalSearch.tsx` proves you don't need this. It has a single `ResultItem` component defined inline (appropriately) and renders everything else in one file. That's the right approach.

### 3. Hook Proliferation Is a Code Smell

```typescript
// Your proposed hooks
export function useSearch(): SearchHookReturn { }
export function useRecentSearches(): RecentSearchesHookReturn { }
export function useSearchKeyboard(shortcuts: KeyboardShortcutMap): void { }
export function useDebouncedSearch(query: string, options: DebounceOptions): DebouncedValue { }
```

Four hooks for a search modal. Four! The `GlobalSearch.tsx` does all of this in one file with three `useEffect` hooks and zero custom hooks. The spec introduces hooks that add indirection, not value.

**Specifically problematic:**

- `useDebouncedSearch`: The existing code shows this is 8 lines of code in a `useEffect`. Extracting it to a "hook" adds a file, an interface, and documentation without solving any real problem.

- `useSearchKeyboard`: Again, this is event listener registration. In the existing code, it's 25 lines of straightforward `useEffect`. Making it a "hook" just means I have to grep through two files to understand what happens when the user presses a key.

- `useRecentSearches`: This is the worst offender. You're proposing a hook for localStorage persistence that will be used exactly once. The spec mentions "localStorage throttling" and "MAX_RECENT_SEARCHES" constants. For what? **Recent searches are not a core feature—they're a nice-to-have, and localStorage persistence for them is gold-plating.**

### 4. State Management Over-Engineering

```typescript
export interface SearchState {
  query: string;
  entityType: SearchEntityType;
  results: SearchResultItem[];
  groups: SearchResultGroup[];
  isLoading: boolean;
  error: string | null;
  selectedIndex: number;
  totalResults: number;
}
```

**Eight state properties for a search modal.** This is React state disease. You're tracking every possible piece of UI state when Remix would tell you: **put state in the URL**.

The spec doesn't mention URL state at all. Instead, it proposes a complex client-side state object that:
- Can't be shared
- Can't be bookmarked
- Doesn't work with browser back/forward
- Requires manual sync with URL params when navigating to "View all"

### 5. The "View All" Dedicated Search Page Is Scope Creep

Phase 5 adds a full `/search` route with:
- Pagination
- Entity type filter UI
- URL sync
- Browse suggestions

**Ask yourself: What problem does this solve?**

The existing modal shows grouped results with a "View all" link. That's exactly what users need. Building a second search UI on a dedicated page is doubling your UI code for marginal benefit. 

If you need a search page, build it later. For v1, the modal is sufficient.

### 6. localStorage for Recent Searches Is Premature

The spec includes:
```typescript
const MAX_RECENT_SEARCHES = 10;
const STORAGE_VERSION = 1;
interface RecentSearchStorage { ... }
```

This is classic over-engineering. You're building:
- A storage schema with versioning
- A dedicated hook for persistence
- Throttled writes (mentioned in performance section)
- "Clear recent searches" functionality

**For what? So users can see their last 10 searches?**

The spec admits this is localStorage-only (no server persistence). This means:
- Users on different devices don't share history
- Clearing browser data wipes history
- The feature doesn't work without JavaScript

**Ask the hard question: Is this worth the code?**

My answer: No. Ship the search modal without recent searches. If users ask for it, add it later with 20 lines of code, not a hook and a storage schema.

### 7. The API Schema Is Over-Engineered

```typescript
export const SearchableFieldSchema = z.enum([
  'artistName',
  'ragaName',
  'talaName',
  'compositionTitle',
  'lyrics',
]);

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.array(SearchableFieldSchema).optional(),  // ← This is overkill
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});
```

The `filters` array field is over-engineered. **Who is going to filter by `lyrics` field?** The modal UI doesn't expose field-level filtering—it only has entity type tabs. This schema supports a feature that doesn't exist and may never exist.

The existing `GlobalSearch` calls `/api/search?q=query` with no filters, and it works fine. Keep it simple.

---

## Improvements Needed

### Delete the Hook File

Instead of:
```
packages/web/app/components/search/hooks.ts
```

Delete it. Put debouncing, keyboard handling, and any other logic directly in the component where it's used. The existing `GlobalSearch.tsx` is proof that this works.

### Delete the Component Directory

Instead of 14 files:
```
packages/web/app/components/search/
├── SearchTrigger.tsx
├── SearchModal.tsx
├── SearchInput.tsx
├── EntityTypeTabs.tsx
├── ResultCard.tsx
├── ResultGroup.tsx
├── RecentSearchesSection.tsx
├── EmptyState.tsx
└── LoadingState.tsx
```

Keep the existing `GlobalSearch.tsx` and improve it. If you need sub-components, extract them when you see actual duplication—not before.

### Delete Recent Searches

Remove all localStorage persistence code. Ship search without history. Add it later if users ask.

### Delete the Dedicated Search Page

Remove Phase 5. The modal with "View all" links to existing entity pages is sufficient for v1.

### Simplify the API Schema

```typescript
// Keep it simple
export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
});
```

The existing `/api/search?q=...` endpoint works. You don't need tRPC for this. The existing code already uses `fetcher.load()` correctly.

### Use URL State for Entity Type Filter

Instead of client state:
```typescript
const [entityType, setEntityType] = useState('all');
```

Use URL state:
```typescript
// In the modal
<Link to="?type=artist" replace preventScrollReset />

// When searching, include ?type=artist in the API call
fetcher.load(`/api/search?q=${query}&type=${type}`)
```

This makes the filter shareable, bookmarkable, and works with browser history.

---

## What Works Well

### The Existing GlobalSearch.tsx

The current implementation is pragmatic and Remix-idiomatic:
- Uses `useFetcher` for server-side search
- Embraces progressive enhancement with `useHydrated`
- Groups results logically (compositions, artists, ragas, talas)
- Keyboard navigation is implemented correctly
- Debouncing at 300ms is appropriate
- The modal approach is simpler than a dedicated page

### The Backend Service

`packages/core/src/domain/search/service.ts` is well-structured:
- Caches the search index
- Handles errors appropriately
- The Fuse.js integration is clean
- Health check endpoint exists

### The Out of Scope Section

You've correctly identified what's NOT needed:
- Real-time suggestions
- Advanced filtering
- Autocomplete/typeahead
- Server-persisted search history

**Apply this same thinking to the in-scope items.** localStorage history is as much a "nice to have" as popular content suggestions.

---

## Refactored Specification

### Phase 1: Improve Existing GlobalSearch (1 file, ~400 lines)

**Goal:** Make the existing `GlobalSearch.tsx` better, not bigger.

1. **Add entity type tabs above results** (reuse existing tab styles from the codebase)
2. **Fix focus management** (focus trap, return focus on close)
3. **Add proper ARIA attributes** (dialog, listbox, option roles)
4. **Add "View all" links** to existing entity list pages
5. **Simplify keyboard navigation** code if needed

**Deliverables:**
- Updated `components/GlobalSearch.tsx`

That's it. No new files.

### Phase 2: URL State for Filtering (Optional, ~10 lines)

If entity type filtering is needed:

1. Add `type` query parameter to the search API call
2. Update the component to read/write URL params
3. Use `useSearchParams` or `useLocation`

**Deliverables:**
- Updated `components/GlobalSearch.tsx`

### What Was Deleted

| Item | Lines of Code Saved |
|------|---------------------|
| search/hooks.ts | ~150 |
| search/types.ts | ~50 |
| search/components (9 files) | ~800 |
| Recent searches hook + storage | ~100 |
| Dedicated search page | ~400 |
| tRPC router (not needed) | ~50 |
| Over-engineered API schema | ~20 |

**Total:** ~1,570 lines of code you don't need to write, test, or maintain.

---

## Final Verdict

The specification tries to solve problems that don't exist while ignoring the problem that does: **you already have working code.**

DHH's principle is "set up, then tear down." The existing `GlobalSearch.tsx` is your setup. Tear down the over-engineered spec and build on what works.

**Recommended path forward:**

1. Delete the specification file
2. Open `components/GlobalSearch.tsx`
3. Add the improvements listed above
4. Ship it

The code you don't write is always better than the code you do.

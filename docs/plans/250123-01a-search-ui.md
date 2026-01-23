# Technical Specification: Search UI

**Document ID:** 250123-01a-search-ui
**Version:** 1.0
**Status:** Draft
**Created:** January 23, 2026
**Author:** Application Architecture

---

## Overview

### Feature Summary

The Search UI feature provides a unified, keyboard-accessible search experience accessible from the global header. Users can search across all entity types (artists, ragas, talas, compositions) through a modal overlay that displays grouped results with quick navigation. The implementation includes recent search history (localStorage), entity type filtering, and seamless navigation to entity detail pages.

### Problem Statement

Currently, Rasika.life lacks a unified search capability that allows users to quickly discover content across the platform. Users must navigate to specific sections to find artists, compositions, ragas, or talas, creating friction in the discovery experience. This impacts user engagement and content accessibility.

### Goals

1. **Unified Search**: Single search interface searching all entity types
2. **Progressive Enhancement**: Works without JavaScript, with enhanced features when hydrated
3. **Keyboard Accessibility**: Full keyboard navigation for power users
4. **Recent History**: Save and display recent searches for quick access
5. **Seamless Navigation**: Direct navigation to entity detail pages
6. **Performance**: Debounced queries with responsive feedback

### Out of Scope

- Real-time search suggestions (debounce is acceptable)
- Advanced filtering beyond entity type
- Autocomplete/typeahead dropdown in header (modal overlay approach)
- Popular content suggestions (deferred to future iteration)
- Backend persistence for recent searches (localStorage only)

---

## Technical Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Browser                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        packages/web (Remix)                        │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐   │  │
│  │  │     Header          │    │       Search Modal              │   │  │
│  │  │  SearchTrigger      │───>│  SearchInput + EntityTabs       │   │  │
│  │  └─────────────────────┘    │  + ResultGroups + KeyboardNav   │   │  │
│  │                             └─────────────────────────────────┘   │  │
│  │                                     │                               │  │
│  │                                     ▼                               │  │
│  │                        useSearch Hook (client state)               │  │
│  │                                     │                               │  │
│  │                                     ▼                               │  │
│  │                        tRPC Client (search.search)                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                      │                                   │
│                                      ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      API Layer (tRPC)                              │  │
│  │  packages/trpc/src/routers/search.ts                               │  │
│  │         │                                                         │  │
│  │         ▼                                                         │  │
│  │  packages/core/src/domain/search/service.ts                       │  │
│  │         │                                                         │  │
│  │         ▼                                                         │  │
│  │  Search Index (S3 + Fuse.js)                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Interaction**: User clicks search trigger or presses `Cmd/Ctrl+K`
2. **Modal Opens**: Search modal appears with empty state
3. **Query Input**: User types query (debounced at 300ms)
4. **API Request**: tRPC `search.search` query invoked with filters
5. **Server Processing**: Service loads Fuse.js index from S3, performs fuzzy search
6. **Response**: API returns paginated results with highlights
7. **UI Update**: Results displayed grouped by entity type
8. **Navigation**: Click or keyboard select navigates to entity detail page

---

## UI/UX Specification

### Component States

| State | Trigger | Display |
|-------|---------|---------|
| **Idle** | Modal opened, no input | Recent searches + browse hints |
| **Typing** | User typing, < 2 chars | "Type at least 2 characters" |
| **Loading** | Query submitted, awaiting response | Skeleton loaders or spinner |
| **Results** | API returns data | Grouped result cards |
| **Empty** | Query with no matches | Helpful empty state with tips |
| **Error** | API failure | Error message with retry |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Cmd/Ctrl+K` | Open search modal |
| `Escape` | Close modal / clear selection |
| `Arrow Down` | Navigate to next result |
| `Arrow Up` | Navigate to previous result |
| `Enter` | Select highlighted result |
| `Tab` | Move through interactive elements |

### Entity Type Filtering

The modal includes a tab control for filtering by entity type:

- **All** (default): Search all entities, grouped results
- **Artists**: Filter to artist results only
- **Compositions**: Filter to composition results only
- **Ragas**: Filter to raga results only
- **Talas**: Filter to tala results only

### "View All" Behavior

Each result group shows up to 3 results with a "View all" link:
- Clicking "View all" navigates to `/search?q=...&type=...`
- Subsequent pagination occurs on the dedicated search page
- Modal closes before navigation

---

## Data Models

### Search Result Types

```typescript
// packages/web/app/components/search/types.ts

import type { EntityType } from '@rasika/core';

export type SearchEntityType = EntityType | 'all';

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  name: string;
  highlights: Array<{
    field: string;
    text: string;
  }>;
}

export interface SearchResultGroup {
  type: SearchEntityType;
  label: string;
  items: SearchResultItem[];
  totalCount: number;
}

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

export interface RecentSearch {
  query: string;
  entityType: SearchEntityType;
  timestamp: number;
}
```

### LocalStorage Schema

```typescript
// packages/web/app/components/search/recent-searches.ts

const RECENT_SEARCHES_KEY = 'rasika_search_recent';

interface RecentSearchStorage {
  searches: RecentSearchItem[];
}

interface RecentSearchItem {
  query: string;
  entityType: SearchEntityType;
  timestamp: number;
}

const MAX_RECENT_SEARCHES = 10;
const STORAGE_VERSION = 1;
```

### API Response Types

```typescript
// Shared with @rasika/core - already defined in packages/core/src/domain/search/types.ts

export type EntityType = 'artist' | 'raga' | 'tala' | 'composition';

export interface SearchResultItem {
  id: string;
  type: EntityType;
  name: string;
  highlights: Array<{
    field: SearchableField;
    text: string;
  }>;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}
```

---

## Component Architecture

### Component Hierarchy

```
SearchModal (container)
├── SearchTrigger (header button)
│   ├── SearchIcon
│   └── KeyboardHint (⌘K badge)
├── ModalOverlay (backdrop)
│   └── SearchDialog
│       ├── SearchHeader
│       │   ├── SearchIcon
│       │   ├── SearchInput
│       │   └── CloseButton
│       ├── EntityTypeTabs
│       │   ├── AllTab
│       │   ├── ArtistTab
│       │   ├── CompositionTab
│       │   ├── RagaTab
│       │   └── TalaTab
│       ├── SearchContent
│       │   ├── RecentSearchesSection (when query is empty)
│       │   │   └── RecentSearchList
│       │   │       └── RecentSearchItem
│       │   ├── LoadingState (when isLoading)
│       │   │   └── SkeletonLoader
│       │   ├── ResultsSection (when results exist)
│       │   │   ├── ResultGroup
│       │   │   │   ├── GroupHeader
│       │   │   │   │   ├── Label
│       │   │   │   │   └── ViewAllLink
│       │   │   │   └── ResultCardList
│       │   │   │       └── ResultCard
│       │   │   └── ResultPagination
│       │   └── EmptyState (when no results)
│       │       └── NoResultsMessage
│       └── SearchFooter
│           ├── KeyboardHint (navigation instructions)
│           └── KeyboardShortcuts
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `SearchModal` | State management, keyboard shortcuts, modal lifecycle |
| `SearchTrigger` | Opens modal, shows in header |
| `SearchInput` | Text input with debouncing |
| `EntityTypeTabs` | Entity type filtering |
| `RecentSearchesSection` | Displays recent searches from localStorage |
| `ResultGroup` | Displays results for a single entity type |
| `ResultCard` | Individual result item (links to detail page) |
| `ResultPagination` | "View all" link and load more |
| `KeyboardNav` | Arrow key navigation management |

### Hooks

```typescript
// packages/web/app/components/search/hooks.ts

/**
 * Main search hook managing modal state and search operations
 */
export function useSearch(): SearchHookReturn {
  // Modal open/close
  // Query state
  // Debounced search
  // Keyboard navigation
  // Result management
}

/**
 * Hook for managing recent searches in localStorage
 */
export function useRecentSearches(): RecentSearchesHookReturn {
  // Load from localStorage
  // Add new search
  // Clear history
  // Persist to localStorage
}

/**
 * Hook for keyboard shortcuts
 */
export function useSearchKeyboard(shortcuts: KeyboardShortcutMap): void {
  // Register global shortcuts
  // Handle keydown events
  // Clean up on unmount
}

/**
 * Hook for debounced search queries
 */
export function useDebouncedSearch(
  query: string,
  options: DebounceOptions
): DebouncedValue {
  // Debounce logic
  // Cancel pending requests
}
```

---

## API Contracts

### tRPC Procedure

```typescript
// packages/trpc/src/routers/search.ts

import { createTRPCRouter, publicProcedure } from '../trpc';
import { Search } from '@rasika/core';

export const searchRouter = createTRPCRouter({
  search: publicProcedure
    .input(Search.SearchInputSchema)
    .query(async ({ input }) => {
      const results = await Search.search(input.query, {
        filters: input.filters,
        limit: input.limit,
        offset: input.offset,
      });

      return results;
    }),

  health: publicProcedure.query(async () => {
    return Search.getHealth();
  }),
});
```

### Input Schema

```typescript
// packages/core/src/domain/search/schema.ts

import { z } from 'zod';

export const SearchableFieldSchema = z.enum([
  'artistName',
  'ragaName',
  'talaName',
  'compositionTitle',
  'lyrics',
]);

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.array(SearchableFieldSchema).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;
```

### Response Schema

```typescript
// packages/core/src/domain/search/types.ts

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}

export interface SearchResultItem {
  id: string;
  type: EntityType;
  name: string;
  highlights: Array<{
    field: SearchableField;
    text: string;
  }>;
}
```

### Frontend API Usage

```typescript
// packages/web/app/lib/api/search.ts

import { trpc } from '~/lib/api/client';

export async function search(
  query: string,
  options?: SearchSearchOptions
): Promise<SearchResponse> {
  return trpc.search.search.query({
    query,
    ...options,
  });
}

interface SearchSearchOptions {
  filters?: SearchableField[];
  limit?: number;
  offset?: number;
}
```

---

## Implementation Plan

### Phase 1: Foundation

**Goal:** Build core search modal infrastructure and hook foundation

1. Create search types file: `packages/web/app/components/search/types.ts`
2. Create search hooks file: `packages/web/app/components/search/hooks.ts`
3. Create `useSearch` hook with modal state management
4. Create `useDebouncedSearch` hook (300ms debounce)
5. Create `useRecentSearches` hook for localStorage persistence
6. Implement keyboard shortcut system (`Cmd+K`, `Escape`)
7. Set up tRPC search client in web package

**Deliverables:**
- `search/types.ts`
- `search/hooks.ts`
- Updated `api/client.ts` with search exports

### Phase 2: Core Components

**Goal:** Build all UI components for search modal

1. Create `SearchTrigger` component for header
2. Create `SearchModal` container component
3. Create `SearchInput` with icon and clear button
4. Create `EntityTypeTabs` for filtering
5. Create `ResultCard` component (reusable across entity types)
6. Create `ResultGroup` component for grouped results
7. Create `RecentSearchesSection` component
8. Create `EmptyState` component
9. Create `LoadingState` component with skeletons

**Deliverables:**
- `search/SearchTrigger.tsx`
- `search/SearchModal.tsx`
- `search/SearchInput.tsx`
- `search/EntityTypeTabs.tsx`
- `search/ResultCard.tsx`
- `search/ResultGroup.tsx`
- `search/RecentSearchesSection.tsx`
- `search/EmptyState.tsx`
- `search/LoadingState.tsx`

### Phase 3: Integration

**Goal:** Integrate search into header and connect to tRPC API

1. Replace placeholder in `Header` component with `SearchTrigger`
2. Wire up `SearchModal` to tRPC `search.search` procedure
3. Implement result grouping by entity type
4. Implement "View all" navigation to `/search` route
5. Connect `useRecentSearches` to save on result selection
6. Add keyboard navigation (arrow keys, Enter to select)
7. Implement error handling with retry capability

**Deliverables:**
- Updated `components/header.tsx`
- Updated `routes.ts` with `/search` route (placeholder)
- Search functionality fully working

### Phase 4: Polish

**Goal:** Refine UX and accessibility

1. Add focus management (focus trap, focus return)
2. Implement proper ARIA attributes and labels
3. Add animations for modal open/close
4. Implement result highlighting from API
5. Add "clear recent searches" functionality
6. Test progressive enhancement (works without JS)
7. Accessibility audit and fixes

**Deliverables:**
- Accessible, animated search modal
- Progressive enhancement support
- Updated documentation

### Phase 5: Dedicated Search Page

**Goal:** Create full `/search` results page for "View all" navigation

1. Create `routes/search.tsx` route file
2. Implement full results display with pagination
3. Add entity type filter UI
4. Connect to tRPC API with offset-based pagination
5. Implement URL sync (query params reflect state)
6. Add empty state with browse suggestions

**Deliverables:**
- `routes/search.tsx`
- Full-featured search results page

---

## Error Handling

### Error States

| Scenario | User Feedback | Retry Mechanism |
|----------|---------------|-----------------|
| Network timeout (5s) | "Search timed out. Please try again." | Click "Retry" button |
| API error (500) | "Search is temporarily unavailable. Please try again." | Click "Retry" button |
| Index unavailable | "Search index is loading. Please wait..." | Auto-refresh after 5s |
| Empty query | Shows recent searches | None needed |
| No results | "No results found for '...' | Suggestions to refine |

### Loading States

```typescript
// Loading states progression
const LOADING_STATES = {
  idle: 'No search performed',
  typing: 'Show "Type at least 2 characters"',
  loading: 'Show skeleton loaders or spinner',
  success: 'Show results',
  empty: 'Show helpful empty state',
  error: 'Show error with retry',
};
```

### Boundary Handling

- **Modal backdrop click**: Closes modal
- **Escape key**: Closes modal
- **Focus trap**: Keep focus within modal when open
- **Scroll lock**: Prevent body scroll when modal open

---

## Testing Strategy

### Unit Tests

**Location:** `packages/web/app/components/search/*.test.ts`

```typescript
// Example test patterns

describe('useDebouncedSearch', () => {
  it('should debounce query changes', async () => {
    // Test debounce timing
  });

  it('should return initial value before delay', () => {
    // Test immediate return
  });

  it('should cancel pending timeout on unmount', () => {
    // Test cleanup
  });
});

describe('ResultCard', () => {
  it('should render entity type badge', () => {
    // Test badge rendering
  });

  it('should navigate to correct URL', () => {
    // Test Link generation
  });

  it('should highlight matched text', () => {
    // Test highlight rendering
  });
});

describe('useRecentSearches', () => {
  it('should save search to localStorage', () => {
    // Test localStorage write
  });

  it('should limit to MAX_RECENT_SEARCHES', () => {
    // Test FIFO eviction
  });

  it('should return empty array on first load', () => {
    // Test initialization
  });
});
```

### Integration Tests

**Location:** `packages/web/app/components/search/integration.test.tsx`

```typescript
describe('SearchModal Integration', () => {
  it('should open on Cmd+K shortcut', async () => {
    // Simulate keyboard shortcut
    // Verify modal is open
  });

  it('should perform search and display results', async () => {
    // Type in search input
    // Wait for debounce
    // Verify tRPC called
    // Verify results displayed
  });

  it('should filter by entity type', async () => {
    // Select entity tab
    // Verify only that type shown
  });

  it('should navigate on result click', async () => {
    // Select result with keyboard
    // Press Enter
    // Verify navigation
  });
});
```

### E2E Tests

**Location:** `packages/web/tests/e2e/search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open search modal from header', async ({ page }) => {
    await page.click('[aria-label="Open search"]');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should search and show results', async ({ page }) => {
    await page.click('[aria-label="Open search"]');
    await page.fill('[role="searchbox"]', 'Tyagaraja');
    await expect(page.getByText('Searching...')).toBeVisible();
    await expect(page.getByRole('link', { name: /Tyagaraja/i })).toBeVisible();
  });

  test('should navigate using keyboard', async ({ page }) => {
    await page.keyboard.press('Meta+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.type('raga');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/ragas/);
  });

  test('should persist recent searches', async ({ page }) => {
    // First visit - perform search
    // Close modal
    // Open modal again
    // Verify recent search shown
  });
});
```

### Test Coverage Goals

| Category | Target |
|----------|--------|
| Unit tests | > 80% coverage for hooks |
| Integration tests | All user flows covered |
| E2E tests | Critical paths only |
| Accessibility | 100% WCAG 2.1 AA |

---

## Edge Cases

### Network Conditions

| Condition | Behavior |
|-----------|----------|
| **Slow network (3G+)** | Show skeleton loaders, allow cancellation |
| **Offline** | Show offline message, cache recent searches |
| **API timeout (10s)** | Error state with retry option |
| **Slow index load** | Show "index loading" state, poll for readiness |

### Query Edge Cases

| Query Type | Handling |
|------------|----------|
| Empty string | Show recent searches |
| 1 character | Show "type more" message |
| Special characters | Properly escaped, handled by Fuse.js |
| Unicode/Diacritics | `ignoreDiacritics: true` in Fuse.js |
| Very long query (>100 chars) | Truncated in UI, API accepts up to 100 |
| HTML/script injection | Escaped by React, validated by Zod |

### Result Edge Cases

| Condition | Handling |
|-----------|----------|
| All results filtered out | Show "no results for this filter" |
| Too many results (>1000) | Cap at limit, show "View all" |
| Duplicate results | Deduplicated by ID |
| Missing data fields | Gracefully handled, optional chaining |
| Entity deleted/moved | 404 handler on navigation |

### State Management Edge Cases

| Condition | Handling |
|-----------|----------|
| Modal open during navigation | Close modal on navigation |
| Back button with open modal | Close modal, no navigation |
| Browser back to close modal | Reopens with previous state? No, reset |
| LocalStorage disabled | Graceful fallback, no recent searches |

---

## Accessibility

### ARIA Requirements

```tsx
// Search modal
<dialog
  aria-label="Search"
  aria-modal="true"
  role="dialog"
>

// Search input
<input
  role="searchbox"
  aria-autocomplete="list"
  aria-controls="search-results"
  aria-activedescendant={`result-${selectedId}`}
/>

// Results list
<ul role="listbox" id="search-results">
  <li role="option" id="result-artist-123">...</li>
</ul>

// Tabs
<tablist aria-label="Filter by entity type">
  <tab aria-selected={activeTab === 'all'}>All</tab>
</tablist>
```

### Focus Management

1. **Open modal**: Focus moves to search input
2. **Close modal**: Focus returns to trigger button
3. **Keyboard nav**: `aria-activedescendant` updated
4. **Tab trap**: Focus stays within modal

### Screen Reader

- Live region for search status updates
- Entity type announced when filtering
- Result count announced
- Keyboard shortcuts documented

---

## Performance Considerations

### Optimizations

| Area | Technique |
|------|-----------|
| Query debouncing | 300ms delay, cancel pending |
| Lazy loading | Components imported dynamically |
| Bundle size | Tree-shaking, code splitting |
| API calls | tRPC caching, deduplication |
| localStorage | Throttled writes |
| Animations | CSS transforms, `will-change` |

### Metrics Targets

| Metric | Target |
|--------|--------|
| Modal open time | < 100ms |
| Search response (P95) | < 500ms |
| Input to results | < 800ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Lighthouse Accessibility | 100 |

---

## Open Questions

1. **Recent search deduplication**: Should identical queries be updated or ignored?
2. **Search analytics**: Should we track search queries for analytics?
3. **"View all" behavior**: Should it open in same tab or new tab?
4. **Mobile modal**: Full-screen or centered modal on mobile?
5. **Empty state content**: What browse categories to show when no recent searches?

---

## Dependencies

### External Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `fuse.js` | ^7.0.0 | Fuzzy search (already in core) |
| `@radix-ui/react-dialog` | ^1.0.5 | Modal dialog |
| `@radix-ui/react-tabs` | ^1.0.4 | Entity type tabs |
| `@tanstack/react-query` | ^5.0.0 | tRPC/react-query |

### Internal Dependencies

| Package | Import Path |
|---------|-------------|
| @rasika/core | `Search` domain module |
| @rasika/trpc | `searchRouter` |
| packages/web | UI components, hooks |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Architecture | Initial draft |

---

## References

- [Requirements Document](../requirements-search-ui.md)
- [Fuse.js Documentation](../stack/fusejs.md)
- [Coding Standards](../coding-standards.md)
- [Existing GlobalSearch Component](../packages/web/app/components/GlobalSearch.tsx)
- [tRPC Search Router](../packages/trpc/src/routers/search.ts)
- [Core Search Domain](../packages/core/src/domain/search/)

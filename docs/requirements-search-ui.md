# Requirements Document: Search UI Integration

## Original Requirements

1. The header needs to have a unified search.
2. Every entity needs to have search related to that entity.
3. Search results can be a paginated list of cards.

## Clarifications (from Q&A)

### Header Search UI
- **Pattern**: Modal overlay
- When user clicks search icon or types, a full-screen overlay opens
- Results appear as user types with debouncing
- Modal can be closed with ESC key or clicking outside

### Entity Search Scope
- **Pattern**: Unified with filters
- Single search bar searches all entities (artists, ragas, talas, compositions)
- Modal shows tabs or toggles to filter by entity type
- Users can switch between "All" and specific entity types

### Results Display
- **Pattern**: Grouped cards
- Results displayed as cards grouped by entity type
- Each group (Artists, Ragas, Talas, Compositions) has a header
- Shows top results with "View all" link for each category
- Pagination at bottom for full results

### Click Behavior
- **Pattern**: Navigate to details
- Clicking a result card navigates to the entity's detail page
- For example, clicking an artist card goes to `/carnatic/artists/:artistid`

### Empty State
- **Pattern**: Browse options
- When search input is empty, show browse-friendly content
- Options: recent searches, popular content, browse by category
- Not just a minimal "start typing" message

## Technical Context

- Frontend: Remix / React Router v7
- API: tRPC with existing search endpoints (`search.query`, `search.health`)
- Styling: Existing design system in packages/web
- Search API: `/trpc/search.query` with filters, limit, offset

## Non-Requirements

- Real-time search (debounce is acceptable)
- Advanced filtering beyond entity type
- Autocomplete/typeahead dropdown in header (modal overlay approach)
- Inline editing or actions from search results

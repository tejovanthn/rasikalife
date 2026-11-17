import { SearchInputSchema } from '@rasika/core/domain/search/client';
import { describe, expect, it } from 'vitest';
import { COMPOSITION_SEARCH_FILTERS } from './composition-search';

describe('COMPOSITION_SEARCH_FILTERS', () => {
  it('passes the search API input check', () => {
    const parsed = SearchInputSchema.safeParse({
      query: 'endaro',
      filters: COMPOSITION_SEARCH_FILTERS,
      limit: 36,
      offset: 0,
    });
    expect(parsed.success).toBe(true);
  });
});

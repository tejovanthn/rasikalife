import type { SearchableFieldSchema } from '@rasika/core/domain/search/client';
import type { z } from 'zod';

type SearchableField = z.infer<typeof SearchableFieldSchema>;

// The search API accepts only these fields. The index holds composition titles
// in `name`; lyrics text is not a separate field.
export const COMPOSITION_SEARCH_FILTERS: SearchableField[] = ['name', 'description'];

// packages/core/src/domain/search/schema.ts

import { z } from 'zod';

export const SearchableFieldSchema = z.enum(['name', 'description']);

export type SearchableField = z.infer<typeof SearchableFieldSchema>;

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.array(SearchableFieldSchema).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

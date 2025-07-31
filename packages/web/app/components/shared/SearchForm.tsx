import { searchConfigs } from '~/lib/searchConfig';
import type { SearchFilterField } from '~/lib/searchConfig';
// Legacy SearchForm - now uses UnifiedSearch under the hood
import { UnifiedSearch } from './UnifiedSearch';

// Keep the old interface for backward compatibility
export interface SearchFilter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
}

interface SearchFormProps {
  searchQuery?: string;
  filters?: SearchFilter[];
  clearPath: string;
  searchPlaceholder?: string;
  searchLabel?: string;
}

export function SearchForm({
  searchQuery,
  filters = [],
  clearPath,
  searchPlaceholder = 'Search...',
  searchLabel = 'Search',
}: SearchFormProps) {
  // Convert old SearchFilter format to new SearchFilterField format
  const convertedFilters: SearchFilterField[] = filters.map(filter => ({
    ...filter,
    options: filter.options?.map(opt => ({ value: opt.value, label: opt.label })),
  }));

  const config = {
    ...searchConfigs.entityIndex('items', clearPath, convertedFilters),
    placeholder: searchPlaceholder,
    searchLabel,
  };

  return <UnifiedSearch config={config} />;
}

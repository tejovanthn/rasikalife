// Search result types - mirrors @rasika/core to avoid bundling Node.js dependencies
export type SearchEntityType =
  | 'artist'
  | 'raga'
  | 'tala'
  | 'composition'
  | 'venue'
  | 'organiser'
  | 'event'
  | 'festival';

export type SearchableField = 'name' | 'description';

export interface SearchHighlight {
  field: SearchableField;
  text: string;
}

export interface SearchResultItem {
  id: string;
  type: SearchEntityType;
  name: string;
  highlights: SearchHighlight[];
  score?: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}

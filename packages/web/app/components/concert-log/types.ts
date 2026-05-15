export type SetlistItemDraft = {
  _id: string; // stable client-side key — never sent to server
  order: number;
  compositionId?: string;
  compositionTitle: string;
  ragaId?: string;
  ragaName?: string;
  talaId?: string;
  talaName?: string;
  compositionType?: string;
  publicNote?: string;
  isHighlight: boolean;
  isFreeText: boolean;
};

export type SetlistDraft = {
  notes: string;
  items: SetlistItemDraft[];
};

export type CompositionSuggestion = {
  id: string;
  name: string;
  score: number;
};

import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import { CompositionSearch } from './CompositionSearch';
import { CompositionTypePicker } from './CompositionTypePicker';
import type { CompositionSuggestion, SetlistItemDraft } from './types';

type Props = {
  item: SetlistItemDraft;
  index: number;
  total: number;
  onChange: (updated: SetlistItemDraft) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function SetlistItemRow({ item, index, total, onChange, onRemove, onMoveUp, onMoveDown }: Props) {
  const [showNote, setShowNote] = useState(!!item.publicNote);
  const [freeTextMode, setFreeTextMode] = useState(item.isFreeText);

  function handleCompositionSelect(s: CompositionSuggestion | null) {
    if (!s) {
      onChange({ ...item, compositionId: undefined, compositionTitle: '', isFreeText: false });
      return;
    }
    onChange({
      ...item,
      compositionId: s.id,
      compositionTitle: s.name,
      isFreeText: false,
    });
  }

  function handleFreeText(title: string) {
    setFreeTextMode(true);
    onChange({ ...item, compositionId: undefined, compositionTitle: title, isFreeText: true });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
          {index + 1}.
        </span>

        <button
          type="button"
          onClick={() => onChange({ ...item, isHighlight: !item.isHighlight })}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-amber-400 transition-colors',
            item.isHighlight && 'text-amber-400'
          )}
          aria-label={item.isHighlight ? 'Remove highlight' : 'Mark as highlight'}
          title="Concert highlight (private)"
        >
          <Star className="h-4 w-4" fill={item.isHighlight ? 'currentColor' : 'none'} />
        </button>

        <div className="flex-1 min-w-0">
          {freeTextMode ? (
            <div className="space-y-1">
              <input
                type="text"
                value={item.compositionTitle}
                onChange={e => onChange({ ...item, compositionTitle: e.target.value })}
                placeholder="Composition title (free text)"
                className="w-full px-2.5 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground italic">
                Couldn't find this composition. It'll be reviewed and linked later.
              </p>
              <button
                type="button"
                onClick={() => { setFreeTextMode(false); onChange({ ...item, isFreeText: false }); }}
                className="text-xs text-primary hover:underline"
              >
                Search again
              </button>
            </div>
          ) : (
            <CompositionSearch
              value={item.compositionId}
              displayValue={item.compositionTitle}
              onSelect={handleCompositionSelect}
              onFreeText={handleFreeText}
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-destructive"
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="pl-14 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-muted-foreground mb-0.5">Raga</label>
            <input
              type="text"
              value={item.ragaName ?? ''}
              onChange={e => onChange({ ...item, ragaName: e.target.value || undefined })}
              placeholder="Raga name"
              className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs"
            />
          </div>
          <div>
            <label className="block text-muted-foreground mb-0.5">Tala</label>
            <input
              type="text"
              value={item.talaName ?? ''}
              onChange={e => onChange({ ...item, talaName: e.target.value || undefined })}
              placeholder="Tala name"
              className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs"
            />
          </div>
        </div>

        <CompositionTypePicker
          value={item.compositionType}
          onChange={type => onChange({ ...item, compositionType: type })}
        />

        {showNote ? (
          <div>
            <textarea
              value={item.publicNote ?? ''}
              onChange={e => onChange({ ...item, publicNote: e.target.value || undefined })}
              placeholder="Public note — e.g. '15min alapana', 'neraval at pallavi'"
              maxLength={500}
              rows={2}
              className="w-full px-2 py-1 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs resize-y"
            />
            <div className="text-xs text-muted-foreground text-right">
              {(item.publicNote ?? '').length}/500
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            + Add public note
          </button>
        )}
      </div>
    </li>
  );
}

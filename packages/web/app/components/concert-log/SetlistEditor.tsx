import { PlusCircle } from 'lucide-react';
import type { SetlistDraft, SetlistItemDraft } from './types';
import { SetlistItemRow } from './SetlistItemRow';

type Props = {
  draft: SetlistDraft;
  onChange: (draft: SetlistDraft) => void;
};

function newItem(order: number): SetlistItemDraft {
  return {
    _id: crypto.randomUUID(),
    order,
    compositionTitle: '',
    isHighlight: false,
    isFreeText: false,
  };
}

export function SetlistEditor({ draft, onChange }: Props) {
  const items = draft.items;

  function updateItem(index: number, updated: SetlistItemDraft) {
    const next = items.map((item, i) => (i === index ? updated : item));
    onChange({ ...draft, items: next });
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i }));
    onChange({ ...draft, items: next });
  }

  function addItem() {
    onChange({ ...draft, items: [...items, newItem(items.length)] });
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const next = [...items];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    onChange({ ...draft, items: next.map((item, i) => ({ ...item, order: i })) });
  }

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">Setlist</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-3">No items yet. Add the first piece performed.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {items.map((item, index) => (
            <SetlistItemRow
              key={item._id}
              item={item}
              index={index}
              total={items.length}
              onChange={updated => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
              onMoveUp={() => moveItem(index, 'up')}
              onMoveDown={() => moveItem(index, 'down')}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Add item
      </button>
    </section>
  );
}

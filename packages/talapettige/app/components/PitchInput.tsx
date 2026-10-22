import { Field, Input, Select } from '@rasika/ui';
import { NOTE_NAMES, formatHz, noteToHz } from '~/lib/string-configs';

interface PitchInputProps {
  noteIndex: number;
  cents: number;
  onNoteChange: (noteIndex: number) => void;
  onCentsChange: (cents: number) => void;
}

export function PitchInput({ noteIndex, cents, onNoteChange, onCentsChange }: PitchInputProps) {
  const hz = noteToHz(noteIndex, cents);

  const handleCentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(value) && value >= -99 && value <= 99) {
      onCentsChange(value);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-sm">Pitch (Sa)</span>
        <span className="text-muted-foreground text-sm tabular-nums">{formatHz(hz)} Hz</span>
      </div>
      <div className="flex items-end gap-3">
        <Field label="Note" htmlFor="pitch-note" className="flex-1">
          <Select
            id="pitch-note"
            value={noteIndex}
            onChange={e => onNoteChange(Number(e.target.value))}
          >
            {NOTE_NAMES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cents" htmlFor="pitch-cents" className="w-24">
          <Input
            id="pitch-cents"
            type="number"
            inputMode="numeric"
            min={-99}
            max={99}
            value={cents}
            onChange={handleCentsChange}
          />
        </Field>
      </div>
    </div>
  );
}

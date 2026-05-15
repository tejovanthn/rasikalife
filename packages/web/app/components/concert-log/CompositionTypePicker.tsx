import { COMPOSITION_TYPES } from '@rasika/core/domain/concert-log-item/client';
import { cn } from '~/lib/utils';

const LABELS: Record<string, string> = {
  varnam: 'Varnam',
  kriti: 'Kriti',
  rtp: 'RTP',
  thillana: 'Thillana',
  javali: 'Javali',
  padam: 'Padam',
  viruttam: 'Viruttam',
  thukkada: 'Thukkada',
  slokam: 'Slokam',
  tani: 'Tani',
  other: 'Other',
};

type Props = {
  value?: string;
  onChange: (value: string | undefined) => void;
};

export function CompositionTypePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Composition type">
      {COMPOSITION_TYPES.map(type => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(value === type ? undefined : type)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
            value === type
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
          )}
          aria-pressed={value === type}
        >
          {LABELS[type]}
        </button>
      ))}
    </div>
  );
}

import { Button, Label } from '@rasika/ui';
import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '~/components/ui/slider';

/** The volume slider and mute button that the shruthi and the tala both carry. */
export function VolumeControl({
  id,
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
}: {
  id: string;
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label id={id}>Volume</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">
            {muted ? 'Muted' : `${Math.round(volume * 100)}%`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMuteToggle}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      <Slider
        aria-labelledby={id}
        value={[muted ? 0 : volume]}
        onValueChange={([value]) => onVolumeChange(value)}
        min={0}
        max={1}
        step={0.01}
        disabled={muted}
      />
    </div>
  );
}

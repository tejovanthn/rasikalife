import { Field, Label, Select } from '@rasika/ui';
import { VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { SettingsSection } from '~/components/settings-section';
import { Slider } from '~/components/ui/slider';
import { Switch } from '~/components/ui/switch';
import { VolumeControl } from '~/components/volume-control';
import type { DSPParams, EngineType } from '~/lib/dsp-engine';
import {
  DEFAULT_FIRST_STRING,
  DEFAULT_PAUSE,
  INDIAN_NOTES,
  INDIAN_NOTE_ORDER,
  type IndianNoteKey,
  PAUSE_OPTIONS,
  type PauseOption,
  getCyclePattern,
  getStringRatios,
  noteToHz,
} from '~/lib/string-configs';

const STORAGE_KEY = 'talapettige-settings';

// Zod schema for Shruthi/Tanpura settings validation
const SettingsSchema = z.object({
  cpm: z.number().min(5).max(30),
  firstString: z.enum(['Sa', 're', 'Re', 'ga', 'Ga', 'ma', 'Ma', 'Pa', 'dha', 'Dha', 'ni', 'Ni']),
  pause: z.enum(['none', 'first', 'last', 'firstAndLast']),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  engine: z.enum(['tambura', 'puretones']),
  isOpen: z.boolean(),
});

type Settings = z.infer<typeof SettingsSchema>;

const DEFAULT_SETTINGS: Settings = {
  cpm: 10,
  firstString: DEFAULT_FIRST_STRING,
  pause: DEFAULT_PAUSE,
  volume: 0.7,
  muted: false,
  engine: 'tambura',
  isOpen: false,
};

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = SettingsSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      // If validation fails, merge valid fields with defaults
      return { ...DEFAULT_SETTINGS, ...SettingsSchema.partial().parse(parsed) };
    }
  } catch {
    // Ignore errors, return defaults
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore errors
  }
}

interface TanpuraControlsProps {
  noteIndex: number;
  cents: number;
  isPlaying: boolean;
  setParam: (name: keyof DSPParams, value: number | string) => void;
  setEngine: (engine: EngineType) => Promise<void>;
  currentEngine: EngineType;
}

export function TanpuraControls({
  noteIndex,
  cents,
  isPlaying,
  setParam,
  setEngine,
  currentEngine,
}: TanpuraControlsProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings());
    setIsHydrated(true);
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (isHydrated) {
      saveSettings(settings);
    }
  }, [settings, isHydrated]);

  // Update DSP params when settings change
  useEffect(() => {
    if (!isHydrated) return;

    const hz = noteToHz(noteIndex, cents);
    setParam('sa', hz);
    setParam('cpm', settings.cpm);
    setParam('volume', settings.muted ? 0 : settings.volume);

    const ratios = getStringRatios(settings.firstString);
    setParam('ratio1', ratios[0]);
    setParam('ratio2', ratios[1]);
    setParam('ratio3', ratios[2]);
    setParam('ratio4', ratios[3]);

    const cyclePattern = getCyclePattern(settings.pause);
    setParam('cycleLength', cyclePattern.length);
    setParam('cyclePattern', JSON.stringify(cyclePattern));
  }, [settings, noteIndex, cents, setParam, isHydrated]);

  const handleCpmChange = (values: number[]) => {
    setSettings(s => ({ ...s, cpm: values[0] }));
  };

  const handleVolumeChange = (volume: number) => {
    setSettings(s => ({ ...s, volume, muted: false }));
  };

  const handleMuteToggle = () => {
    setSettings(s => ({ ...s, muted: !s.muted }));
  };

  const handleFirstStringChange = (value: string) => {
    setSettings(s => ({ ...s, firstString: value as IndianNoteKey }));
  };

  const handlePauseChange = (value: string) => {
    setSettings(s => ({ ...s, pause: value as PauseOption }));
  };

  const handleEngineChange = async (checked: boolean) => {
    const engine: EngineType = checked ? 'puretones' : 'tambura';
    setSettings(s => ({ ...s, engine }));
    await setEngine(engine);
  };

  const handleOpenChange = (open: boolean) => {
    setSettings(s => ({ ...s, isOpen: open }));
  };

  if (!isHydrated) {
    return null;
  }

  // Calculate timing info
  const cyclePattern = getCyclePattern(settings.pause);
  const secondsPerStep = 60 / settings.cpm / cyclePattern.length;

  // Build string pattern display
  const stringNames = [INDIAN_NOTES[settings.firstString].name, 'Sa', 'Sa', 'sa'];

  return (
    <SettingsSection
      title="Shruthi"
      summary={
        <>
          {stringNames.join('-')} @ {settings.cpm} cpm
          {settings.muted && <VolumeX className="ml-2 inline h-4 w-4" aria-label="Muted" />}
        </>
      }
      open={settings.isOpen}
      onOpenChange={handleOpenChange}
    >
      <Field
        label="First string"
        htmlFor="shruthi-first-string"
        hint={`Pattern: ${stringNames.join(' - ')}`}
      >
        <Select
          id="shruthi-first-string"
          value={settings.firstString}
          onChange={e => handleFirstStringChange(e.target.value)}
        >
          {INDIAN_NOTE_ORDER.map(key => (
            <option key={key} value={key}>
              {INDIAN_NOTES[key].name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Pause after" htmlFor="shruthi-pause" hint={PAUSE_OPTIONS[settings.pause].label}>
        <Select
          id="shruthi-pause"
          value={settings.pause}
          onChange={e => handlePauseChange(e.target.value)}
        >
          {Object.entries(PAUSE_OPTIONS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-1">
        <div className="flex justify-between gap-2">
          <Label id="shruthi-speed">Speed</Label>
          <span className="text-right text-muted-foreground text-sm">
            {settings.cpm} cycles/min ({secondsPerStep.toFixed(1)}s per string)
          </span>
        </div>
        <Slider
          aria-labelledby="shruthi-speed"
          value={[settings.cpm]}
          onValueChange={handleCpmChange}
          min={5}
          max={30}
          step={1}
        />
      </div>

      <VolumeControl
        id="shruthi-volume"
        volume={settings.volume}
        muted={settings.muted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="shruthi-engine">Sound engine</Label>
          <p className="text-muted-foreground text-sm">
            {currentEngine === 'tambura'
              ? 'Physical modelling (richer)'
              : 'Additive synthesis (cleaner)'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Tambura</span>
          <Switch
            id="shruthi-engine"
            checked={settings.engine === 'puretones'}
            onCheckedChange={handleEngineChange}
          />
          <span>Pure</span>
        </div>
      </div>
    </SettingsSection>
  );
}

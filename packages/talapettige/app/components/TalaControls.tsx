import { Button, Field, Input, Label, Select, cn } from '@rasika/ui';
import { VolumeX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { SettingsSection } from '~/components/settings-section';
import { VolumeControl } from '~/components/volume-control';
import type { TalaParams } from '~/hooks/useTalaDSP';
import { INDIAN_NOTES, type IndianNoteKey, noteToHz } from '~/lib/string-configs';
import {
  type Akshara,
  DEFAULT_JATI,
  DEFAULT_NADAI,
  DEFAULT_TALA,
  JATIS,
  type JatiKey,
  NADAIS,
  type NadaiKey,
  TALA_PATTERNS,
  type TalaKey,
  getAngaBoundaries,
  getTalaAksharas,
  getTalaLength,
  getTalaPatternDisplay,
} from '~/lib/tala-configs';

const STORAGE_KEY = 'talapettige-tala-settings';

// Zod schema for TalaSettings validation
const TalaSettingsSchema = z.object({
  tala: z.enum([
    'eka',
    'rupaka',
    'jhampa',
    'triputa',
    'matya',
    'ata',
    'dhruva',
    'misraChapu',
    'khandaChapu',
  ]),
  jati: z.enum(['tisra', 'chatusra', 'khanda', 'misra', 'sankeerna']),
  nadai: z.enum(['single', 'double', 'tisra', 'chatusra', 'khanda', 'misra', 'sankeerna']),
  bpm: z.number().min(30).max(300),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  isOpen: z.boolean(),
  mutedBeats: z.array(z.number().int().min(0)),
});

type TalaSettings = z.infer<typeof TalaSettingsSchema>;

const DEFAULT_SETTINGS: TalaSettings = {
  tala: DEFAULT_TALA,
  jati: DEFAULT_JATI,
  nadai: DEFAULT_NADAI,
  bpm: 60,
  volume: 0.5,
  muted: false,
  isOpen: false,
  mutedBeats: [],
};

function loadSettings(): TalaSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = TalaSettingsSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      // If validation fails, merge valid fields with defaults
      return { ...DEFAULT_SETTINGS, ...TalaSettingsSchema.partial().parse(parsed) };
    }
  } catch {
    // Ignore errors, return defaults
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: TalaSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore errors
  }
}

interface TalaControlsProps {
  noteIndex: number;
  cents: number;
  isPlaying: boolean;
  currentBeat: number;
  setParam: (name: keyof TalaParams, value: number | Akshara[]) => void;
  firstString: IndianNoteKey;
}

export function TalaControls({
  noteIndex,
  cents,
  isPlaying,
  currentBeat,
  setParam,
  firstString,
}: TalaControlsProps) {
  const [settings, setSettings] = useState<TalaSettings>(DEFAULT_SETTINGS);
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

  // Get aksharas with muted status
  const getAksharasWithMuted = useCallback(() => {
    const aksharas = getTalaAksharas(settings.tala, settings.jati);
    return aksharas.map((akshara, index) => ({
      ...akshara,
      muted: settings.mutedBeats.includes(index),
    }));
  }, [settings.tala, settings.jati, settings.mutedBeats]);

  // Update DSP params when settings change
  useEffect(() => {
    if (!isHydrated) return;

    const hz = noteToHz(noteIndex, cents);
    setParam('sa', hz);
    setParam('bpm', settings.bpm);
    setParam('volume', settings.muted ? 0 : settings.volume);
    setParam('nadaiCount', NADAIS[settings.nadai].count);
    setParam('nonSamRatio', INDIAN_NOTES[firstString].ratio);

    const pattern = getAksharasWithMuted();
    setParam('pattern', pattern);
  }, [settings, noteIndex, cents, setParam, isHydrated, getAksharasWithMuted, firstString]);

  const handleTalaChange = (value: string) => {
    // Reset muted beats when tala changes
    setSettings(s => ({ ...s, tala: value as TalaKey, mutedBeats: [] }));
  };

  const handleJatiChange = (value: string) => {
    // Reset muted beats when jati changes
    setSettings(s => ({ ...s, jati: value as JatiKey, mutedBeats: [] }));
  };

  const handleNadaiChange = (value: string) => {
    setSettings(s => ({ ...s, nadai: value as NadaiKey }));
  };

  const handleVolumeChange = (volume: number) => {
    setSettings(s => ({ ...s, volume, muted: false }));
  };

  const handleMuteToggle = () => {
    setSettings(s => ({ ...s, muted: !s.muted }));
  };

  const handleOpenChange = (open: boolean) => {
    setSettings(s => ({ ...s, isOpen: open }));
  };

  const handleBeatClick = (beatIndex: number) => {
    setSettings(s => {
      const mutedBeats = s.mutedBeats.includes(beatIndex)
        ? s.mutedBeats.filter(i => i !== beatIndex)
        : [...s.mutedBeats, beatIndex];
      return { ...s, mutedBeats };
    });
  };

  const handleBpmQuickAdjust = (operation: 'divide2' | 'minus5' | 'plus5' | 'multiply2') => {
    setSettings(s => {
      let newBpm = s.bpm;
      switch (operation) {
        case 'divide2':
          newBpm = Math.round(s.bpm / 2);
          break;
        case 'minus5':
          newBpm = s.bpm - 5;
          break;
        case 'plus5':
          newBpm = s.bpm + 5;
          break;
        case 'multiply2':
          newBpm = s.bpm * 2;
          break;
      }
      return { ...s, bpm: Math.max(30, Math.min(300, newBpm)) };
    });
  };

  if (!isHydrated) {
    return null;
  }

  const talaConfig = TALA_PATTERNS[settings.tala];
  const hasJati = talaConfig.hasJati;
  const totalAksharas = getTalaLength(settings.tala, settings.jati);
  const patternDisplay = getTalaPatternDisplay(settings.tala);
  const aksharas = getAksharasWithMuted();
  const angaBoundaries = getAngaBoundaries(settings.tala, settings.jati);

  // Only show beat visualization when playing
  const displayBeat = isPlaying ? currentBeat : -1;

  // Group aksharas by anga for display with separators
  const angaGroups: Akshara[][] = [];
  let currentGroup: Akshara[] = [];
  let currentAngaIndex = 0;

  aksharas.forEach((akshara, index) => {
    if (akshara.angaIndex !== currentAngaIndex && index > 0) {
      angaGroups.push(currentGroup);
      currentGroup = [];
      currentAngaIndex = akshara.angaIndex;
    }
    currentGroup.push(akshara);
  });
  if (currentGroup.length > 0) {
    angaGroups.push(currentGroup);
  }

  const tempoButtons = [
    { op: 'divide2', label: '/2', name: 'Halve tempo' },
    { op: 'minus5', label: '-5', name: 'Slower by 5' },
    { op: 'plus5', label: '+5', name: 'Faster by 5' },
    { op: 'multiply2', label: 'x2', name: 'Double tempo' },
  ] as const;

  return (
    <SettingsSection
      title="Tala"
      summary={
        <>
          {talaConfig.name} ({totalAksharas}) @ {settings.bpm} apm
          {settings.muted && <VolumeX className="ml-2 inline h-4 w-4" aria-label="Muted" />}
        </>
      }
      open={settings.isOpen}
      onOpenChange={handleOpenChange}
    >
      <Field label="Tala" htmlFor="tala-name" hint={`Pattern: ${patternDisplay}`}>
        <Select
          id="tala-name"
          value={settings.tala}
          onChange={e => handleTalaChange(e.target.value)}
        >
          {(Object.keys(TALA_PATTERNS) as TalaKey[]).map(key => (
            <option key={key} value={key}>
              {TALA_PATTERNS[key].name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={hasJati ? 'Jati' : 'Jati (not used by chapu talas)'}
        htmlFor="tala-jati"
        hint={`${totalAksharas} aksharas per cycle`}
      >
        <Select
          id="tala-jati"
          value={settings.jati}
          onChange={e => handleJatiChange(e.target.value)}
          disabled={!hasJati}
        >
          {(Object.keys(JATIS) as JatiKey[]).map(key => (
            <option key={key} value={key}>
              {JATIS[key].name} ({JATIS[key].count})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nadai (subdivision)" htmlFor="tala-nadai">
        <Select
          id="tala-nadai"
          value={settings.nadai}
          onChange={e => handleNadaiChange(e.target.value)}
        >
          {(Object.keys(NADAIS) as NadaiKey[]).map(key => (
            <option key={key} value={key}>
              {NADAIS[key].name} ({NADAIS[key].count})
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="tala-tempo">Tempo (aksharas per minute)</Label>
        <div className="flex items-center gap-1">
          {tempoButtons.slice(0, 2).map(({ op, label, name }) => (
            <Button
              key={op}
              variant="outline"
              size="icon"
              aria-label={name}
              onClick={() => handleBpmQuickAdjust(op)}
            >
              {label}
            </Button>
          ))}
          <Input
            id="tala-tempo"
            type="number"
            inputMode="numeric"
            min={30}
            max={300}
            value={settings.bpm}
            onChange={e => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val)) {
                setSettings(s => ({ ...s, bpm: val }));
              }
            }}
            onBlur={e => {
              const val = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(val) || val < 30) {
                setSettings(s => ({ ...s, bpm: 30 }));
              } else if (val > 300) {
                setSettings(s => ({ ...s, bpm: 300 }));
              }
            }}
            className="min-w-0 flex-1 text-center tabular-nums"
          />
          {tempoButtons.slice(2).map(({ op, label, name }) => (
            <Button
              key={op}
              variant="outline"
              size="icon"
              aria-label={name}
              onClick={() => handleBpmQuickAdjust(op)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <VolumeControl
        id="tala-volume"
        volume={settings.volume}
        muted={settings.muted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
      />

      <div className="space-y-2">
        <div>
          <span className="font-medium text-sm">Beat pattern</span>
          <p className="text-muted-foreground text-sm">
            Tap a beat to mute it. Filled beats are sam (Sa).
          </p>
        </div>
        <div className="space-y-1.5">
          {angaGroups.map((group, groupIndex) => {
            const angaType = talaConfig.hasJati ? talaConfig.pattern[groupIndex] : null;

            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: angas have no identity but their place
              <div key={groupIndex} className="flex items-center gap-2">
                {angaType && (
                  <span className="w-4 shrink-0 text-right text-muted-foreground text-xs">
                    {angaType}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  {group.map((akshara, beatIndexInGroup) => {
                    const globalIndex = angaBoundaries[groupIndex] + beatIndexInGroup;
                    const isCurrentBeat = displayBeat === globalIndex;
                    const isMuted = akshara.muted;

                    return (
                      <button
                        type="button"
                        key={globalIndex}
                        onClick={() => handleBeatClick(globalIndex)}
                        aria-pressed={isMuted}
                        aria-label={`Beat ${globalIndex + 1}${akshara.isSam ? ', sam' : ''}${isMuted ? ', muted' : ''}`}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-md border-2 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          isCurrentBeat
                            ? akshara.isSam
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-foreground bg-foreground text-background'
                            : isMuted
                              ? 'border-dashed border-border bg-transparent text-muted-foreground'
                              : akshara.isSam
                                ? 'border-primary bg-accent text-accent-foreground'
                                : 'border-border bg-background text-foreground hover:bg-accent'
                        )}
                      >
                        {isMuted ? '×' : globalIndex + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SettingsSection>
  );
}

import { Button, Card, CardContent, PageTitle } from '@rasika/ui';
import { Play, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { PitchInput } from '~/components/PitchInput';
import { TalaControls } from '~/components/TalaControls';
import { TanpuraControls } from '~/components/TanpuraControls';
import { useFaustDSP } from '~/hooks/useFaustDSP';
import { useTalaDSP } from '~/hooks/useTalaDSP';
import { DEFAULT_FIRST_STRING, type IndianNoteKey, noteToHz } from '~/lib/string-configs';

const PITCH_STORAGE_KEY = 'talapettige-pitch';

// Zod schema for pitch settings validation
const PitchSettingsSchema = z.object({
  noteIndex: z.number().int().min(0).max(11),
  cents: z.number().min(-50).max(50),
});

type PitchSettings = z.infer<typeof PitchSettingsSchema>;

const DEFAULT_PITCH: PitchSettings = {
  noteIndex: 0, // C
  cents: 0,
};

function loadPitchSettings(): PitchSettings {
  if (typeof window === 'undefined') return DEFAULT_PITCH;
  try {
    const stored = localStorage.getItem(PITCH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = PitchSettingsSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      // If validation fails, merge valid fields with defaults
      return { ...DEFAULT_PITCH, ...PitchSettingsSchema.partial().parse(parsed) };
    }
  } catch {
    // Ignore errors, return defaults
  }
  return DEFAULT_PITCH;
}

function savePitchSettings(settings: PitchSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore errors
  }
}

export function meta() {
  return [
    { title: 'Talapettige - Indian Tanpura & Tala' },
    {
      name: 'description',
      content: 'A web-based Indian Tanpura synthesizer with Carnatic Tala metronome',
    },
  ];
}

const TANPURA_STORAGE_KEY = 'talapettige-settings';
const TALA_STORAGE_KEY = 'talapettige-tala-settings';
const HISTORY_STORAGE_KEY = 'talapettige-history';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAX_HISTORY_ENTRIES = 50;

interface HistoryEntry {
  id: string;
  timestamp: number;
  pitch: {
    noteIndex: number;
    noteName: string;
    cents: number;
  };
  tala: {
    name: string;
    jati: string;
    nadai: string;
    bpm: number;
  };
  tanpura: {
    firstString: string;
    cpm: number;
  };
}

function saveHistoryEntry(pitch: PitchSettings, firstString: IndianNoteKey) {
  if (typeof window === 'undefined') return;

  try {
    // Read tala settings
    const talaStored = localStorage.getItem(TALA_STORAGE_KEY);
    const talaSettings = talaStored ? JSON.parse(talaStored) : {};

    // Read tanpura settings
    const tanpuraStored = localStorage.getItem(TANPURA_STORAGE_KEY);
    const tanpuraSettings = tanpuraStored ? JSON.parse(tanpuraStored) : {};

    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      pitch: {
        noteIndex: pitch.noteIndex,
        noteName: NOTE_NAMES[pitch.noteIndex],
        cents: pitch.cents,
      },
      tala: {
        name: talaSettings.tala || 'triputa',
        jati: talaSettings.jati || 'chatusra',
        nadai: talaSettings.nadai || 'chatusra',
        bpm: talaSettings.bpm || 60,
      },
      tanpura: {
        firstString: firstString,
        cpm: tanpuraSettings.cpm || 10,
      },
    };

    // Load existing history
    const historyStored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const history: HistoryEntry[] = historyStored ? JSON.parse(historyStored) : [];

    // Add new entry at the beginning
    history.unshift(entry);

    // Keep only the last MAX_HISTORY_ENTRIES
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.length = MAX_HISTORY_ENTRIES;
    }

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore errors
  }
}

export default function Home() {
  const [pitch, setPitch] = useState<PitchSettings>(DEFAULT_PITCH);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [firstString, setFirstString] = useState<IndianNoteKey>(DEFAULT_FIRST_STRING);

  // Audio hooks
  const shruthi = useFaustDSP();
  const tala = useTalaDSP();

  // Load pitch settings on mount
  useEffect(() => {
    setPitch(loadPitchSettings());
    setIsHydrated(true);
  }, []);

  // Read firstString from tanpura settings and listen for changes
  useEffect(() => {
    const readFirstString = () => {
      try {
        const stored = localStorage.getItem(TANPURA_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.firstString) {
            setFirstString(parsed.firstString);
          }
        }
      } catch {
        // Ignore errors
      }
    };

    readFirstString();

    // Listen for storage changes (from other tabs or same tab via custom event)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TANPURA_STORAGE_KEY) {
        readFirstString();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Also poll for changes within the same tab (storage event doesn't fire for same tab)
    const interval = setInterval(readFirstString, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Save pitch settings when they change
  useEffect(() => {
    if (isHydrated) {
      savePitchSettings(pitch);
    }
  }, [pitch, isHydrated]);

  // Update pitch in both DSP engines
  useEffect(() => {
    if (!isHydrated) return;
    const hz = noteToHz(pitch.noteIndex, pitch.cents);
    shruthi.setParam('sa', hz);
    tala.setParam('sa', hz);
  }, [pitch, isHydrated, shruthi.setParam, tala.setParam]);

  const handleNoteChange = (noteIndex: number) => {
    setPitch(p => ({ ...p, noteIndex }));
  };

  const handleCentsChange = (cents: number) => {
    setPitch(p => ({ ...p, cents }));
  };

  const handlePlayStop = useCallback(async () => {
    if (isPlaying) {
      shruthi.stop();
      tala.stop();
      setIsPlaying(false);
    } else {
      // Save to history when starting playback
      saveHistoryEntry(pitch, firstString);
      await Promise.all([shruthi.start(), tala.start()]);
      setIsPlaying(true);
    }
  }, [isPlaying, shruthi, tala, pitch, firstString]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayStop]);

  const isLoading = shruthi.isLoading || tala.isLoading;
  const error = shruthi.error || tala.error;

  if (!isHydrated) {
    return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {/* The header carries the product name, so the page's own heading is for screen readers. */}
      <PageTitle className="sr-only">Tanpura and tala</PageTitle>

      <Card>
        <CardContent className="space-y-4 pt-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive p-3 text-destructive text-sm"
            >
              {error}
            </p>
          )}

          <PitchInput
            noteIndex={pitch.noteIndex}
            cents={pitch.cents}
            onNoteChange={handleNoteChange}
            onCentsChange={handleCentsChange}
          />

          <Button
            onClick={handlePlayStop}
            pending={isLoading}
            pendingLabel="Loading…"
            size="wide"
            variant={isPlaying ? 'destructive' : 'primary'}
          >
            {isPlaying ? (
              <>
                <Square className="h-4 w-4 fill-current" aria-hidden />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Play
              </>
            )}
          </Button>
          <p className="hidden text-center text-muted-foreground text-xs md:block">
            Space bar plays and stops.
          </p>
        </CardContent>
      </Card>

      <TanpuraControls
        noteIndex={pitch.noteIndex}
        cents={pitch.cents}
        isPlaying={isPlaying}
        setParam={shruthi.setParam}
        setEngine={shruthi.setEngine}
        currentEngine={shruthi.currentEngine}
      />

      <TalaControls
        noteIndex={pitch.noteIndex}
        cents={pitch.cents}
        isPlaying={isPlaying}
        currentBeat={tala.currentBeat}
        setParam={tala.setParam}
        firstString={firstString}
      />
    </div>
  );
}

import { Button, Card, EmptyState, PageTitle } from '@rasika/ui';
import { Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

export function meta() {
  return [
    { title: 'Practice History - Talapettige' },
    {
      name: 'description',
      content: 'Your practice session history',
    },
  ];
}

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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HISTORY_STORAGE_KEY = 'talapettige-history';
const PITCH_STORAGE_KEY = 'talapettige-pitch';
const TALA_STORAGE_KEY = 'talapettige-tala-settings';
const TANPURA_STORAGE_KEY = 'talapettige-settings';

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return [];
}

function clearHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
}

function loadSettingsFromEntry(entry: HistoryEntry) {
  if (typeof window === 'undefined') return;

  try {
    // Update pitch settings
    const pitchSettings = {
      noteIndex: entry.pitch.noteIndex,
      cents: entry.pitch.cents,
    };
    localStorage.setItem(PITCH_STORAGE_KEY, JSON.stringify(pitchSettings));

    // Update tala settings (merge with existing to preserve other settings)
    const existingTala = localStorage.getItem(TALA_STORAGE_KEY);
    const talaSettings = existingTala ? JSON.parse(existingTala) : {};
    talaSettings.tala = entry.tala.name;
    talaSettings.jati = entry.tala.jati;
    talaSettings.nadai = entry.tala.nadai;
    talaSettings.bpm = entry.tala.bpm;
    localStorage.setItem(TALA_STORAGE_KEY, JSON.stringify(talaSettings));

    // Update tanpura settings (merge with existing to preserve other settings)
    const existingTanpura = localStorage.getItem(TANPURA_STORAGE_KEY);
    const tanpuraSettings = existingTanpura ? JSON.parse(existingTanpura) : {};
    tanpuraSettings.firstString = entry.tanpura.firstString;
    tanpuraSettings.cpm = entry.tanpura.cpm;
    localStorage.setItem(TANPURA_STORAGE_KEY, JSON.stringify(tanpuraSettings));
  } catch {
    // Ignore errors
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function History() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(loadHistory());
    setIsHydrated(true);
  }, []);

  const handleClearHistory = () => {
    if (confirm('Clear all practice history?')) {
      clearHistory();
      setHistory([]);
    }
  };

  const handleLoadEntry = (entry: HistoryEntry) => {
    loadSettingsFromEntry(entry);
    navigate('/');
  };

  if (!isHydrated) {
    return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <PageTitle>Practice history</PageTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearHistory}
          disabled={history.length === 0}
          aria-label="Clear history"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {history.length === 0 ? (
        <EmptyState title="No practice sessions yet">
          Each time you press Play, the pitch, tala and shruthi are saved here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {history.map(entry => (
            <li key={entry.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {entry.pitch.noteName}
                    {entry.pitch.cents !== 0 && (
                      <span className="text-muted-foreground text-sm">
                        {' '}
                        ({entry.pitch.cents > 0 ? '+' : ''}
                        {entry.pitch.cents}¢)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.timestamp)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleLoadEntry(entry)}
                      aria-label="Use these settings"
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-muted-foreground text-sm">
                  <div>
                    <dt className="inline font-medium text-foreground">Tala:</dt>{' '}
                    <dd className="inline">
                      {entry.tala.name} ({entry.tala.jati})
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Tempo:</dt>{' '}
                    <dd className="inline">{entry.tala.bpm} apm</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Nadai:</dt>{' '}
                    <dd className="inline">{entry.tala.nadai}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">String:</dt>{' '}
                    <dd className="inline">{entry.tanpura.firstString}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

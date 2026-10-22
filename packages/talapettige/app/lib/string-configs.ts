// Indian note ratios (just intonation)
export const INDIAN_NOTES = {
  Sa: { name: 'Sa', ratio: 1 },
  re: { name: 're', ratio: 256 / 243 }, // komal re
  Re: { name: 'Re', ratio: 9 / 8 }, // shuddha re
  ga: { name: 'ga', ratio: 32 / 27 }, // komal ga
  Ga: { name: 'Ga', ratio: 81 / 64 }, // shuddha ga
  ma: { name: 'ma', ratio: 4 / 3 }, // shuddha ma
  Ma: { name: 'Ma', ratio: 729 / 512 }, // teevra ma
  Pa: { name: 'Pa', ratio: 3 / 2 }, // Pa
  dha: { name: 'dha', ratio: 128 / 81 }, // komal dha
  Dha: { name: 'Dha', ratio: 27 / 16 }, // shuddha dha
  ni: { name: 'ni', ratio: 16 / 9 }, // komal ni
  Ni: { name: 'Ni', ratio: 243 / 128 }, // shuddha ni
} as const;

export type IndianNoteKey = keyof typeof INDIAN_NOTES;

// Order for display in select dropdown
export const INDIAN_NOTE_ORDER: IndianNoteKey[] = [
  'Pa',
  'Ma',
  'ma',
  'Ga',
  'ga',
  'Re',
  're',
  'Ni',
  'ni',
  'Dha',
  'dha',
  'Sa',
];

export const DEFAULT_FIRST_STRING: IndianNoteKey = 'Pa';

// Pause options
export const PAUSE_OPTIONS = {
  none: { name: 'None', label: 'No pause' },
  first: { name: 'After 1st', label: 'Pause after first string' },
  last: { name: 'After 4th', label: 'Pause after last string' },
  firstAndLast: { name: 'After 1st & 4th', label: 'Pause after first and last' },
} as const;

export type PauseOption = keyof typeof PAUSE_OPTIONS;

export const DEFAULT_PAUSE: PauseOption = 'none';

// Get string ratios based on first string selection
// Pattern: [first_string] + Sa + Sa + sa (low Sa)
export function getStringRatios(firstString: IndianNoteKey): [number, number, number, number] {
  const firstRatio = INDIAN_NOTES[firstString].ratio;
  return [
    firstRatio, // First string (Pa, Ma, etc.)
    1, // Sa (middle)
    1, // Sa (middle)
    0.5, // sa (lower octave Sa)
  ];
}

// Get the cycle pattern with pauses
// Returns array of string indices (0-3) or -1 for muted/pause
export function getCyclePattern(pause: PauseOption): number[] {
  switch (pause) {
    case 'none':
      return [0, 1, 2, 3]; // All 4 strings
    case 'first':
      return [0, -1, 1, 2, 3]; // Pause after first
    case 'last':
      return [0, 1, 2, 3, -1]; // Pause after last
    case 'firstAndLast':
      return [0, -1, 1, 2, 3, -1]; // Pause after first and last
    default:
      return [0, 1, 2, 3];
  }
}

// Western note names for pitch display
export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

// Convert note index and cents to Hz
export function noteToHz(noteIndex: number, cents = 0, baseOctave = 3): number {
  const semitonesFromA4 = noteIndex - 9 + (baseOctave - 4) * 12;
  const hz = 440 * 2 ** ((semitonesFromA4 + cents / 100) / 12);
  return hz;
}

export function formatHz(hz: number): string {
  return hz.toFixed(1);
}

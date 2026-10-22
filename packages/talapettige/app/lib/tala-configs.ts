// Jatis (Laghu lengths)
export const JATIS = {
  tisra: { name: 'Tisra', count: 3 },
  chatusra: { name: 'Chatusra', count: 4 },
  khanda: { name: 'Khanda', count: 5 },
  misra: { name: 'Misra', count: 7 },
  sankeerna: { name: 'Sankeerna', count: 9 },
} as const;

export type JatiKey = keyof typeof JATIS;

// Nadais (subdivisions per akshara) - includes single/double options for beginners
export const NADAIS = {
  single: { name: 'Single', count: 1 },
  double: { name: 'Double', count: 2 },
  tisra: { name: 'Tisra', count: 3 },
  chatusra: { name: 'Chatusra', count: 4 },
  khanda: { name: 'Khanda', count: 5 },
  misra: { name: 'Misra', count: 7 },
  sankeerna: { name: 'Sankeerna', count: 9 },
} as const;

export type NadaiKey = keyof typeof NADAIS;

// Anga types
type Anga = 'I' | 'O' | 'U'; // Laghu, Dhrutham, Anudhrutham

// Tala pattern definitions
export const TALA_PATTERNS = {
  eka: { name: 'Eka', pattern: ['I'] as Anga[], hasJati: true },
  rupaka: { name: 'Rupaka', pattern: ['O', 'I'] as Anga[], hasJati: true },
  jhampa: { name: 'Jhampa', pattern: ['I', 'U', 'O'] as Anga[], hasJati: true },
  triputa: { name: 'Triputa', pattern: ['I', 'O', 'O'] as Anga[], hasJati: true },
  matya: { name: 'Matya', pattern: ['I', 'O', 'I'] as Anga[], hasJati: true },
  ata: { name: 'Ata', pattern: ['I', 'I', 'O', 'O'] as Anga[], hasJati: true },
  dhruva: { name: 'Dhruva', pattern: ['I', 'O', 'I', 'I'] as Anga[], hasJati: true },
  misraChapu: { name: 'Misra Chapu', fixedPattern: [3, 2, 2], hasJati: false },
  khandaChapu: { name: 'Khanda Chapu', fixedPattern: [2, 3], hasJati: false },
} as const;

export type TalaKey = keyof typeof TALA_PATTERNS;

export const DEFAULT_TALA: TalaKey = 'triputa';
export const DEFAULT_JATI: JatiKey = 'chatusra';
export const DEFAULT_NADAI: NadaiKey = 'chatusra';

// Get akshara count for an anga based on jati
function getAngaCount(anga: Anga, jatiCount: number): number {
  switch (anga) {
    case 'I': // Laghu - variable based on jati
      return jatiCount;
    case 'O': // Dhrutham - always 2
      return 2;
    case 'U': // Anudhrutham - always 1
      return 1;
  }
}

// Generate akshara pattern with beat types
// Returns array of { isSam: boolean, angaIndex: number } for each akshara
export interface Akshara {
  isSam: boolean; // First beat of each anga (strong beat)
  angaIndex: number; // Which anga this akshara belongs to
  muted?: boolean; // Whether this beat is muted (user can click to toggle)
}

// Get anga boundaries (indices where a new anga starts)
export function getAngaBoundaries(tala: TalaKey, jati: JatiKey): number[] {
  const aksharas = getTalaAksharas(tala, jati);
  const boundaries: number[] = [0]; // First anga starts at 0

  let currentAnga = 0;
  aksharas.forEach((akshara, index) => {
    if (akshara.angaIndex !== currentAnga && index > 0) {
      boundaries.push(index);
      currentAnga = akshara.angaIndex;
    }
  });

  return boundaries;
}

export function getTalaAksharas(tala: TalaKey, jati: JatiKey): Akshara[] {
  const talaConfig = TALA_PATTERNS[tala];
  const jatiCount = JATIS[jati].count;

  const aksharas: Akshara[] = [];

  if ('fixedPattern' in talaConfig) {
    // Chapu talas have fixed patterns (array of counts per anga)
    talaConfig.fixedPattern.forEach((count, angaIndex) => {
      for (let i = 0; i < count; i++) {
        aksharas.push({
          isSam: i === 0, // First akshara of each anga is Sam
          angaIndex,
        });
      }
    });
  } else {
    // Standard talas with Laghu/Dhrutham/Anudhrutham
    talaConfig.pattern.forEach((anga, angaIndex) => {
      const count = getAngaCount(anga, jatiCount);
      for (let i = 0; i < count; i++) {
        aksharas.push({
          isSam: i === 0, // First akshara of each anga is Sam
          angaIndex,
        });
      }
    });
  }

  return aksharas;
}

// Get total akshara count for a tala
export function getTalaLength(tala: TalaKey, jati: JatiKey): number {
  return getTalaAksharas(tala, jati).length;
}

// Get display string for tala pattern
export function getTalaPatternDisplay(tala: TalaKey): string {
  const talaConfig = TALA_PATTERNS[tala];

  if ('fixedPattern' in talaConfig) {
    return talaConfig.fixedPattern.join('+');
  }
  return talaConfig.pattern.join(' ');
}

// Get display name with jati (e.g., "Triputa (Chatusra)")
export function getTalaDisplayName(tala: TalaKey, jati: JatiKey): string {
  const talaConfig = TALA_PATTERNS[tala];

  if (!talaConfig.hasJati) {
    return talaConfig.name;
  }

  return `${talaConfig.name} (${JATIS[jati].name})`;
}

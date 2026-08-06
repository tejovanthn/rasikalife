// The 72-melakarta system, reduced to its generating rules. A melakarta's number
// fixes its scale: the chakra (1-12) fixes the lower tetrachord R and G, the
// position within the chakra (1-6) fixes the upper tetrachord M, D and N.
//
// This is the single source of truth for the chakra widget on /carnatic/ragas and
// for the generator that resolves the 72 canonical records in the database, so the
// two can never disagree about which scale belongs to which number.

// The 12 chakras, in order. Chakras 7-12 are the "M2" half: they repeat the
// chakras 1-6 R/G pairs with the second form of Madhyama.
export const CHAKRA_NAMES = [
  'Indu',
  'Netra',
  'Agni',
  'Veda',
  'Bana',
  'Rutu',
  'Rishi',
  'Vasu',
  'Brahma',
  'Disi',
  'Rudra',
  'Aditya',
] as const;

export type ChakraName = (typeof CHAKRA_NAMES)[number];

// The R/G pair each chakra fixes, in the ITRANS form the database stores.
const CHAKRA_RG: ReadonlyArray<readonly [string, string]> = [
  ['R1', 'G1'],
  ['R1', 'G2'],
  ['R1', 'G3'],
  ['R2', 'G2'],
  ['R2', 'G3'],
  ['R3', 'G3'],
  ['R1', 'G1'],
  ['R1', 'G2'],
  ['R1', 'G3'],
  ['R2', 'G2'],
  ['R2', 'G3'],
  ['R3', 'G3'],
];

// The D/N pair each of the six positions fixes.
const POSITION_DN: ReadonlyArray<readonly [string, string]> = [
  ['D1', 'N1'],
  ['D1', 'N2'],
  ['D1', 'N3'],
  ['D2', 'N2'],
  ['D2', 'N3'],
  ['D3', 'N3'],
];

function assertMelaNumber(melaNumber: number): void {
  if (!Number.isInteger(melaNumber) || melaNumber < 1 || melaNumber > 72) {
    throw new RangeError(`melaNumber ${melaNumber} is outside 1-72`);
  }
}

/** The chakra (1-12) a melakarta belongs to. */
export function chakraOfMela(melaNumber: number): number {
  assertMelaNumber(melaNumber);
  return Math.floor((melaNumber - 1) / 6) + 1;
}

/** The position (1-6) a melakarta holds within its chakra. */
export function positionOfMela(melaNumber: number): number {
  assertMelaNumber(melaNumber);
  return ((melaNumber - 1) % 6) + 1;
}

/** The chakra name a melakarta belongs to, e.g. 'Indu' for 1 and 7's chakra. */
export function chakraNameOfMela(melaNumber: number): ChakraName {
  return CHAKRA_NAMES[chakraOfMela(melaNumber) - 1];
}

/**
 * The canonical arohanam of a melakarta, in the ITRANS form the database stores
 * (e.g. Mechakalyani, 65: `S R2 G3 M2 P D2 N3 S`). Madhyama comes from the half
 * (melas 1-36 take M1, 37-72 M2); the position fixes only the upper D/N.
 */
export function melakartaScale(melaNumber: number): string {
  const [r, g] = CHAKRA_RG[chakraOfMela(melaNumber) - 1];
  const [d, n] = POSITION_DN[positionOfMela(melaNumber) - 1];
  const m = melaNumber <= 36 ? 'M1' : 'M2';
  return `S ${r} ${g} ${m} P ${d} ${n} S`;
}

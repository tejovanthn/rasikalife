/**
 * The kinds of item a setlist can hold. Here, with no imports, rather than in `entity.ts`:
 * `client.ts` re-exported it from the entity, and that one value pulled ElectroDB and the AWS
 * SDK (~106 kB gzipped) into the browser bundle of every route that imported it.
 */
export const COMPOSITION_TYPES = [
  'varnam',
  'kriti',
  'rtp',
  'thillana',
  'javali',
  'padam',
  'viruttam',
  'thukkada',
  'slokam',
  'tani',
  'other',
] as const;

export type CompositionType = (typeof COMPOSITION_TYPES)[number];

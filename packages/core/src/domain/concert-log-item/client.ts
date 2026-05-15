export type { ConcertLogItem, CompositionType } from './entity';
export { COMPOSITION_TYPES } from './entity';

export const REJECT_REASONS = [
  'not_a_composition',
  'duplicate_of_earlier_item',
  'insufficient_info',
  'other',
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export const DISPUTE_FIELDS = ['ragaId', 'talaId', 'compositionType'] as const;
export type DisputeField = (typeof DISPUTE_FIELDS)[number];

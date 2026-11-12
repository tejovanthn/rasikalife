export const CHANGE_ENTITY_TYPE = {
  COMPOSITION: 'composition',
  RAGA: 'raga',
  TALA: 'tala',
  ARTIST: 'artist',
  VENUE_QR: 'venueQr',
  ORGANISER: 'organiser',
  VENUE: 'venue',
  USER: 'user',
} as const;

export type ChangeEntityType = (typeof CHANGE_ENTITY_TYPE)[keyof typeof CHANGE_ENTITY_TYPE];

export type ChangeAction = 'create' | 'update' | 'delete' | 'rollback' | 'view';

export interface ChangeHistoryInput {
  entityType: ChangeEntityType;
  entityId: string;
  userId: string;
  action: ChangeAction;
  diff: Record<string, unknown>;
  comment?: string;
}

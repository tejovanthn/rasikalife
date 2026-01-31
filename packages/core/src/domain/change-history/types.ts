export const CHANGE_ENTITY_TYPE = {
  COMPOSITION: 'composition',
  RAGA: 'raga',
  TALA: 'tala',
  ARTIST: 'artist',
} as const;

export type ChangeEntityType = (typeof CHANGE_ENTITY_TYPE)[keyof typeof CHANGE_ENTITY_TYPE];

export type ChangeAction = 'create' | 'update' | 'delete' | 'rollback';

export interface ChangeHistoryInput {
  entityType: ChangeEntityType;
  entityId: string;
  userId: string;
  action: ChangeAction;
  diff: Record<string, unknown>;
  comment?: string;
}

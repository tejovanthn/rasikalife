/**
 * Edit system types - safe for browser import
 * These types don't import any Node.js dependencies (no imports from entity.ts)
 */

export const EditStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;

export type EditStatus = (typeof EditStatus)[keyof typeof EditStatus];

export const EditOperation = {
  UPDATE: 'update',
  DELETE: 'delete',
  MERGE: 'merge',
} as const;

export type EditOperation = (typeof EditOperation)[keyof typeof EditOperation];

export const EditEntityTypes = {
  COMPOSITION: 'composition',
  ARTIST: 'artist',
  RAGA: 'raga',
  TALA: 'tala',
  EVENT: 'event',
  VENUE: 'venue',
  ORGANISER: 'organiser',
  FESTIVAL: 'festival',
} as const;

export type EditEntityType = (typeof EditEntityTypes)[keyof typeof EditEntityTypes];

/**
 * Edit entity interface - matches the ElectroDB entity shape
 * but doesn't require importing the entity itself
 */
export interface Edit {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  status: EditStatus;
  operation?: EditOperation;
  proposedValues: Record<string, unknown>;
  userNote?: string;
  moderatorId?: string;
  moderatorNote?: string;
  submittedAt?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type EditInput = Pick<
  Edit,
  'entityType' | 'entityId' | 'userId' | 'proposedValues' | 'userNote' | 'operation'
>;

export type EditFilters = {
  status?: Edit['status'];
  entityType?: EditEntityType;
  userId?: string;
  limit?: number;
  nextToken?: string;
};

export type PendingEditFilters = {
  entityType?: EditEntityType;
  limit?: number;
  nextToken?: string;
};

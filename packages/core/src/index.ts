// Domain exports
export * as Artist from './domain/artist';
export * as Composition from './domain/composition';
export * as Raga from './domain/raga';
export * as Tala from './domain/tala';
export * as CompositionRaga from './domain/composition_raga';
export * as CompositionTala from './domain/composition_tala';
export * as Content from './domain/content';
export * as Search from './domain/search';
export * as User from './domain/user';
export * as ChangeHistory from './domain/change-history';
export * as Event from './domain/event';
export * as EventArtist from './domain/event-artist';
export * as Festival from './domain/festival';
export * as Venue from './domain/venue';
export * as Organiser from './domain/organiser';

// Edit types (browser-safe exports)
export {
  EditStatus,
  EditEntityTypes,
  EditOperation,
  type EditEntityType,
  type Edit,
  type EditOperation as EditOperationType,
} from './domain/edit/types';

// Edit service functions (server-side only)
export {
  createDraft,
  submitEdit,
  withdrawEdit,
  approveEdit,
  rejectEdit,
  getEditById,
  getPendingEdits,
  getUserEdits,
  getEntityEdits,
  updateDraft,
  getActiveEditForEntity,
  requestDeletion,
} from './domain/edit/service';

// Auth exports
export * as Auth from './auth';

// Database exports
export { RasikaLifeService } from './shared/electrodb';

// Entity type exports
export * from './types/entities';

// Utility exports
export * from './types';

// Error exports
export * from './constants';

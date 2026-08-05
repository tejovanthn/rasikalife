// Domain exports
export * as Artist from './domain/artist';
export * as Award from './domain/award';
export * as ArtistAffiliation from './domain/artist-affiliation';
export * as ArtistAward from './domain/artist-award';
export * as ArtistMembership from './domain/artist-membership';
export * as ArtistClaim from './domain/artist-claim';
export * as ArtistMedia from './domain/artist-media';
export * as ArtistPhoto from './domain/artist-photo';
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
export * as SocialPost from './domain/social-post';
export * as Rsvp from './domain/rsvp';
export * as ConcertLog from './domain/concert-log';
export * as ConcertLogItem from './domain/concert-log-item';
export * as EventSetlist from './domain/event-setlist';
export * as ClassInstitution from './domain/class-institution';
export * as ClassTeacher from './domain/class-teacher';
export * as ClassProgram from './domain/class-program';
export * as ClassLearner from './domain/class-learner';
export * as ClassLearnerAccess from './domain/class-learner-access';
export * as ClassEnrollment from './domain/class-enrollment';
export * as ClassPack from './domain/class-pack';
export * as ClassSession from './domain/class-session';
export * as ClassInvite from './domain/class-invite';
export * as Email from './email';
export * as Image from './domain/image/s3';
// Its own namespace rather than merged into `Image`, so a call site cannot reach for the public
// uploader by habit when it meant the private one. The two differ in bucket, in what they
// return, and in whether the result is safe to store.
export * as PrivateImage from './domain/image/private-s3';
export * as AdminData from './admin/bulk-data';
export * as Enrichment from './domain/enrichment';

// Social link types (browser-safe exports)
export { SocialPlatform, SOCIAL_PLATFORM_LABELS, type SocialLink } from './domain/social-link';

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
  requestMerge,
} from './domain/edit/service';

// Auth exports
export * as Auth from './auth';

// Database exports
export { RasikaLifeService } from './shared/electrodb';

// Entity type exports
export * from './types/entities';

// Utility exports
export * from './types';

// Transliteration utilities
export * as Transliteration from './utils/transliteration';

// Error exports
export * from './constants';

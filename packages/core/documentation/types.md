// ============== Enums ==============

export enum EntityType {
  USER = 'user',
  ARTIST = 'artist',
  COMPOSITION = 'composition',
  RAGA = 'raga',
  TALA = 'tala',
  EVENT = 'event',
  VENUE = 'venue',
  THREAD = 'thread',
  REPLY = 'reply',
  UPDATE = 'update',
  COLLECTION = 'collection',
  PERFORMANCE = 'performance',
  RECORDING = 'recording'
}

export enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani'
}

export enum UserRole {
  USER = 'user',
  ARTIST = 'artist',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  CURATOR = 'curator'
}

export enum ArtistType {
  VOCALIST = 'vocalist',
  INSTRUMENTALIST = 'instrumentalist',
  DANCER = 'dancer',
  COMPOSER = 'composer',
  GROUP = 'group'
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export enum AttributionType {
  PRIMARY = 'primary',
  DISPUTED = 'disputed',
  ALTERNATIVE = 'alternative',
  TRADITIONAL = 'traditional'
}

export enum AttributionConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum PermissionSource {
  EXPLICIT = 'explicit',
  KARMA = 'karma',
  COMBINED = 'combined'
}

export enum AccessLevel {
  VIEW = 'view',
  EDIT = 'edit',
  ADMIN = 'admin',
  FULL = 'full',
  EVENTS = 'events',
  PROFILE = 'profile'
}

export enum EventType {
  CONCERT = 'concert',
  LECTURE = 'lecture',
  WORKSHOP = 'workshop',
  COMPETITION = 'competition',
  FESTIVAL = 'festival'
}

export enum EventStatus {
  SCHEDULED = 'scheduled',
  CANCELED = 'canceled',
  POSTPONED = 'postponed',
  COMPLETED = 'completed'
}

export enum SubscriptionPlan {
  FREE = 'free',
  PREMIUM = 'premium',
  PATRON = 'patron'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  PAST_DUE = 'pastDue'
}

export enum TransactionType {
  SUBSCRIPTION = 'subscription',
  TICKET_PURCHASE = 'ticket_purchase',
  PATRONAGE = 'patronage',
  REFUND = 'refund',
  PLATFORM_FEE = 'platform_fee'
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ModerationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum ApprovalChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export enum VoteType {
  UP = 'up',
  DOWN = 'down'
}

export enum BadgeCategory {
  CONTRIBUTION = 'contribution',
  ACHIEVEMENT = 'achievement',
  SPECIAL = 'special'
}

export enum BadgeLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold'
}

export enum CollectionType {
  PERSONAL = 'personal',
  CURATED = 'curated',
  FEATURED = 'featured'
}

export enum EducationalResourceType {
  ARTICLE = 'article',
  VIDEO = 'video',
  TUTORIAL = 'tutorial',
  GLOSSARY = 'glossary'
}

export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

// ============== Common Interfaces ==============

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialLinks {
  website?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  spotify?: string;
  appleMusic?: string;
  other?: Record<string, string>;
}

export interface Location {
  city?: string;
  state?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Contact {
  email?: string;
  phone?: string;
  person?: string;
}

// ============== User & Authentication ==============

export interface UserPrivacySettings {
  showEmail: boolean;
  showActivity: boolean;
  showFollowing: boolean;
  allowMessages: boolean;
}

export interface UserNotificationSettings {
  email: {
    newFollower: boolean;
    upcomingEvents: boolean;
    artistUpdates: boolean;
    threadReplies: boolean;
  };
  push: {
    newFollower: boolean;
    upcomingEvents: boolean;
    artistUpdates: boolean;
    threadReplies: boolean;
  };
}

export interface UserPreferences {
  defaultLanguage: string;
  preferredTraditions: Tradition[];
  favoriteInstruments: string[];
  favoriteRagas: string[];
  themeName: 'light' | 'dark' | 'system';
}

export interface User extends BaseEntity {
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImage?: string;
  roles: UserRole[];
  karma: number;
  isVerified: boolean;
  preferences: UserPreferences;
  notificationSettings: UserNotificationSettings;
  privacySettings: UserPrivacySettings;
  lastLoginAt?: string;
}

export interface UserSubscription extends BaseEntity {
  userId: string;
  planType: SubscriptionPlan;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  paymentMethod?: string;
}

// ============== Karma System ==============

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  level?: BadgeLevel;
  iconUrl?: string;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  badge?: Badge; // Populated on fetch
  awardedAt: string;
}

export interface KarmaHistory {
  userId: string;
  timestamp: string;
  value: number;
  changeAmount: number;
  reason: string;
  sourceId?: string;
  sourceType?: EntityType;
}

export interface KarmaPermissionRule {
  entityType: EntityType;
  action: string;
  minKarma: number;
  description: string;
  autoGranted: boolean;
  scope: 'all' | 'community' | 'unverified';
}

export interface UserKarmaPermission {
  userId: string;
  entityType: EntityType;
  action: string;
  grantedAt: string;
  source: 'karma' | 'explicit';
  scope?: string;
}

// ============== Artist & Management ==============

export interface Artist extends BaseEntity {
  name: string;
  bio?: string;
  artistType: ArtistType;
  instruments: string[];
  gurus?: string[];
  lineage?: string;
  formationYear?: number;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  viewCount: number;
  favoriteCount: number;
  popularityScore: number;
  location?: Location;
  profileImage?: string;
  socialLinks?: SocialLinks;
  website?: string;
  privacySettings?: {
    showContact: boolean;
    showEvents: boolean;
  };
  traditions: Tradition[];
  isCommunityManaged?: boolean;
  protectionLevel?: 'low' | 'medium' | 'high';
}

export interface ArtistManagement {
  artistId: string;
  userId: string;
  permissions: {
    editProfile: boolean;
    manageBiography: boolean;
    addPerformances: boolean;
    manageEvents: boolean;
    approveChanges: boolean;
    addManagers: boolean;
  };
  permissionSource: PermissionSource;
  karmaAtGrant?: number;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  status: 'active' | 'pending' | 'revoked';
}

export interface ArtistGroupMember {
  groupArtistId: string;
  memberArtistId: string;
  role?: string;
  joinedDate?: string;
  leftDate?: string;
  isCurrentMember: boolean;
}

export interface CommunityManagedArtist {
  artistId: string;
  minKarmaToEdit: number;
  minKarmaToApprove: number;
  protectionLevel: 'low' | 'medium' | 'high';
}

// ============== Compositions ==============

export interface Composition extends BaseEntity {
  version: string;
  title: string;
  canonicalTitle?: string;
  alternativeTitles?: string[];
  language: string;
  verses?: string;
  meaning?: string;
  notation?: string;
  audioSamples?: string[];
  videoSamples?: string[];
  addedBy: string;
  editedBy: string[];
  viewCount: number;
  favoriteCount: number;
  popularityScore: number;
  sourceAttribution?: string;
  tradition: Tradition;
  isLatest: boolean;
}

export interface CompositionAttribution {
  compositionId: string;
  artistId: string;
  attributionType: AttributionType;
  confidence: AttributionConfidence;
  source?: string;
  notes?: string;
  addedBy: string;
  verifiedBy?: string[];
  createdAt: string;
}

// ============== Raga & Tala ==============

export interface Raga extends BaseEntity {
  version: string;
  name: string;
  alternativeNames?: string[];
  melakarta?: number;
  janaka?: string;
  arohanam?: string;
  avarohanam?: string;
  notes?: string;
  characteristicPhrases?: string[];
  mood?: string[];
  timeOfDay?: string;
  history?: string;
  famousCompositions?: string[];
  viewCount: number;
  editedBy: string[];
  tradition: Tradition;
  isLatest: boolean;
}

export interface Tala extends BaseEntity {
  version: string;
  name: string;
  alternativeNames?: string[];
  type?: string;
  aksharas: number;
  structure?: string;
  notation?: string;
  examples?: string[];
  viewCount: number;
  editedBy: string[];
  tradition: Tradition;
  isLatest: boolean;
}

export interface NameVariant {
  variant: string;
  canonicalId: string;
  canonicalName: string;
  type: 'raga' | 'tala' | 'composer' | 'artist';
  addedBy: string;
  createdAt: string;
}

// ============== Performance & Recording ==============

export interface Performance extends BaseEntity {
  eventId: string;
  startTime: string;
  endTime: string;
  orderInEvent: number;
}

export interface PerformanceComposition {
  performanceId: string;
  compositionId: string;
  orderInPerformance: number;
  ragaId?: string;
  talaId?: string;
  duration?: number;
  notes?: string;
}

export interface PerformanceArtist {
  performanceId: string;
  artistId: string;
  role: 'main_artist' | 'accompanist' | 'conductor';
  instrument?: string;
  isPrimaryArtist: boolean;
}

export interface Recording extends BaseEntity {
  performanceId?: string;
  url: string;
  type: 'audio' | 'video';
  duration?: number;
  quality?: string;
  source?: string;
  metadata?: Record<string, any>;
}

// ============== Events & Venues ==============

export interface Event extends BaseEntity {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: Location;
  venue?: string;
  venueId?: string;
  eventType: EventType;
  ticketInfo?: {
    isPaid: boolean;
    price?: number;
    currency?: string;
    ticketUrl?: string;
  };
  organizer?: string;
  organizerId?: string;
  isVerified: boolean;
  isFeatured: boolean;
  image?: string;
  status: EventStatus;
  isVirtual: boolean;
  streamingUrl?: string;
  seriesId?: string;
  recurrenceRule?: string;
}

export interface EventSeries extends BaseEntity {
  name: string;
  description?: string;
  organizer?: string;
  recurrenceRule?: string;
  startDate: string;
  endDate: string;
  venues: string[];
  eventCount: number;
}

export interface EventParticipant {
  eventId: string;
  artistId: string;
  role?: string;
  order?: number;
  isConfirmed: boolean;
}

export interface Venue extends BaseEntity {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  capacity?: number;
  facilities?: string[];
  contact?: Contact;
  website?: string;
  images?: string[];
  isVerified: boolean;
  partnershipStatus: 'none' | 'basic' | 'premium' | 'exclusive';
  virtualCapabilities: boolean;
}

// ============== Social & Community ==============

export interface Update extends BaseEntity {
  content: string;
  artistId: string;
  userId?: string;
  media?: string[];
  tags?: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  source: 'web' | 'whatsapp';
}

export interface Thread extends BaseEntity {
  title: string;
  content: string;
  authorId: string;
  category: string;
  tags: string[];
  status: 'open' | 'closed' | 'resolved';
  viewCount: number;
  replyCount: number;
  lastReplyAt?: string;
  lastReplyId?: string;
  isSticky: boolean;
  isPinned: boolean;
}

export interface Reply extends BaseEntity {
  threadId: string;
  content: string;
  authorId: string;
  parentReplyId?: string;
  isAccepted: boolean;
  voteCount: number;
}

export interface Collection extends BaseEntity {
  title: string;
  description?: string;
  createdBy: string;
  isPublic: boolean;
  itemCount: number;
  thumbnailUrl?: string;
  collectionType: CollectionType;
}

export interface CollectionItem {
  collectionId: string;
  itemType: EntityType;
  itemId: string;
  order: number;
  addedAt: string;
  addedBy: string;
  notes?: string;
}

// ============== Moderation ==============

export interface ApprovalRequest extends BaseEntity {
  entityType: EntityType;
  entityId: string;
  changeType: ApprovalChangeType;
  proposedChanges: Record<string, any>;
  requestedBy: string;
  requestedAt: string;
  status: ModerationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
}

export interface ModerationItem {
  status: ModerationStatus;
  itemType: EntityType;
  itemId: string;
  timestamp: string;
  reportCount: number;
  reportReason?: string;
  assignedTo?: string;
  priority: ModerationPriority;
}

export interface FlaggedContent {
  itemType: EntityType;
  itemId: string;
  userId: string;
  timestamp: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface ModerationAction {
  itemType: EntityType;
  itemId: string;
  timestamp: string;
  actionType: 'approve' | 'reject' | 'delete' | 'warn';
  moderatorId: string;
  reason?: string;
  details?: string;
}

// ============== Interactions ==============

export interface Favorite {
  userId: string;
  itemId: string;
  itemType: EntityType;
  favoriteAt: string;
}

export interface Vote {
  userId: string;
  itemId: string;
  itemType: EntityType;
  voteType: VoteType;
  votedAt: string;
}

export interface View {
  type: EntityType;
  itemId: string;
  shard: number;
  date: string;
  count: number;
}

export interface UserHistory {
  userId: string;
  itemType: EntityType;
  itemId: string;
  timestamp: string;
  duration?: number;
  context?: string;
}

export interface UserFeedItem {
  userId: string;
  updateId: string;
  artistId: string;
  timestamp: string;
  preview?: string;
  type: 'update' | 'event' | 'composition';
}

export interface ThreadSubscription {
  userId: string;
  threadId: string;
  subscribedAt: string;
}

// ============== WhatsApp Integration ==============

export interface WhatsAppUser {
  phoneNumber: string;
  userId?: string;
  artistId?: string;
  isVerified: boolean;
  verificationCode?: string;
  lastActive: string;
  lastMessageSent?: string;
  conversationState?: 'idle' | 'create_event' | 'verify_artist';
}

export interface WhatsAppMessage {
  phoneNumber: string;
  messageId: string;
  timestamp: string;
  content: string;
  media?: string[];
  processedStatus: 'pending' | 'processed' | 'failed';
  entityExtraction?: {
    eventDetails?: Partial<Event>;
    artistDetails?: Partial<Artist>;
    ragas?: string[];
    compositions?: string[];
  };
}

export interface MessageTemplate {
  id: string;
  templateType: 'verification' | 'event_confirmation' | 'event_reminder';
  content: string;
  variables: string[];
  description?: string;
  useCase?: string;
}

export interface ConversationFlow {
  id: string;
  steps: {
    [stepId: string]: {
      prompt: string;
      responseType: 'text' | 'yesno' | 'date' | 'time' | 'location';
      nextSteps: {
        [response: string]: string;
      };
      validations?: string[];
    };
  };
}

export interface ConversationState {
  phoneNumber: string;
  timestamp: string;
  flowId: string;
  currentStep: string;
  collectedData: Record<string, any>;
  expiresAt: string;
}

// ============== Commerce ==============

export interface Ticket extends BaseEntity {
  eventId: string;
  userId: string;
  status: 'reserved' | 'purchased' | 'canceled' | 'used' | 'expired';
  purchasedAt: string;
  price: number;
  currency: string;
  quantity: number;
  ticketType: string;
  barcode?: string;
  isCheckedIn: boolean;
  checkedInAt?: string;
  refundStatus?: 'none' | 'requested' | 'approved' | 'processed' | 'denied';
}

export interface PatronTier {
  artistId: string;
  tierId: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  benefits: string[];
  maxPatrons?: number;
  currentPatrons: number;
}

export interface Patronage {
  userId: string;
  artistId: string;
  tierId: string;
  startDate: string;
  nextBillingDate: string;
  status: 'active' | 'canceled' | 'pastDue';
}

export interface PatronBenefit {
  userId: string;
  artistId: string;
  benefitId: string;
  benefitName: string;
  usedAt?: string;
  expiresAt?: string;
  status: 'available' | 'used' | 'expired';
  details?: Record<string, any>;
}

export interface Transaction extends BaseEntity {
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  completedAt?: string;
  details?: Record<string, any>;
  relatedEntityId?: string;
  relatedEntityType?: EntityType;
  paymentMethod?: string;
  paymentGatewayRef?: string;
}

export interface TransactionReceipt {
  transactionId: string;
  userId: string;
  receiptUrl?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  taxAmount: number;
  totalAmount: number;
  currency: string;
}

// ============== Search & Discovery ==============

export interface SearchPreference {
  userId: string;
  preferredFilters: Record<string, any>;
  preferredSorting?: string;
  savedParams: Record<string, any>;
}

export interface SearchHistory {
  userId: string;
  timestamp: string;
  query: string;
  filters: Record<string, any>;
  resultsCount: number;
  clickedResults: string[];
}

export interface SearchLog {
  query: string;
  date: string;
  count: number;
  avgResultsClicked: number;
  topResults: string[];
}

export interface SearchSuggestion {
  prefix: string;
  term: string;
  hitCount: number;
  lastQueried: string;
}

export interface UserRecommendation {
  userId: string;
  timestamp: string;
  itemType: EntityType;
  itemId: string;
  score: number;
  reason?: string;
  context?: string;
  isClicked: boolean;
}

// ============== Analytics ==============

export interface DailyMetric {
  name: string;
  date: string;
  value: number;
  change: number;
  details?: Record<string, any>;
}

export interface EntityMetric {
  entityType: EntityType;
  entityId: string;
  date: string;
  views: number;
  favorites: number;
  engagement: number;
  details?: Record<string, any>;
}

export interface UserSegment {
  segmentId: string;
  userId: string;
  addedAt: string;
  attributes: Record<string, any>;
}

// ============== Notifications ==============

export interface UserNotification {
  userId: string;
  notificationId: string;
  timestamp: string;
  type: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  content: string;
  relatedEntityId?: string;
  relatedEntityType?: EntityType;
  isRead: boolean;
  actionUrl?: string;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
  category: 'system' | 'social' | 'event' | 'content';
}

// ============== Educational Resources ==============

export interface EducationalResource extends BaseEntity {
  title: string;
  description: string;
  type: EducationalResourceType;
  content?: string;
  author: string;
  difficulty: Difficulty;
  targetAudience: string[];
  relatedItems: Array<{
    itemType: EntityType;
    itemId: string;
  }>;
  tags: string[];
}

// ============== Audit & Sync ==============

export interface EntityAudit {
  entityType: EntityType;
  entityId: string;
  timestamp: string;
  action: string;
  userId: string;
  changes: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UserActionAudit {
  userId: string;
  timestamp: string;
  action: string;
  entityId?: string;
  entityType?: EntityType;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ElasticSearchSync {
  entityType: EntityType;
  entityId: string;
  lastSyncedAt: string;
  status: 'pending' | 'synced' | 'failed';
  errorDetails?: string;
}
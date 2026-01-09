// ============== Enums ==============

export enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani',
}

export enum ContentCategory {
  ABOUT = 'about',
  LEGAL = 'legal',
  GENERAL = 'general',
  HELP = 'help',
  COMMUNITY = 'community',
  RESOURCE = 'resource',
}

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ContentVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
}

// Base entity interface (might be useful for future expansion)
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

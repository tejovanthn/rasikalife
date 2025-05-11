# Rasika.life Core Package Development Summary

## Project Overview
We're building a core package for **Rasika.life**, a web-based community platform for discovering, documenting, and discussing Indian classical art and music. The platform aims to address fragmentation in the classical arts ecosystem by providing a comprehensive resource for both connoisseurs and newcomers.

## Technical Stack & Architecture

### Core Technology Choices:
- **Framework**: SST.dev monorepo template
- **Database**: AWS DynamoDB with single-table design pattern
- **ID Generation**: KSUID for time-sortable unique identifiers
- **Validation**: Zod for schema validation
- **Testing**: Vitest with comprehensive test coverage
- **Language**: TypeScript with strict type checking
- **AWS SDK**: v3 for DynamoDB operations

### Key Design Decisions:
1. **Single-Table Design**: Using DynamoDB's single-table pattern for optimal performance and cost efficiency
2. **Domain-Driven Development**: Organizing code around business domains (user, artist, composition, etc.)
3. **Collocated Tests**: Unit tests placed alongside implementation files for better maintainability
4. **Versioned Content**: Wiki-style versioning for knowledge base items (compositions, ragas, talas)
5. **Access Control List (ACL)**: Granular permissions for artist profile management
6. **Community Management**: Approval workflows for community-maintained content

## Directory Structure Created

```
packages/
  core/
    package.json              # Dependencies & scripts
    tsconfig.json            # TypeScript configuration
    vitest.config.ts         # Test configuration
    
    src/
      index.ts               # Main exports
      
      constants/
        index.ts
        errorCodes.ts        # Standardized error codes
        validationMessages.ts # Validation message templates
      
      types/
        index.ts
        common.ts            # Common type definitions
      
      utils/
        index.ts
        id.ts                # KSUID-based ID generation
        dateTime.ts          # Date/time utilities
        validation.ts        # Zod schema builders
        *.test.ts           # Tests for each utility
      
      db/
        index.ts
        client.ts            # DynamoDB client setup
        operations.ts        # CRUD operations
        queryBuilder.ts      # Fluent query interface
        *.test.ts           # Database tests
      
      shared/
        singleTable.ts       # Single-table design utilities
        accessPatterns.ts    # Common data access patterns
        pagination.ts        # Pagination utilities
        search.ts           # Search functionality
        *.test.ts           # Tests for shared utilities
      
      domain/              # Domain modules (to be implemented)
        user/
        artist/
        artistManagement/
        composition/
        performance/
        recording/
        raga/
        tala/
        event/
        venue/
        forum/
        whatsapp/
        collection/
        karma/
        notification/
        payment/
    
    test/
      setup.ts              # Global test setup
      mocks/
        dynamodb.ts         # Mock DynamoDB client
        entities.ts         # Mock entities for testing
```

## Key Components Implemented

### 1. Error Handling System
- Standardized error codes following the pattern `[DOMAIN]_[ERROR_TYPE]`
- Custom `ApplicationError` class for consistent error handling
- Validation messages for Zod schemas

### 2. Type System
- Base interfaces like `BaseEntity`, `DynamoItem`, `PaginationParams`
- Enum types for `EntityType`, `Tradition`, etc.
- Generic repository interface for domain entities

### 3. Utility Functions
- **ID Generation**: Async and sync KSUID generation with prefixes
- **Date/Time**: ISO formatting, date arithmetic, sharding for hot partitions
- **Validation**: Reusable Zod schema builders with custom messages

### 4. Database Layer
- **Client**: Configured for both local and production environments
- **Operations**: Full CRUD operations with error handling
- **Query Builder**: Fluent interface for constructing complex queries
- **Pagination**: Token-based pagination with Base64 encoding

### 5. Single-Table Design Utilities
- Key formatting for entities and relationships
- Entity prefixes and secondary prefixes for organization
- Version tracking for wiki-style content
- Composite ID generation

### 6. Access Patterns
- Primary key access patterns
- Global Secondary Index (GSI) queries
- Date range queries
- Transactional operations for related items

### 7. Search & Pagination
- Basic search using DynamoDB scan (with note about future Elasticsearch)
- Relevance scoring for search results
- Standardized pagination with consistent response format

### 8. Testing Infrastructure
- Mock DynamoDB implementation supporting all operations
- Mock entities matching the project's domain models
- Global test setup with deterministic ID and date generation
- Comprehensive test coverage for all utilities

## Domain Model Overview

### Core Concept: Artist as Managed Entity
Artists are profile pages, not user accounts. Multiple users can have management rights over an artist profile with varying access levels. This supports both contemporary artists managing their own profiles and community management of historical figures like Purandaradasa.

### The Artist-Composer Duality
Artists and composers are the same entity type but can have different roles in different contexts:
- Madurai Mani Iyer: Vocalist who also composed
- Purandaradasa: Composer whose works are performed by others
- Saralaya Sisters: Performers who sing others' compositions

### Performance Tracking
The system tracks specific performances linking artists, compositions, and events. This enables analytics like identifying rarely performed compositions and tracking reception across different performances.

### Group and Individual Artists
Artists can be individuals or groups. For example:
- Ganesh (individual violinist)
- Kumaresh (individual violinist)  
- Ganesh-Kumaresh (duet group)

Each has separate artist pages with appropriate management access.

## Updated Domain Structure

### 1. Identity & Access Domains
- **User**: Platform users with karma, badges, and preferences
- **Artist**: Profile pages for individuals, groups, or historical figures
- **ArtistManagement**: Many-to-many relationship between users and artists with ACL
- **Karma**: Reputation system for community self-moderation

### 2. Content Domains
- **Composition**: Musical pieces with versioning and attribution
- **Raga/Tala**: Musical elements with metadata
- **Performance**: Specific instances of compositions being performed
- **Recording**: Audio/video artifacts linked to performances

### 3. Event & Venue Domains
- **Event**: Concerts, workshops, and festivals (past and future)
- **Venue**: Performance locations with partnership levels

### 4. Community Domains
- **Forum**: Community discussions
- **Collection**: User-curated content
- **Notification**: Communication system
- **WhatsApp**: Bot integration for artist updates

### 5. Monetization Domains
- **Payment**: Subscriptions and patronage
- **Ticketing**: Event ticket management

## Key Domain Relationships

```
User -*-> ArtistManager <-*- Artist
Artist -*-> Performance <-*- Composition
Artist -*-> CompositionAttribution <-*- Composition
Performance --> Event --> Venue
Performance --> Recording
Artist --> GroupMember --> Artist (for groups)
```

## Access Control Strategy

Using Access Control Lists (ACL) for granular permissions:

```typescript
interface ArtistAccess {
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
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
}
```

## Attribution & Dispute Handling

Supporting multiple/disputed attributions with confidence levels:

```typescript
interface CompositionAttribution {
  compositionId: string;
  artistId: string;
  attributionType: 'primary' | 'disputed' | 'alternative' | 'traditional';
  confidence: 'high' | 'medium' | 'low';
  source?: string;
  notes?: string;
}
```

## Moderation Workflow

Approval system for community-managed content:

```typescript
interface ApprovalRequest {
  id: string;
  entityType: 'artist' | 'composition' | 'performance' | 'attribution';
  entityId: string;
  changeType: 'create' | 'update' | 'delete';
  proposedChanges: Record<string, any>;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
}
```

## Implementation Strategy

### Phase 1: Core Foundation (Weeks 1-2)
1. User domain (authentication, roles)
2. Artist domain (profiles, groups)
3. ArtistManagement (ACL, permissions)
4. Karma system (basic implementation)

### Phase 2: Knowledge Base (Weeks 3-4)
1. Raga/Tala domains
2. Composition domain with versioning
3. Attribution system
4. Name variant handling

### Phase 3: Performance Tracking (Week 5)
1. Performance domain
2. Recording domain
3. Event-Performance relationships

### Phase 4: Community Features (Week 6)
1. Forum domain
2. Approval workflows
3. Basic notifications

### Phase 5: Events & Venues (Week 7)
1. Venue domain
2. Event domain (past and future)
3. Event-Artist relationships

### Phase 6: Advanced Features (Weeks 8+)
1. WhatsApp integration
2. Collections
3. Payment/Patronage
4. Advanced search and analytics

## Key Technical Insights

1. **Single-Table Design**: All entities stored in one DynamoDB table using composite keys and GSIs
2. **Versioning**: Content items use a VERSION#v[n]#[timestamp] pattern
3. **Sharding**: High-volume items use time-based sharding
4. **Access Control**: ACL pattern for flexible, granular permissions
5. **Group Handling**: Groups as first-class artist entities
6. **Performance Tracking**: Enables rich analytics and discovery
7. **Attribution**: Flexible system for disputed/unknown composers
8. **Community Management**: Approval workflows for quality control

## Next Steps

The foundation is complete. Implementation should proceed in phases, starting with core identity domains and building up to complex features. Each domain should:

1. Create domain-specific types based on the TypeScript models
2. Implement Zod schemas for validation
3. Build repositories using the single-table utilities
4. Create services for business logic
5. Add comprehensive tests
6. Integrate with the tRPC backend

The architecture now supports the nuanced requirements of the Indian classical music ecosystem while maintaining flexibility for future expansion.
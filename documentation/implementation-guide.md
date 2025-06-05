# Implementation Guide & Examples

## Domain Implementation Pattern

### 1. Create Domain Structure
Each domain follows this structure:
```
domain/artist/              # Example using Phase 1 domain
├── index.ts              # Clean exports
├── types.ts              # Domain-specific types  
├── schema.ts             # Zod schemas (not validation.ts)
├── repository.ts         # Data access layer
├── repository.test.ts    # Repository tests
├── service.ts            # Business logic
├── service.test.ts       # Service tests
└── index.ts              # Domain exports (tRPC routers defined separately)
```

**Note**: This guide uses Artist domain examples (Phase 1 implemented) instead of User domain (Phase 2 planned).

### 2. Implement Types (types.ts)
```typescript
import type { 
  Artist as BaseArtist, 
  ArtistType,
  Tradition,
  Location 
} from '@/types';

// Domain-specific extensions
export interface CreateArtistInput {
  name: string;
  bio?: string;
  artistType: ArtistType;
  instruments: string[];
  traditions: Tradition[];
  gurus?: string[];
  lineage?: string;
  location?: Location;
}

export interface UpdateArtistInput {
  name?: string;
  bio?: string;
  instruments?: string[];
  traditions?: Tradition[];
  gurus?: string[];
  lineage?: string;
  location?: Location;
}

export interface ArtistSearchParams {
  query?: string;
  instrument?: string;
  tradition?: Tradition;
  artistType?: ArtistType;
  limit?: number;
  nextToken?: string;
}

export interface ArtistWithStats extends BaseArtist {
  compositionsCount: number;
  performancesCount: number;
  followersCount: number;
}

// Re-export base types
export type { Artist, ArtistType, Tradition, Location };
```

### 3. Implement Schema (schema.ts)
```typescript
import { z } from 'zod';
import { 
  createStringSchema,
  createArraySchema 
} from '@/utils/validation';
import { ArtistType, Tradition } from '@/types';

export const CreateArtistSchema = z.object({
  name: createStringSchema({ minLength: 2, maxLength: 100 }),
  bio: createStringSchema({ maxLength: 1000 }).optional(),
  artistType: z.nativeEnum(ArtistType),
  instruments: createArraySchema(z.string()),
  traditions: createArraySchema(z.nativeEnum(Tradition)),
  gurus: createArraySchema(z.string()).optional(),
  lineage: createStringSchema({ maxLength: 200 }).optional(),
  location: z.object({
    country: z.string(),
    state: z.string().optional(),
    city: z.string().optional()
  }).optional()
});

export const UpdateArtistSchema = z.object({
  name: createStringSchema({ minLength: 2, maxLength: 100 }).optional(),
  bio: createStringSchema({ maxLength: 1000 }).optional(),
  instruments: createArraySchema(z.string()).optional(),
  traditions: createArraySchema(z.nativeEnum(Tradition)).optional(),
  gurus: createArraySchema(z.string()).optional(),
  lineage: createStringSchema({ maxLength: 200 }).optional(),
  location: z.object({
    country: z.string(),
    state: z.string().optional(),
    city: z.string().optional()
  }).optional()
});

export const ArtistSearchSchema = z.object({
  query: z.string().optional(),
  instrument: z.string().optional(),
  tradition: z.nativeEnum(Tradition).optional(),
  artistType: z.nativeEnum(ArtistType).optional(),
  limit: z.number().min(1).max(100).default(20),
  nextToken: z.string().optional()
});

// Export types inferred from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;
export type ArtistSearchParams = z.infer<typeof ArtistSearchSchema>;
```

### 4. Implement Repository (repository.ts)
**Note**: This is a simplified example. See actual Phase 1 implementations in `packages/core/src/domain/` for complete patterns.

```typescript
import type { Repository } from '@/types/common';
import { 
  getByPrimaryKey,
  getAllByPartitionKey,
  getByGlobalIndex,
  putItem,
  updateItem,
  deleteItem,
  createQuery
} from '@/shared/accessPatterns';
import { 
  formatKey, 
  EntityPrefix, 
  SecondaryPrefix,
  addUpdateTimestamp 
} from '@/shared/singleTable';
import { generatePrefixedId, getCurrentISOString } from '@/utils';
import { ApplicationError, ErrorCode } from '@/constants';
import type { Artist, CreateArtistInput, UpdateArtistInput, ArtistSearchParams } from './types';

export class ArtistRepository implements Repository<Artist> {
  async create(input: CreateArtistInput): Promise<Artist> {
    const id = await generatePrefixedId('artist');
    const now = getCurrentISOString();
    
    const artist: Artist = {
      ...input,
      id,
      isVerified: false,
      socialLinks: {},
      website: null,
      createdAt: now,
      updatedAt: now
    };

    // Create artist record
    await putItem({
      pk: formatKey(EntityPrefix.ARTIST, id),
      sk: SecondaryPrefix.METADATA,
      GSI1PK: `ARTIST_TYPE#${input.artistType}`,
      GSI1SK: formatKey(EntityPrefix.ARTIST, id),
      ...artist
    });

    return artist;
  }

  async getById(id: string): Promise<Artist | null> {
    return getByPrimaryKey<Artist>(EntityPrefix.ARTIST, id);
  }

  // Basic search method
  async search(params: ArtistSearchParams): Promise<{ items: Artist[]; nextToken?: string }> {
    // Implement search logic using appropriate GSIs
    // See actual implementations for complete patterns
    return { items: [], nextToken: undefined };
  }
}
```

---

## 🚧 **PHASE 2+ IMPLEMENTATION EXAMPLES** 
*The following examples are for future phases and use domains not yet implemented.*

### User Domain Example (Phase 2)

  async getByEmail(email: string): Promise<User | null> {
    const results = await getByGlobalIndex<User>(
      'GSI1',
      'GSI1PK',
      `EMAIL#${email}`
    );
    return results.items[0] || null;
  }

  async getByUsername(username: string): Promise<User | null> {
    const results = await getByGlobalIndex<User>(
      'GSI2',
      'GSI2PK', 
      `USERNAME#${username}`
    );
    return results.items[0] || null;
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new ApplicationError(
        ErrorCode.USER_NOT_FOUND,
        `User with ID ${id} not found`
      );
    }

    const updated = {
      ...existing,
      ...input,
      ...addUpdateTimestamp(existing)
    };

    await updateItem(
      { 
        pk: formatKey(EntityPrefix.USER, id), 
        sk: SecondaryPrefix.METADATA 
      },
      updated
    );

    return updated;
  }

  async delete(id: string): Promise<void> {
    const exists = await this.getById(id);
    if (!exists) {
      throw new ApplicationError(
        ErrorCode.USER_NOT_FOUND,
        `User with ID ${id} not found`
      );
    }

    await deleteItem({
      pk: formatKey(EntityPrefix.USER, id),
      sk: SecondaryPrefix.METADATA
    });
  }

  async search(params: UserSearchParams): Promise<{ items: User[]; nextToken?: string }> {
    let query = createQuery<User>();

    if (params.query) {
      // Basic search implementation
      // In production, this would use Elasticsearch
      return this.basicSearch(params.query, params.limit, params.nextToken);
    }

    if (params.role) {
      query = query
        .withIndex('GSI3')
        .withPartitionKey('GSI3PK', `ROLE#${params.role}`)
        .withSortKeyBeginsWith('GSI3SK', 'USER#');
    }

    if (params.isVerified !== undefined) {
      query = query.withFilter('isVerified', '=', params.isVerified);
    }

    const result = await query
      .withLimit(params.limit || 20)
      .withStartKey(parseNextToken(params.nextToken))
      .execute();

    return {
      items: result.items,
      nextToken: createNextToken(result.lastEvaluatedKey)
    };
  }

  private async basicSearch(
    query: string, 
    limit = 20, 
    nextToken?: string
  ): Promise<{ items: User[]; nextToken?: string }> {
    // Implement basic search using scan
    // This is a placeholder - use Elasticsearch in production
    return { items: [], nextToken: undefined };
  }

  // Relationship methods
  async followArtist(userId: string, artistId: string): Promise<void> {
    await putItem({
      pk: formatKey(EntityPrefix.USER, userId),
      sk: `${SecondaryPrefix.FOLLOWS}#ARTIST#${artistId}`,
      GSI4PK: formatKey(EntityPrefix.ARTIST, artistId),
      GSI4SK: `FOLLOWER#${userId}`,
      followedAt: getCurrentISOString()
    });
  }

  async unfollowArtist(userId: string, artistId: string): Promise<void> {
    await deleteItem({
      pk: formatKey(EntityPrefix.USER, userId),
      sk: `${SecondaryPrefix.FOLLOWS}#ARTIST#${artistId}`
    });
  }

  async getFollowedArtists(
    userId: string, 
    limit = 20, 
    nextToken?: string
  ): Promise<{ items: string[]; nextToken?: string }> {
    const result = await getAllByPartitionKey(
      EntityPrefix.USER,
      userId,
      {
        sortKeyPrefix: `${SecondaryPrefix.FOLLOWS}#ARTIST#`,
        limit,
        exclusiveStartKey: parseNextToken(nextToken)
      }
    );

    const artistIds = result.items.map(item => 
      item.sk.split('#')[2] // Extract artist ID from sort key
    );

    return {
      items: artistIds,
      nextToken: createNextToken(result.lastEvaluatedKey)
    };
  }
}
```

### 5. Implement Service (service.ts)
```typescript
import type { UserRepository } from './repository';
import type { KarmaService } from '@/domain/karma';
import type { 
  User, 
  CreateUserInput, 
  UpdateUserInput, 
  UserSearchParams,
  UserWithStats 
} from './types';
import { ApplicationError, ErrorCode } from '@/constants';

export class UserService {
  constructor(
    private userRepo: UserRepository,
    private karmaService: KarmaService
  ) {}

  async createUser(input: CreateUserInput): Promise<User> {
    // Validate input
    const validated = CreateUserSchema.parse(input);
    
    // Create user
    const user = await this.userRepo.create(validated);
    
    // Award initial karma
    await this.karmaService.awardKarma(
      user.id, 
      10, 
      'account_creation', 
      'Initial karma for account creation'
    );
    
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    return this.userRepo.getById(id);
  }

  async getUserWithStats(id: string): Promise<UserWithStats | null> {
    const user = await this.userRepo.getById(id);
    if (!user) return null;

    // Get stats in parallel
    const [followersCount, followingCount, favoritesCount] = await Promise.all([
      this.getFollowersCount(id),
      this.getFollowingCount(id),
      this.getFavoritesCount(id)
    ]);

    return {
      ...user,
      followersCount,
      followingCount,
      favoritesCount
    };
  }

  async updateUser(id: string, input: UpdateUserInput, updatedBy: string): Promise<User> {
    // Check permissions
    if (id !== updatedBy) {
      const canEdit = await this.karmaService.checkPermission(
        updatedBy, 
        'edit_user_profile'
      );
      if (!canEdit) {
        throw new ApplicationError(
          ErrorCode.INSUFFICIENT_KARMA,
          'Insufficient karma to edit other user profiles'
        );
      }
    }

    // Validate input
    const validated = UpdateUserSchema.parse(input);
    
    return this.userRepo.update(id, validated);
  }

  async searchUsers(params: UserSearchParams): Promise<{ items: User[]; nextToken?: string }> {
    const validated = UserSearchSchema.parse(params);
    return this.userRepo.search(validated);
  }

  async followArtist(userId: string, artistId: string): Promise<void> {
    // Check if artist exists
    const artist = await this.artistService.getArtist(artistId);
    if (!artist) {
      throw new ApplicationError(
        ErrorCode.ARTIST_NOT_FOUND,
        `Artist with ID ${artistId} not found`
      );
    }

    await this.userRepo.followArtist(userId, artistId);
    
    // Award karma for following
    await this.karmaService.awardKarma(
      userId,
      1,
      'follow_artist',
      `Followed artist ${artist.name}`
    );
  }

  async unfollowArtist(userId: string, artistId: string): Promise<void> {
    await this.userRepo.unfollowArtist(userId, artistId);
  }

  async getFollowedArtists(
    userId: string, 
    limit = 20, 
    nextToken?: string
  ): Promise<{ items: Artist[]; nextToken?: string }> {
    const { items: artistIds, nextToken: newNextToken } = 
      await this.userRepo.getFollowedArtists(userId, limit, nextToken);
    
    // Get full artist objects
    const artists = await Promise.all(
      artistIds.map(id => this.artistService.getArtist(id))
    );
    
    return {
      items: artists.filter(Boolean) as Artist[],
      nextToken: newNextToken
    };
  }

  // Private helper methods
  private async getFollowersCount(userId: string): Promise<number> {
    // Implementation to count followers
    return 0;
  }

  private async getFollowingCount(userId: string): Promise<number> {
    // Implementation to count following
    return 0;
  }

  private async getFavoritesCount(userId: string): Promise<number> {
    // Implementation to count favorites
    return 0;
  }
}
```

### 6. Implement Tests (service.test.ts)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './service';
import { UserRepository } from './repository';
import { KarmaService } from '@/domain/karma';
import { createMockUser } from '@/test/mocks/entities';
import { ApplicationError, ErrorCode } from '@/constants';

// Mock dependencies
vi.mock('./repository');
vi.mock('@/domain/karma');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockKarmaService: jest.Mocked<KarmaService>;

  beforeEach(() => {
    mockUserRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      getByEmail: vi.fn(),
      getByUsername: vi.fn(),
      followArtist: vi.fn(),
      unfollowArtist: vi.fn(),
      getFollowedArtists: vi.fn()
    } as any;

    mockKarmaService = {
      awardKarma: vi.fn(),
      checkPermission: vi.fn()
    } as any;

    userService = new UserService(mockUserRepo, mockKarmaService);
  });

  describe('createUser', () => {
    it('should create user and award initial karma', async () => {
      const input = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User'
      };
      
      const mockUser = createMockUser(input);
      mockUserRepo.create.mockResolvedValue(mockUser);
      mockKarmaService.awardKarma.mockResolvedValue(undefined);

      const result = await userService.createUser(input);

      expect(mockUserRepo.create).toHaveBeenCalledWith(input);
      expect(mockKarmaService.awardKarma).toHaveBeenCalledWith(
        mockUser.id,
        10,
        'account_creation',
        'Initial karma for account creation'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid input', async () => {
      const input = {
        username: '', // Invalid
        email: 'invalid-email',
        displayName: 'Test User'
      };

      await expect(userService.createUser(input)).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should allow user to update own profile', async () => {
      const userId = 'user_123';
      const input = { displayName: 'Updated Name' };
      const mockUser = createMockUser();
      
      mockUserRepo.update.mockResolvedValue({ ...mockUser, ...input });

      const result = await userService.updateUser(userId, input, userId);

      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, input);
      expect(result.displayName).toBe(input.displayName);
    });

    it('should check karma for editing other profiles', async () => {
      const userId = 'user_123';
      const updatedBy = 'user_456';
      const input = { displayName: 'Updated Name' };
      
      mockKarmaService.checkPermission.mockResolvedValue(false);

      await expect(
        userService.updateUser(userId, input, updatedBy)
      ).rejects.toThrow(ApplicationError);
      
      expect(mockKarmaService.checkPermission).toHaveBeenCalledWith(
        updatedBy,
        'edit_user_profile'
      );
    });
  });

  describe('followArtist', () => {
    it('should follow artist and award karma', async () => {
      const userId = 'user_123';
      const artistId = 'artist_456';
      const mockArtist = { id: artistId, name: 'Test Artist' };
      
      // Mock artist exists
      vi.spyOn(userService as any, 'artistService', 'get').mockReturnValue({
        getArtist: vi.fn().mockResolvedValue(mockArtist)
      });
      
      mockUserRepo.followArtist.mockResolvedValue(undefined);
      mockKarmaService.awardKarma.mockResolvedValue(undefined);

      await userService.followArtist(userId, artistId);

      expect(mockUserRepo.followArtist).toHaveBeenCalledWith(userId, artistId);
      expect(mockKarmaService.awardKarma).toHaveBeenCalledWith(
        userId,
        1,
        'follow_artist',
        `Followed artist ${mockArtist.name}`
      );
    });
  });
});
```

### 7. Implement tRPC Router (trpc.ts)
```typescript
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { UserService } from './service';
import { 
  CreateUserSchema, 
  UpdateUserSchema, 
  UserSearchSchema 
} from './validation';
import { PaginationSchema } from '@/shared/validation';

export const userRouter = router({
  create: publicProcedure
    .input(CreateUserSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.userService.createUser(input);
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.userService.getUserWithStats(ctx.user.id);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.userService.getUser(input.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdateUserSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.userService.updateUser(
        input.id, 
        input.data, 
        ctx.user.id
      );
    }),

  search: publicProcedure
    .input(UserSearchSchema)
    .query(async ({ input, ctx }) => {
      return ctx.userService.searchUsers(input);
    }),

  followArtist: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.userService.followArtist(ctx.user.id, input.artistId);
    }),

  unfollowArtist: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.userService.unfollowArtist(ctx.user.id, input.artistId);
    }),

  getFollowedArtists: protectedProcedure
    .input(PaginationSchema.optional())
    .query(async ({ input, ctx }) => {
      return ctx.userService.getFollowedArtists(
        ctx.user.id,
        input?.limit,
        input?.nextToken
      );
    })
});
```

## Key Implementation Patterns

### 1. Error Handling Pattern
```typescript
// Always use ApplicationError for domain errors
if (!entity) {
  throw new ApplicationError(
    ErrorCode.ENTITY_NOT_FOUND,
    `Entity with ID ${id} not found`
  );
}

// Wrap external errors with context
try {
  await externalService.call();
} catch (error) {
  throw new ApplicationError(
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    `External service failed: ${error.message}`
  );
}
```

### 2. Permission Checking Pattern
```typescript
// Check permissions before operations
async performAction(userId: string, entityId: string): Promise<void> {
  const hasPermission = await this.karmaService.checkPermission(
    userId,
    'perform_action',
    EntityType.ENTITY
  );
  
  if (!hasPermission) {
    throw new ApplicationError(
      ErrorCode.INSUFFICIENT_KARMA,
      'Insufficient karma for this action'
    );
  }
  
  // Perform action...
}
```

### 3. Validation Pattern
```typescript
// Always validate at service boundaries
async createEntity(input: unknown): Promise<Entity> {
  const validated = CreateEntitySchema.parse(input);
  return this.repository.create(validated);
}
```

### 4. Transaction Pattern
```typescript
// Use transactions for related operations
async createArtistWithManagement(
  artistData: CreateArtistInput,
  userId: string
): Promise<Artist> {
  const artist = await this.artistRepo.create(artistData);
  
  await createRelatedItems(artist, [
    {
      pk: formatKey(EntityPrefix.ARTIST, artist.id),
      sk: `MANAGER#${userId}`,
      permissions: { /* full permissions */ },
      grantedBy: userId,
      grantedAt: getCurrentISOString()
    }
  ]);
  
  return artist;
}
```
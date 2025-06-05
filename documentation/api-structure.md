# API Structure & tRPC Endpoints

## tRPC Router Organization

### Current Implementation (Phase 1)
```typescript
export const appRouter = router({
  artist: artistRouter,        // ✅ Implemented
  composition: compositionRouter, // ✅ Implemented
  raga: ragaRouter,           // ✅ Implemented
  tala: talaRouter,           // ✅ Implemented
});
```

### Future Phases (Planned)
```typescript
export const appRouter = router({
  // Phase 1 - Current ✅
  artist: artistRouter,
  composition: compositionRouter,
  raga: ragaRouter,
  tala: talaRouter,
  
  // Phase 2 - User Engagement (Weeks 9-16) 🚧
  user: userRouter,
  event: eventRouter,
  venue: venueRouter,
  performance: performanceRouter,
  whatsapp: whatsappRouter,
  
  // Phase 3 - Community (Weeks 17-26) 📋
  forum: forumRouter,
  karma: karmaRouter,
  collection: collectionRouter,
  
  // Phase 4 - Monetization (Weeks 27-38) 💰
  payment: paymentRouter,
  admin: adminRouter
});
```

## Core Entity Routers

---

## 🚧 **PHASE 2+ FEATURES BELOW** 
*The following routers are planned for future development phases and are not currently implemented.*

### User Router (Phase 2)
```typescript
export const userRouter = router({
  // Authentication & Profile
  me: protectedProcedure.query(/* Get current user */),
  
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(/* Get user by ID */),
    
  updateProfile: protectedProcedure
    .input(UpdateUserSchema)
    .mutation(/* Update user profile */),
    
  updatePreferences: protectedProcedure
    .input(UserPreferencesSchema)
    .mutation(/* Update user preferences */),
    
  // Relationships
  followArtist: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(/* Follow an artist */),
    
  unfollowArtist: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .mutation(/* Unfollow an artist */),
    
  getFollowedArtists: protectedProcedure
    .input(PaginationSchema.optional())
    .query(/* Get user's followed artists */),
    
  getFavorites: protectedProcedure
    .input(z.object({
      type: z.enum(['artist', 'composition', 'event']).optional(),
      ...PaginationSchema.shape
    }))
    .query(/* Get user's favorites */),
    
  // Activity
  getHistory: protectedProcedure
    .input(z.object({
      type: z.enum(['view', 'search', 'interaction']).optional(),
      ...PaginationSchema.shape
    }))
    .query(/* Get user activity history */),
    
  getNotifications: protectedProcedure
    .input(PaginationSchema.optional())
    .query(/* Get user notifications */),
    
  markNotificationRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(/* Mark notification as read */)
});
```

### Artist Router (Phase 1 - Enhanced in Phase 2)
**Current Status**: ✅ Basic CRUD implemented | 🚧 Advanced features planned for Phase 2

```typescript
export const artistRouter = router({
  // CRUD Operations
  create: protectedProcedure
    .input(CreateArtistSchema)
    .mutation(/* Create new artist */),
    
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(/* Get artist by ID */),
    
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdateArtistSchema
    }))
    .mutation(/* Update artist profile */),
    
  // Search & Discovery
  search: publicProcedure
    .input(ArtistSearchSchema)
    .query(/* Search artists */),
    
  getPopular: publicProcedure
    .input(z.object({
      tradition: z.nativeEnum(Tradition).optional(),
      limit: z.number().max(50).default(20)
    }))
    .query(/* Get popular artists */),
    
  getByInstrument: publicProcedure
    .input(z.object({
      instrument: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get artists by instrument */),
    
  getByLocation: publicProcedure
    .input(z.object({
      country: z.string(),
      state: z.string().optional(),
      city: z.string().optional(),
      ...PaginationSchema.shape
    }))
    .query(/* Get artists by location */),
    
  // Management
  getManagers: protectedProcedure
    .input(z.object({ artistId: z.string() }))
    .query(/* Get artist managers */),
    
  addManager: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      userId: z.string(),
      permissions: ArtistPermissionsSchema
    }))
    .mutation(/* Add artist manager */),
    
  updateManagerPermissions: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      userId: z.string(),
      permissions: ArtistPermissionsSchema
    }))
    .mutation(/* Update manager permissions */),
    
  removeManager: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      userId: z.string()
    }))
    .mutation(/* Remove artist manager */),
    
  // Relationships
  getGroupMembers: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(/* Get group members */),
    
  addGroupMember: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      memberId: z.string(),
      role: z.string().optional()
    }))
    .mutation(/* Add group member */),
    
  // Events & Performances
  getEvents: publicProcedure
    .input(z.object({
      artistId: z.string(),
      dateRange: DateRangeSchema.optional(),
      ...PaginationSchema.shape
    }))
    .query(/* Get artist's events */),
    
  getPerformances: publicProcedure
    .input(z.object({
      artistId: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get artist's performances */),
    
  // Analytics
  incrementViewCount: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(/* Increment view count */),
    
  getAnalytics: protectedProcedure
    .input(z.object({
      artistId: z.string(),
      dateRange: DateRangeSchema.optional()
    }))
    .query(/* Get artist analytics */)
});
```

### Composition Router (Phase 1 - Enhanced in Phase 2)
**Current Status**: ✅ Basic CRUD implemented | 🚧 Versioning & attribution planned for Phase 2

```typescript
export const compositionRouter = router({
  // CRUD Operations
  create: protectedProcedure
    .input(CreateCompositionSchema)
    .mutation(/* Create new composition */),
    
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
      version: z.string().optional()
    }))
    .query(/* Get composition by ID */),
    
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdateCompositionSchema,
      notes: z.string().optional()
    }))
    .mutation(/* Update composition */),
    
  // Versioning
  getVersionHistory: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(/* Get version history */),
    
  compareVersions: publicProcedure
    .input(z.object({
      id: z.string(),
      version1: z.string(),
      version2: z.string()
    }))
    .query(/* Compare two versions */),
    
  // Search & Discovery
  search: publicProcedure
    .input(CompositionSearchSchema)
    .query(/* Search compositions */),
    
  getByRaga: publicProcedure
    .input(z.object({
      ragaId: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get compositions by raga */),
    
  getByComposer: publicProcedure
    .input(z.object({
      composerId: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get compositions by composer */),
    
  getByLanguage: publicProcedure
    .input(z.object({
      language: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get compositions by language */),
    
  // Attribution
  getAttributions: publicProcedure
    .input(z.object({ compositionId: z.string() }))
    .query(/* Get composition attributions */),
    
  addAttribution: protectedProcedure
    .input(CreateAttributionSchema)
    .mutation(/* Add attribution */),
    
  updateAttribution: protectedProcedure
    .input(UpdateAttributionSchema)
    .mutation(/* Update attribution */),
    
  verifyAttribution: protectedProcedure
    .input(z.object({
      compositionId: z.string(),
      artistId: z.string()
    }))
    .mutation(/* Verify attribution */),
    
  // Performances
  getPerformances: publicProcedure
    .input(z.object({
      compositionId: z.string(),
      ...PaginationSchema.shape
    }))
    .query(/* Get composition performances */)
});
```

## Input/Output Schemas

### User Schemas
```typescript
const UpdateUserSchema = z.object({
  displayName: createStringSchema({ minLength: 2, maxLength: 100 }).optional(),
  bio: createStringSchema({ maxLength: 500 }).optional(),
  profileImage: z.string().url().optional(),
  preferences: z.object({
    defaultLanguage: z.string(),
    preferredTraditions: z.array(z.nativeEnum(Tradition)),
    favoriteInstruments: z.array(z.string()),
    favoriteRagas: z.array(z.string()),
    themeName: z.enum(['light', 'dark', 'system'])
  }).optional()
});

const UserPreferencesSchema = z.object({
  defaultLanguage: z.string(),
  preferredTraditions: z.array(z.nativeEnum(Tradition)),
  favoriteInstruments: z.array(z.string()),
  favoriteRagas: z.array(z.string()),
  themeName: z.enum(['light', 'dark', 'system']),
  notificationSettings: z.object({
    email: z.object({
      newFollower: z.boolean(),
      upcomingEvents: z.boolean(),
      artistUpdates: z.boolean(),
      threadReplies: z.boolean()
    }),
    push: z.object({
      newFollower: z.boolean(),
      upcomingEvents: z.boolean(),
      artistUpdates: z.boolean(),
      threadReplies: z.boolean()
    })
  })
});
```

### Artist Schemas
```typescript
const CreateArtistSchema = z.object({
  name: createStringSchema({ minLength: 2, maxLength: 100 }),
  bio: createStringSchema({ maxLength: 1000 }).optional(),
  artistType: z.nativeEnum(ArtistType),
  instruments: z.array(z.string()),
  gurus: z.array(z.string()).optional(),
  lineage: createStringSchema({ maxLength: 200 }).optional(),
  formationYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  location: locationSchema.optional(),
  website: z.string().url().optional(),
  socialLinks: socialLinksSchema.optional(),
  traditions: z.array(z.nativeEnum(Tradition))
});

const UpdateArtistSchema = CreateArtistSchema.partial();

const ArtistSearchSchema = z.object({
  query: z.string().optional(),
  instrument: z.string().optional(),
  tradition: z.nativeEnum(Tradition).optional(),
  location: z.object({
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional()
  }).optional(),
  artistType: z.nativeEnum(ArtistType).optional(),
  ...PaginationSchema.shape
});

const ArtistPermissionsSchema = z.object({
  editProfile: z.boolean(),
  manageBiography: z.boolean(),
  addPerformances: z.boolean(),
  manageEvents: z.boolean(),
  approveChanges: z.boolean(),
  addManagers: z.boolean()
});
```

### Composition Schemas
```typescript
const CreateCompositionSchema = z.object({
  title: createStringSchema({ minLength: 2, maxLength: 200 }),
  canonicalTitle: createStringSchema({ maxLength: 200 }).optional(),
  alternativeTitles: z.array(z.string()).optional(),
  language: z.string(),
  verses: createStringSchema({ maxLength: 5000 }).optional(),
  meaning: createStringSchema({ maxLength: 2000 }).optional(),
  notation: createStringSchema({ maxLength: 5000 }).optional(),
  tradition: z.nativeEnum(Tradition),
  sourceAttribution: z.string().optional(),
  ragaId: z.string().optional(),
  talaId: z.string().optional(),
  composerIds: z.array(z.string()).optional()
});

const UpdateCompositionSchema = CreateCompositionSchema.partial();

const CompositionSearchSchema = z.object({
  query: z.string().optional(),
  ragaId: z.string().optional(),
  talaId: z.string().optional(),
  composerId: z.string().optional(),
  language: z.string().optional(),
  tradition: z.nativeEnum(Tradition).optional(),
  ...PaginationSchema.shape
});

const CreateAttributionSchema = z.object({
  compositionId: z.string(),
  artistId: z.string(),
  attributionType: z.nativeEnum(AttributionType),
  confidence: z.nativeEnum(AttributionConfidence),
  source: z.string().optional(),
  notes: createStringSchema({ maxLength: 500 }).optional()
});
```

## Common Schemas

### Pagination
```typescript
const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  nextToken: z.string().optional()
});

const DateRangeSchema = z.object({
  start: dateStringSchema,
  end: dateStringSchema
});
```

### Response Types
```typescript
interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
  totalCount?: number;
}

interface SearchResponse<T> extends PaginatedResponse<T> {
  facets?: Record<string, Array<{ value: string; count: number }>>;
  suggestions?: string[];
}

interface AnalyticsResponse {
  views: number;
  favorites: number;
  engagement: number;
  trends: Array<{
    date: string;
    value: number;
  }>;
}
```

## Error Handling

### tRPC Error Mapping
```typescript
function mapApplicationError(error: ApplicationError): TRPCError {
  const errorMap: Record<string, { code: TRPC_ERROR_CODE; message: string }> = {
    [ErrorCode.USER_NOT_FOUND]: { 
      code: 'NOT_FOUND', 
      message: 'User not found' 
    },
    [ErrorCode.INSUFFICIENT_KARMA]: { 
      code: 'FORBIDDEN', 
      message: 'Insufficient karma for this action' 
    },
    [ErrorCode.INVALID_PERMISSIONS]: { 
      code: 'FORBIDDEN', 
      message: 'Invalid permissions for this action' 
    },
    [ErrorCode.VALIDATION_ERROR]: { 
      code: 'BAD_REQUEST', 
      message: 'Validation failed' 
    }
  };

  const mapped = errorMap[error.code] || { 
    code: 'INTERNAL_SERVER_ERROR' as const, 
    message: 'Internal server error' 
  };
  
  return new TRPCError(mapped);
}
```

## Middleware

### Authentication Middleware
```typescript
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user
    }
  });
});

export const protectedProcedure = publicProcedure.use(isAuthed);
```

### Karma Check Middleware
```typescript
const requiresKarma = (action: string, entityType?: EntityType) => 
  middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    
    const hasPermission = await karmaService.checkPermission(
      ctx.user.id, 
      action, 
      entityType
    );
    
    if (!hasPermission) {
      throw new TRPCError({ 
        code: 'FORBIDDEN', 
        message: 'Insufficient karma for this action' 
      });
    }
    
    return next();
  });
```
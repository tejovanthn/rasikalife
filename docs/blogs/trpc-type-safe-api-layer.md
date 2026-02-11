# tRPC v11 - Type-Safe API Layer

## Introduction

Building type-safe APIs traditionally requires maintaining separate type definitions for client and server, leading to inconsistencies and runtime errors. tRPC eliminates this problem by providing end-to-end type safety from server to client without code generation. This blog post explores our tRPC v11 implementation for the Rasika.life platform, covering router patterns, middleware, error handling, and integration with AWS Lambda.

## The Type Safety Challenge

### Traditional API Development

```typescript
// Server-side (Express example)
app.post('/api/artists', async (req, res) => {
  const { name, artistType } = req.body;
  const artist = await createArtist({ name, artistType });
  res.json(artist);
});

// Client-side - No type safety
const response = await fetch('/api/artists', {
  method: 'POST',
  body: JSON.stringify({ name: 'Artist Name', artistType: 'vocalist' }),
});
const artist = await response.json(); // artist is 'any' type
```

### Problems with Traditional Approach
- **No type safety**: Client has no knowledge of server types
- **Manual synchronization**: Type definitions must be manually kept in sync
- **Runtime errors**: Type mismatches only discovered at runtime
- **Code generation overhead**: Tools like OpenAPI require build steps
- **Validation duplication**: Validation logic duplicated between client and server

## tRPC Implementation

### Project Setup

```typescript
// packages/trpc/src/trpc.ts
import { initTRPC } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { User } from '@rasika/core';

// Context shared across all procedures
export interface Context {
  event: APIGatewayProxyEventV2;
  user: User | null;
}

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const isAppError = error.cause instanceof ApplicationError;

    return {
      ...shape,
      data: {
        ...shape.data,
        code: isAppError ? error.cause.code : undefined,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Export reusable router and procedure builders
export const router = t.router;
export const publicProcedure = t.procedure;
export const createTRPCRouter = router;
```

### Router Structure

```typescript
// packages/trpc/src/routers/index.ts
import { createTRPCRouter } from '../trpc';
import { artistRouter } from './artist';
import { compositionRouter } from './composition';
import { editRouter } from './edit';
import { ragaRouter } from './raga';
import { searchRouter } from './search';
import { talaRouter } from './tala';
import { userRouter } from './user';

export const appRouter = createTRPCRouter({
  artist: artistRouter,
  composition: compositionRouter,
  edit: editRouter,
  raga: ragaRouter,
  search: searchRouter,
  tala: talaRouter,
  user: userRouter,
});

// Export type-safe router type
export type AppRouter = typeof appRouter;
```

### Domain Router Example

```typescript
// packages/trpc/src/routers/artist.ts
import { z } from 'zod';
import { Artist } from '@rasika/core';
import { publicProcedure, protectedProcedure, router } from '../trpc';

export const artistRouter = router({
  // Public query - anyone can access
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const artist = await Artist.getArtist(input.id);
      if (!artist) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artist with id ${input.id} not found`,
        });
      }
      return artist;
    }),

  // Public query with pagination
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await Artist.listArtists({
        limit: input.limit || 20,
        nextToken: input.nextToken,
      });
    }),

  // Protected mutation - requires authentication
  create: protectedProcedure
    .input(Artist.CreateArtistSchema)
    .mutation(async ({ input, ctx }) => {
      return await Artist.createArtist(input);
    }),

  // Protected mutation with authorization
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: Artist.UpdateArtistSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Authorization logic can be added here
      return await Artist.updateArtist(input.id, input.data);
    }),

  // Search endpoint
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).optional(),
      })
    )
    .query(async ({ input }) => {
      return await Artist.searchArtists(input.query, {
        limit: input.limit || 20,
      });
    }),
});
```

## Middleware Patterns

### Authentication Middleware

```typescript
// Protected procedure for authenticated users
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type narrowing - user is now non-null
    },
  });
});
```

### Role-Based Authorization

```typescript
import { ROLE, type Role } from '@rasika/core';

// Admin-only procedure
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== ROLE.ADMIN) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx });
});

// Moderator procedure (moderator or admin)
export const moderatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const moderatorRoles: Role[] = [ROLE.MODERATOR, ROLE.ADMIN];

  if (!moderatorRoles.includes(ctx.user.role as Role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Moderator access required',
    });
  }

  return next({ ctx });
});
```

### Logging Middleware

```typescript
// Request logging middleware
export const loggedProcedure = t.procedure.use(async ({ path, type, next }) => {
  const start = Date.now();

  console.log(`[tRPC] ${type.toUpperCase()} ${path} - Start`);

  const result = await next();

  const durationMs = Date.now() - start;
  console.log(`[tRPC] ${type.toUpperCase()} ${path} - ${durationMs}ms`);

  return result;
});
```

## Error Handling

### Custom Error Formatter

```typescript
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // Handle ApplicationError (custom domain errors)
    const isAppError = error.cause instanceof ApplicationError;

    // Handle Zod validation errors
    const isZodError = error.cause instanceof ZodError;

    return {
      ...shape,
      data: {
        ...shape.data,
        code: isAppError ? error.cause.code : undefined,
        zodError: isZodError ? error.cause.flatten() : null,
      },
    };
  },
});
```

### Error Usage in Procedures

```typescript
export const artistRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const artist = await Artist.getArtist(input.id);

        if (!artist) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Artist with id ${input.id} not found`,
          });
        }

        return artist;
      } catch (error) {
        // ApplicationError is automatically handled by error formatter
        if (error instanceof ApplicationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
});
```

## AWS Lambda Integration

### Lambda Handler Setup

```typescript
// packages/functions/src/trpc.ts
import { awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { appRouter } from '@rasika/trpc';
import { User } from '@rasika/core';

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: async ({
    event,
  }: {
    event: APIGatewayProxyEventV2;
  }): Promise<Context> => {
    // Extract user from auth header/cookie
    const authToken = event.headers.authorization?.replace('Bearer ', '');
    let user: User | null = null;

    if (authToken) {
      try {
        user = await User.getUserFromToken(authToken);
      } catch (error) {
        console.error('Failed to authenticate user:', error);
      }
    }

    return {
      event,
      user,
    };
  },
});
```

### Infrastructure Configuration (SST)

```typescript
// infra/api.ts
import { Function } from 'sst/constructs';

export const trpcHandler = new Function(stack, 'TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  environment: {
    DYNAMODB_TABLE: table.tableName,
  },
  permissions: [table],
  timeout: '30 seconds',
});

// API Gateway configuration
const api = new Api(stack, 'Api', {
  routes: {
    'POST /trpc/{proxy+}': trpcHandler,
    'GET /trpc/{proxy+}': trpcHandler,
  },
  cors: {
    allowOrigins: ['https://rasika.life'],
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});
```

## Client-Side Usage

### Remix Integration

```typescript
// packages/web/app/lib/trpc.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@rasika/trpc';

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
      headers() {
        return {
          authorization: `Bearer ${getAuthToken()}`,
        };
      },
    }),
  ],
});
```

### Type-Safe API Calls

```typescript
// Remix loader with full type safety
export const loader = async ({ params }: LoaderFunctionArgs) => {
  // Type-safe query - IDE autocomplete and type checking
  const artist = await trpc.artist.getById.query({
    id: params.artistid
  });

  // Type-safe list with pagination
  const compositions = await trpc.composition.list.query({
    limit: 20,
    nextToken: undefined,
  });

  return json({ artist, compositions });
};

// Remix action with type-safe mutation
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  // Type-safe mutation
  const newArtist = await trpc.artist.create.mutate({
    name: formData.get('name') as string,
    artistType: formData.get('artistType') as string,
  });

  return redirect(`/artists/${newArtist.id}`);
};
```

### React Component Usage

```typescript
// packages/web/app/routes/artists.$id.tsx
import { useLoaderData } from '@remix-run/react';
import type { loader } from './artists.$id';

export default function ArtistPage() {
  // Fully typed loader data
  const { artist, compositions } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{artist.name}</h1>
      <p>Type: {artist.artistType}</p>

      <h2>Compositions</h2>
      <ul>
        {compositions.items.map(comp => (
          <li key={comp.id}>{comp.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Advanced Patterns

### Batching and Caching

```typescript
// Client configuration with batching
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/trpc',
      maxURLLength: 2083,
      // Batch requests within 10ms window
      batch: {
        enabled: true,
      },
    }),
  ],
});

// Multiple queries batched into single HTTP request
const [artist, compositions, ragas] = await Promise.all([
  trpc.artist.getById.query({ id: 'artist-123' }),
  trpc.composition.list.query({ limit: 20 }),
  trpc.raga.list.query({ limit: 50 }),
]);
```

### Subscription Support

```typescript
// Server-side subscription
export const compositionRouter = router({
  onNewComposition: publicProcedure.subscription(async function* () {
    // Example: Poll database for new compositions
    while (true) {
      const newCompositions = await Composition.getRecent();
      yield newCompositions;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }),
});

// Client-side subscription
const subscription = trpc.composition.onNewComposition.subscribe(undefined, {
  onData(composition) {
    console.log('New composition:', composition);
  },
  onError(err) {
    console.error('Subscription error:', err);
  },
});
```

### Context Modification in Middleware

```typescript
// Add request metadata to context
const withMetadata = t.procedure.use(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      metadata: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        userAgent: ctx.event.headers['user-agent'],
      },
    },
  });
});

// Usage in procedures
export const artistRouter = router({
  create: withMetadata
    .input(Artist.CreateArtistSchema)
    .mutation(async ({ input, ctx }) => {
      console.log('Request metadata:', ctx.metadata);
      return await Artist.createArtist(input);
    }),
});
```

## Testing Strategies

### Unit Testing Procedures

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createCallerFactory } from '../trpc';
import { appRouter } from '../routers';

const createCaller = createCallerFactory(appRouter);

describe('Artist Router', () => {
  it('should get artist by id', async () => {
    const caller = createCaller({
      event: {} as any,
      user: null,
    });

    const artist = await caller.artist.getById({ id: 'artist-123' });

    expect(artist).toBeDefined();
    expect(artist.id).toBe('artist-123');
  });

  it('should require authentication for create', async () => {
    const caller = createCaller({
      event: {} as any,
      user: null,
    });

    await expect(
      caller.artist.create({ name: 'Test Artist', artistType: 'vocalist' })
    ).rejects.toThrow('UNAUTHORIZED');
  });
});
```

### Integration Testing

```typescript
describe('Artist Router Integration', () => {
  it('should create and retrieve artist', async () => {
    const caller = createCaller({
      event: {} as any,
      user: { id: 'user-123', role: 'admin' },
    });

    // Create artist
    const created = await caller.artist.create({
      name: 'M.S. Subbulakshmi',
      artistType: 'vocalist',
    });

    // Retrieve artist
    const retrieved = await caller.artist.getById({ id: created.id });

    expect(retrieved).toEqual(created);
  });
});
```

## Performance Considerations

### Query Optimization
- **Batching**: Enable request batching to reduce HTTP overhead
- **Caching**: Implement query result caching for frequently accessed data
- **Parallel queries**: Use Promise.all for independent queries
- **Pagination**: Always implement cursor-based pagination for large datasets

### Best Practices
1. **Keep procedures focused**: Each procedure should do one thing well
2. **Use middleware wisely**: Don't over-complicate with too many middleware layers
3. **Validate inputs**: Always use Zod schemas for input validation
4. **Type exports**: Export router types for client usage
5. **Error handling**: Use consistent error patterns across all procedures

## Common Pitfalls

### 1. Context Type Mismatch
**Problem**: Context type doesn't match between procedures and middleware

```typescript
// Wrong - context types don't match
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  return next({ ctx: { user: 'invalid' } }); // Type error
});
```

**Solution**: Ensure context modifications maintain type safety

```typescript
// Correct - properly typed context
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

### 2. Missing Input Validation
**Problem**: Not validating inputs leads to runtime errors

```typescript
// Wrong - no input validation
create: publicProcedure.mutation(async ({ input }) => {
  return await createArtist(input); // input is 'any'
});
```

**Solution**: Always use Zod schemas for validation

```typescript
// Correct - validated inputs
create: publicProcedure
  .input(z.object({ name: z.string(), artistType: z.string() }))
  .mutation(async ({ input }) => {
    return await createArtist(input); // input is typed
  });
```

### 3. Overfetching Data
**Problem**: Returning entire objects when only specific fields are needed

**Solution**: Implement field selection or use separate endpoints

```typescript
export const artistRouter = router({
  // Full object
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await Artist.getArtist(input.id);
    }),

  // Lightweight summary
  getSummary: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const artist = await Artist.getArtist(input.id);
      return { id: artist.id, name: artist.name };
    }),
});
```

## Conclusion

tRPC provides excellent type safety for API development without the complexity of code generation or schema synchronization. By following these patterns - structured routers, reusable middleware, comprehensive error handling, and proper testing - you can build maintainable, type-safe APIs that scale with your application.

For the Rasika.life platform, tRPC enables us to move quickly with confidence, knowing that type errors are caught at compile time rather than in production.

## Resources

- [tRPC Documentation](https://trpc.io/)
- [tRPC with AWS Lambda](https://trpc.io/docs/server/adapters/aws-lambda)
- [Zod Documentation](https://zod.dev/)
- [Type-Safe API Development](https://www.typescriptlang.org/docs/handbook/advanced-types.html)

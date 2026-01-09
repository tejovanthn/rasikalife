# tRPC Skill

End-to-end typesafe APIs with tRPC for Remix/React + SST serverless applications.

## Core Concepts

**tRPC Benefits:**
- End-to-end type safety
- No code generation needed
- Auto-complete in client
- Inference of types from server
- Built-in validation with Zod
- Lightweight

**Key Terms:**
- **Router**: Collection of procedures
- **Procedure**: API endpoint (query or mutation)
- **Context**: Request-scoped data (user, db, etc.)
- **Middleware**: Reusable logic for procedures

## Installation

```bash
# Server dependencies
npm install @trpc/server zod

# Client dependencies  
npm install @trpc/client @trpc/react-query @tanstack/react-query

# Remix adapter
npm install @trpc/remix-adapter
```

## Server Setup

### 1. Create tRPC Instance

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server"
import { z } from "zod"

// Context type
export type Context = {
  userId?: string
  db: PrismaClient
}

// Initialize tRPC
const t = initTRPC.context<Context>().create()

// Export reusable pieces
export const router = t.router
export const publicProcedure = t.procedure

// Protected procedure middleware
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthed)
```

### 2. Create Context

```typescript
// server/context.ts
import { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { prisma } from "./db"
import { getUserFromToken } from "./auth"

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Get user from authorization header
  const token = req.headers.authorization?.replace("Bearer ", "")
  const userId = token ? await getUserFromToken(token) : undefined
  
  return {
    userId,
    db: prisma,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

### 3. Define Routers

```typescript
// server/routers/user.router.ts
import { router, publicProcedure, protectedProcedure } from "../trpc"
import { z } from "zod"

export const userRouter = router({
  // Query: Get user by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true, name: true },
      })
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      }
      return user
    }),

  // Query: Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.userId },
    })
  }),

  // Mutation: Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.user.update({
        where: { id: ctx.userId },
        data: input,
      })
    }),

  // Query with pagination
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const users = await ctx.db.user.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      })
      
      let nextCursor: string | undefined = undefined
      if (users.length > input.limit) {
        const nextItem = users.pop()
        nextCursor = nextItem!.id
      }
      
      return {
        users,
        nextCursor,
      }
    }),
})
```

```typescript
// server/routers/post.router.ts
export const postRouter = router({
  // Get all posts
  list: publicProcedure
    .input(
      z.object({
        authorId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db.post.findMany({
        where: { authorId: input.authorId },
        include: { author: true },
        orderBy: { createdAt: "desc" },
      })
    }),

  // Create post
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(1),
        published: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.post.create({
        data: {
          ...input,
          authorId: ctx.userId,
        },
      })
    }),

  // Delete post
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.db.post.findUnique({
        where: { id: input.id },
      })
      
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      
      if (post.authorId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      
      return await ctx.db.post.delete({
        where: { id: input.id },
      })
    }),
})
```

### 4. Combine Routers

```typescript
// server/index.ts
import { router } from "./trpc"
import { userRouter } from "./routers/user.router"
import { postRouter } from "./routers/post.router"

export const appRouter = router({
  user: userRouter,
  post: postRouter,
})

export type AppRouter = typeof appRouter
```

## Integration with SST

### Lambda Handler

```typescript
// functions/trpc.handler.ts
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda"
import { appRouter } from "../server"
import { createContext } from "../server/context"

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
})
```

### SST Configuration

```typescript
// sst.config.ts
export default {
  config() {
    return { name: "my-app", region: "us-east-1" }
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const api = new Api(stack, "api", {
        routes: {
          "POST /trpc/{proxy+}": "functions/trpc.handler",
        },
      })
      
      new RemixSite(stack, "site", {
        environment: {
          API_URL: api.url,
        },
      })
    })
  },
}
```

## Client Setup

### 1. Create tRPC Client

```typescript
// app/lib/trpc.ts
import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "../../server"

export const trpc = createTRPCReact<AppRouter>()
```

### 2. Provider Setup (Remix)

```typescript
// app/root.tsx
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { trpc } from "./lib/trpc"

export function Root() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.API_URL}/trpc`,
          headers() {
            const token = localStorage.getItem("token")
            return {
              authorization: token ? `Bearer ${token}` : "",
            }
          },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

## Client Usage

### Queries

```typescript
// app/routes/users.$id.tsx
import { trpc } from "~/lib/trpc"

export default function UserProfile() {
  const { id } = useParams()
  
  // Simple query
  const { data: user, isLoading, error } = trpc.user.getById.useQuery({
    id: id!,
  })
  
  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### Mutations

```typescript
// app/routes/profile.edit.tsx
import { trpc } from "~/lib/trpc"

export default function EditProfile() {
  const utils = trpc.useUtils()
  
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.user.me.invalidate()
    },
  })
  
  const handleSubmit = (data: { name: string; bio: string }) => {
    updateProfile.mutate(data)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />
      <textarea name="bio" />
      <button type="submit" disabled={updateProfile.isLoading}>
        {updateProfile.isLoading ? "Saving..." : "Save"}
      </button>
    </form>
  )
}
```

### Infinite Queries

```typescript
// app/routes/users.tsx
export default function UsersList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.user.list.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )
  
  return (
    <div>
      {data?.pages.map((page) =>
        page.users.map((user) => <UserCard key={user.id} user={user} />)
      )}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  )
}
```

### Optimistic Updates

```typescript
export default function TodoList() {
  const utils = trpc.useUtils()
  
  const addTodo = trpc.todo.create.useMutation({
    onMutate: async (newTodo) => {
      // Cancel outgoing refetches
      await utils.todo.list.cancel()
      
      // Snapshot current data
      const previousTodos = utils.todo.list.getData()
      
      // Optimistically update
      utils.todo.list.setData(undefined, (old) => [
        ...(old ?? []),
        { id: "temp-id", ...newTodo, createdAt: new Date() },
      ])
      
      return { previousTodos }
    },
    onError: (err, newTodo, context) => {
      // Rollback on error
      utils.todo.list.setData(undefined, context?.previousTodos)
    },
    onSettled: () => {
      // Refetch after error or success
      utils.todo.list.invalidate()
    },
  })
  
  return (
    <button onClick={() => addTodo.mutate({ title: "New todo" })}>
      Add Todo
    </button>
  )
}
```

## Advanced Patterns

### Subscriptions (WebSocket)

```typescript
// server/trpc.ts
import { observable } from "@trpc/server/observable"
import { EventEmitter } from "events"

const ee = new EventEmitter()

export const postRouter = router({
  onAdd: publicProcedure.subscription(() => {
    return observable<Post>((emit) => {
      const onAdd = (data: Post) => emit.next(data)
      ee.on("add", onAdd)
      return () => {
        ee.off("add", onAdd)
      }
    })
  }),
})

// Trigger subscription
await ctx.db.post.create({ data: input })
ee.emit("add", post)
```

### Batching

```typescript
// Client automatically batches requests made within 10ms
const [user, posts] = await Promise.all([
  trpc.user.getById.query({ id: "1" }),
  trpc.post.list.query({ authorId: "1" }),
])
// Results in a single HTTP request
```

### Error Handling

```typescript
// Custom error formatter
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// Client-side error handling
const mutation = trpc.user.create.useMutation({
  onError: (error) => {
    if (error.data?.zodError) {
      // Handle validation errors
      console.log(error.data.zodError.fieldErrors)
    }
  },
})
```

## Testing

### Unit Testing Procedures

```typescript
import { describe, test, expect } from "vitest"
import { createCallerFactory } from "@trpc/server"
import { appRouter } from "./server"

const createCaller = createCallerFactory(appRouter)

describe("user router", () => {
  test("getById returns user", async () => {
    const caller = createCaller({
      userId: undefined,
      db: mockDb,
    })
    
    const user = await caller.user.getById({ id: "1" })
    expect(user).toEqual({ id: "1", name: "Test User" })
  })
  
  test("me requires auth", async () => {
    const caller = createCaller({
      userId: undefined,
      db: mockDb,
    })
    
    await expect(caller.user.me()).rejects.toThrow("UNAUTHORIZED")
  })
})
```

### Integration Testing

```typescript
import { createHTTPServer } from "@trpc/server/adapters/standalone"

test("full request cycle", async () => {
  const server = createHTTPServer({
    router: appRouter,
    createContext,
  })
  
  const response = await fetch("http://localhost:3000/trpc/user.getById", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "1" }),
  })
  
  const data = await response.json()
  expect(data.result.data).toEqual({ id: "1", name: "Test" })
})
```

## Best Practices

1. **Use Zod for validation**: All inputs should have Zod schemas
2. **Type your context**: Strong typing on context prevents errors
3. **Middleware for common logic**: Auth, logging, rate limiting
4. **Error codes**: Use semantic error codes (UNAUTHORIZED, NOT_FOUND)
5. **Batching**: Let client batch automatically, don't optimize manually
6. **Optimistic updates**: Use for better UX on mutations
7. **Query invalidation**: Invalidate related queries after mutations
8. **Separate routers**: Keep routers focused on single resource
9. **Protected procedures**: Create reusable protected procedure for auth
10. **Testing**: Test procedures as functions, not through HTTP

## Common Gotchas

1. **Context caching**: Context is created per request, don't cache
2. **Subscription setup**: Needs WebSocket transport, not HTTP
3. **Error serialization**: Non-Error objects won't serialize properly
4. **Input validation**: Always validate, even on trusted clients
5. **CORS**: Configure CORS properly for cross-origin requests
6. **Batching URL**: Must use `/trpc/{proxy+}` route pattern
7. **Type imports**: Import types with `import type` for tree-shaking

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [React Query](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev)
- [tRPC Examples](https://github.com/trpc/examples-next-prisma-starter)

# SST Authentication and Authorization Patterns

> **Outdated** — This document describes SST v2 auth patterns. The project uses SST v3 with OpenAuth (see ADR-014 and `packages/auth/`).

*Source: https://v2.sst.dev/auth*
*Version: SST v2 (project uses SST v3)*
*Last Updated: 2025-01-30*

## Overview
SST provides a modern, lightweight authentication system that integrates with your serverless infrastructure. It consists of three main components: `Auth` construct for infrastructure setup, `AuthHandler` for authentication flows, and `Session` library for token management.

## Key Concepts
- **Auth Construct**: Creates necessary infrastructure including RSA key pairs and API routes
- **AuthHandler**: Lambda function handling various authentication providers (OAuth, OIDC, magic links)
- **Session Library**: Stateless JWT-based session management with type safety
- **Resource Binding**: Secure access to auth secrets across your SST application

## Installation
```bash
npm install sst
# Auth is included in SST core
```

## Basic Usage

### Auth Infrastructure Setup
Create auth construct in your stack:

```typescript
// stacks/MyStack.ts
import { Auth } from "sst/constructs";
import { api } from "./api";

const auth = new Auth(stack, "auth", {
  authenticator: {
    handler: "packages/functions/src/auth.handler",
  },
});

auth.attach(stack, { 
  api, 
  prefix: "/auth", // optional - defaults to "/auth"
});
```

### Auth Handler Implementation
Create the authentication handler:

```typescript
// packages/functions/src/auth.ts
import { AuthHandler, GoogleAdapter } from "sst/node/auth";

export const handler = AuthHandler({
  providers: {
    google: GoogleAdapter({
      mode: "oidc",
      clientID: process.env.GOOGLE_CLIENT_ID!,
      onSuccess: async (tokenset) => {
        const claims = tokenset.claims();
        const user = await findOrCreateUser(claims);
        
        return Session.parameter({
          redirect: process.env.FRONTEND_URL!,
          type: "user",
          properties: {
            userId: user.id,
            email: user.email,
            role: user.role,
          },
        });
      },
    }),
  },
});
```

### Define Session Types
Add type safety for sessions:

```typescript
// packages/functions/src/auth.ts
declare module "sst/node/auth" {
  export interface SessionTypes {
    user: {
      userId: string;
      email: string;
      role: 'admin' | 'editor' | 'viewer';
    };
    // Add other session types as needed
    // api_key: { keyId: string };
  }
}
```

### Using Sessions in API Routes
Access authenticated user in your API handlers:

```typescript
// packages/functions/src/api/protected.ts
import { ApiHandler } from "sst/node/api";
import { useSession } from "sst/node/auth";

export const handler = ApiHandler(async (event) => {
  const session = useSession();
  
  if (session.type !== "user") {
    throw new Error("Not authenticated");
  }
  
  // User is authenticated and type-safe
  const { userId, email, role } = session.properties;
  
  if (role !== "admin") {
    throw new Error("Insufficient permissions");
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: "Access granted",
      user: { userId, email, role }
    }),
  };
});
```

## Common Patterns

### Pattern 1: Role-Based Access Control
Create middleware for role checking:

```typescript
// packages/functions/src/middleware/auth.ts
import { TRPCError } from "@trpc/server";
import { useSession } from "sst/node/auth";

export function requireRole(requiredRole: string) {
  return async function roleMiddleware(opts: any) {
    const session = useSession();
    
    if (session.type !== "user") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    
    if (session.properties.role !== requiredRole) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    
    return opts.next({
      ctx: {
        user: session.properties,
      },
    });
  };
}
```

### Pattern 2: Multi-Tenant Authentication
Handle different authentication strategies per tenant:

```typescript
// packages/functions/src/auth.ts
import { createAdapter } from "sst/node/auth";
import { GoogleAdapter, LinkAdapter } from "sst/node/auth";

const googleAdapter = GoogleAdapter({
  mode: "oidc",
  clientID: process.env.GOOGLE_CLIENT_ID!,
  // ... other config
});

const linkAdapter = LinkAdapter({
  onLink: async (link, claims) => {
    // Send magic link via email/SMS
    await sendMagicLink(claims.email, link);
  },
  onSuccess: async (claims) => {
    // Handle magic link callback
  },
});

export const tenantAuth = createAdapter(() => {
  const tenantId = getTenantFromRequest();
  const tenant = getTenantConfig(tenantId);
  
  return tenant.authType === "google" 
    ? googleAdapter() 
    : linkAdapter();
});
```

### Pattern 3: API Key Authentication
Add API key session type:

```typescript
// packages/functions/src/auth.ts
declare module "sst/node/auth" {
  export interface SessionTypes {
    user: { /* ... */ };
    api_key: { 
      keyId: string;
      permissions: string[];
      service: string;
    };
  }
}

// API key validation middleware
export function validateApiKey(requiredPermissions: string[]) {
  return async function apiKeyMiddleware(opts: any) {
    const session = useSession();
    
    if (session.type !== "api_key") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    
    const hasRequiredPerms = requiredPermissions.every(perm =>
      session.properties.permissions.includes(perm)
    );
    
    if (!hasRequiredPerms) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    
    return opts.next();
  };
}
```

### Pattern 4: Session Token Creation
Create sessions programmatically (useful for testing):

```typescript
import { Session } from "sst/node/auth";

// Create a test user session
const testToken = Session.create({
  type: "user",
  properties: {
    userId: "test-user-id",
    email: "test@example.com",
    role: "admin",
  },
});
```

## Integration with tRPC

### Auth Context Setup
```typescript
// packages/trpc/src/context.ts
import { initTRPC } from "@trpc/server";
import { useSession } from "sst/node/auth";

export async function createContext() {
  const session = useSession();
  
  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
export const t = initTRPC.context<Context>().create();
```

### Protected Procedures
```typescript
// packages/trpc/src/router.ts
import { TRPCError } from "@trpc/server";
import { t } from "./context";

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (ctx.session.type !== "user") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  
  return next({
    ctx: {
      user: ctx.session.properties,
    },
  });
});

const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  
  return next();
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = protectedProcedure.use(isAdmin);
```

## Configuration

### Cookie vs Query Parameters
Choose session token delivery method:

```typescript
// Cookie-based (recommended)
return Session.cookie({
  redirect: process.env.FRONTEND_URL!,
  type: "user",
  properties: { /* ... */ },
});

// Query parameter-based
return Session.parameter({
  redirect: process.env.FRONTEND_URL!,
  type: "user",
  properties: { /* ... */ },
});
```

### CORS Configuration for Cookies
If using cookie sessions:

```typescript
// stacks/MyStack.ts
new Api(stack, "api", {
  cors: {
    allowCredentials: true,
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["ANY"],
    allowOrigins: [
      "http://localhost:3000",
      "https://your-production-domain.com",
    ],
  },
});
```

## Gotchas and Best Practices

- **Stateless Design**: SST Auth is completely stateless, no database required for session storage
- **User Management**: Intentionally not included - implement your own user storage logic
- **Token Security**: RSA key pairs are stored as SST secrets and rotated automatically
- **Multi-Tenant Support**: Use custom adapters for tenant-specific auth strategies
- **Performance**: Stateless JWT tokens provide excellent scalability

## Further Reading
- [SST Auth Documentation](https://v2.sst.dev/auth)
- [SST Auth Construct Reference](https://v2.sst.dev/constructs/Auth)
- [SST Session API](https://v2.sst.dev/clients/auth#session)
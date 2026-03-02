# Remix Authentication and Route Protection

> **Outdated** — This approach was superseded by OpenAuth (see ADR-014 and `docs/stack/sst-auth-rbac.md`). The project uses OpenAuth with Google OAuth, not Remix session utilities.

*Source: https://remix.run/docs/en/main/utils/sessions*
*Version: Remix v2*
*Last Updated: 2025-01-30*

## Overview
Remix provides session-based authentication through its session utilities. Sessions are managed per-route basis in `loader` and `action` methods using session storage objects. Remix supports multiple storage backends including cookie-based, file-based, and database-backed sessions.

## Key Concepts
- **Sessions**: Per-request state management using cookies and storage backends
- **Loaders**: Server-side data loading functions where authentication checks happen
- **Actions**: Server-side mutation handlers where auth is validated
- **Route Protection**: Using loaders to restrict access to routes based on authentication state

## Installation
```bash
npm install @remix-run/node
# or @remix-run/cloudflare for Cloudflare Workers
# or @remix-run/deno for Deno
```

## Basic Usage

### Session Storage Setup
Create session configuration in `app/sessions.server.ts`:

```typescript
import { createCookieSessionStorage } from "@remix-run/node";

type SessionData = {
  userId: string;
  userRole: string;
};

type SessionFlashData = {
  error: string;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: "lax",
      secrets: ["s3cret1"],
      secure: true,
    },
  });

export { getSession, commitSession, destroySession };
```

### Route Protection Pattern

#### Protected Route Loader
```typescript
// app/routes/protected.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { getSession } from "~/sessions.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  if (!session.has("userId")) {
    return redirect("/login");
  }

  const userId = session.get("userId");
  const userRole = session.get("userRole");

  // Additional role-based checks
  if (userRole !== "admin" && request.url.includes("/admin")) {
    return redirect("/unauthorized");
  }

  return json({ userId, userRole });
}
```

#### Authentication Action
```typescript
// app/routes/login.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { getSession, commitSession } from "~/sessions.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  // Validate credentials
  const user = await validateCredentials(username, password);
  
  if (!user) {
    session.flash("error", "Invalid credentials");
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  // Set user session data
  session.set("userId", user.id);
  session.set("userRole", user.role);

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

## Common Patterns

### Pattern 1: Centralized Auth Check
Create a reusable auth utility function:

```typescript
// app/utils/auth.server.ts
import { getSession } from "~/sessions.server";
import { redirect } from "@remix-run/node";

export async function requireAuth(
  request: Request,
  redirectTo: string = "/login"
) {
  const session = await getSession(request.headers.get("Cookie"));
  
  if (!session.has("userId")) {
    throw redirect(redirectTo);
  }
  
  return {
    userId: session.get("userId") as string,
    userRole: session.get("userRole") as string,
  };
}

export async function requireRole(
  request: Request,
  requiredRole: string,
  redirectTo: string = "/unauthorized"
) {
  const { userRole } = await requireAuth(request);
  
  if (userRole !== requiredRole) {
    throw redirect(redirectTo);
  }
  
  return userRole;
}
```

### Pattern 2: Route-Based Protection
Use the auth utilities in route loaders:

```typescript
// app/routes/admin.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireRole } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "admin");
  return json({ message: "Admin access granted" });
}
```

### Pattern 3: Parent Route Loader for Auth State
Load auth state in a parent route and inherit in child routes:

```typescript
// app/root.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.has("userId") ? {
    id: session.get("userId"),
    role: session.get("userRole"),
  } : null;
  
  return json({ user });
}

// Child routes can access via useRouteLoaderData
import { useRouteLoaderData } from "@remix-run/react";

export default function SomeRoute() {
  const { user } = useRouteLoaderData("root");
  // user is null if not authenticated
}
```

## Integration with SST

When using SST with Remix, you can integrate SST Auth:

```typescript
// app/utils/auth.server.ts
import { useSession } from "sst/node/auth";

export async function requireAuth(request: Request) {
  const session = getSession(request.headers.get("Cookie"));
  const sstSession = useSession();
  
  if (sstSession.type !== "user") {
    throw redirect("/login");
  }
  
  return sstSession.properties;
}
```

## Gotchas and Best Practices

- **Session Commit Required**: Every time you modify session data, you must `commitSession()` or changes will be lost
- **Race Conditions**: Multiple loaders in one request - be careful with `session.flash()` and `session.unset()`
- **CSRF Protection**: Always use `action` for mutations (login/logout), not `loader`
- **Cookie Security**: Use `secure: true` in production, `httpOnly: true`, and `sameSite: "lax"`
- **Session Size**: Cookie sessions limited to 4KB - use database sessions for larger data

## Further Reading
- [Remix Sessions Documentation](https://remix.run/docs/en/main/utils/sessions)
- [Remix Authentication Guide](https://remix.run/docs/en/main/guides/authentication)
- [SST Auth Documentation](https://v2.sst.dev/auth)
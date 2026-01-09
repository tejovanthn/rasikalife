# Security Practices Skill

Comprehensive security patterns for fullstack serverless applications including authentication, authorization, input validation, and common vulnerability prevention.

## Core Principles

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Grant minimum necessary permissions
3. **Fail Securely**: Default to secure state on errors
4. **Never Trust User Input**: Always validate and sanitize
5. **Security by Design**: Build security in from the start

## Authentication

### Session-Based Authentication (Remix)

```typescript
// app/lib/auth.server.ts
import { createCookieSessionStorage, redirect } from "@remix-run/node"
import bcrypt from "bcryptjs"

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) throw new Error("SESSION_SECRET must be set")

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
})

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession()
  session.set("userId", userId)
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  })
}

export async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"))
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request)
  const userId = session.get("userId")
  if (!userId || typeof userId !== "string") return null
  return userId
}

export async function requireUserId(request: Request, redirectTo: string = "/login") {
  const userId = await getUserId(request)
  if (!userId) {
    throw redirect(redirectTo)
  }
  return userId
}

export async function logout(request: Request) {
  const session = await getUserSession(request)
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  })
}

// Password hashing
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
```

### JWT-Based Authentication

```typescript
// lib/jwt.server.ts
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error("JWT_SECRET must be set")

export interface TokenPayload {
  userId: string
  email: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
    issuer: "your-app",
    audience: "your-app-users",
  })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: "your-app",
      audience: "your-app-users",
    })
    return payload as TokenPayload
  } catch (error) {
    return null
  }
}

// Refresh token pattern
export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: "30d",
  })
}

export function verifyRefreshToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; type: string }
    if (payload.type !== "refresh") return null
    return payload.userId
  } catch (error) {
    return null
  }
}
```

### OAuth2 Integration

```typescript
// app/lib/oauth.server.ts
import { Authenticator } from "remix-auth"
import { OAuth2Strategy } from "remix-auth-oauth2"
import { sessionStorage } from "./auth.server"

export const authenticator = new Authenticator(sessionStorage)

// Google OAuth
authenticator.use(
  new OAuth2Strategy(
    {
      authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "https://yourapp.com/auth/google/callback",
      scope: "openid email profile",
    },
    async ({ accessToken, refreshToken, extraParams, profile }) => {
      // Find or create user
      const user = await findOrCreateUser({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
      })
      return user
    }
  ),
  "google"
)
```

## Authorization

### Role-Based Access Control (RBAC)

```typescript
// lib/rbac.ts
export enum Role {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  USER = "USER",
}

export enum Permission {
  // User permissions
  USER_READ = "user:read",
  USER_WRITE = "user:write",
  USER_DELETE = "user:delete",
  
  // Content permissions
  CONTENT_READ = "content:read",
  CONTENT_WRITE = "content:write",
  CONTENT_DELETE = "content:delete",
  CONTENT_PUBLISH = "content:publish",
}

const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.USER_READ,
    Permission.USER_WRITE,
    Permission.USER_DELETE,
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.CONTENT_DELETE,
    Permission.CONTENT_PUBLISH,
  ],
  [Role.MANAGER]: [
    Permission.USER_READ,
    Permission.CONTENT_READ,
    Permission.CONTENT_WRITE,
    Permission.CONTENT_PUBLISH,
  ],
  [Role.USER]: [
    Permission.CONTENT_READ,
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission)
}

export function requirePermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error("Insufficient permissions")
  }
}

// Middleware for route protection
export async function requireRole(request: Request, allowedRoles: Role[]) {
  const user = await getCurrentUser(request)
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 })
  }
  return user
}
```

### Resource-Level Authorization

```typescript
// lib/resource-auth.ts
export async function canAccessResource(
  userId: string,
  resourceId: string,
  action: "read" | "write" | "delete"
): Promise<boolean> {
  const resource = await getResource(resourceId)
  
  // Owner can do anything
  if (resource.ownerId === userId) return true
  
  // Check shared permissions
  const permission = await getResourcePermission(resourceId, userId)
  if (!permission) return false
  
  switch (action) {
    case "read":
      return ["read", "write", "admin"].includes(permission.level)
    case "write":
      return ["write", "admin"].includes(permission.level)
    case "delete":
      return permission.level === "admin"
    default:
      return false
  }
}

// Usage in route
export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request)
  const canAccess = await canAccessResource(userId, params.id, "read")
  
  if (!canAccess) {
    throw new Response("Forbidden", { status: 403 })
  }
  
  return json(await getResource(params.id))
}
```

## Input Validation

### Zod Validation

```typescript
import { z } from "zod"

// User registration schema
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[a-z]/, "Password must contain lowercase letter")
    .regex(/[0-9]/, "Password must contain number")
    .regex(/[^A-Za-z0-9]/, "Password must contain special character"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
})

// Sanitize HTML input
import DOMPurify from "isomorphic-dompurify"

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href"],
  })
}

// SQL injection prevention (use ORM or parameterized queries)
// ❌ NEVER do this
const query = `SELECT * FROM users WHERE email = '${userInput}'`

// ✅ DO this (with Prisma)
const user = await prisma.user.findUnique({
  where: { email: userInput },
})
```

## CORS Configuration

```typescript
// SST configuration
export default {
  config() {
    return { name: "my-app", region: "us-east-1" }
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const api = new Api(stack, "api", {
        cors: {
          allowCredentials: true,
          allowHeaders: ["content-type", "authorization"],
          allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowOrigins:
            app.stage === "prod"
              ? ["https://yourapp.com"]
              : ["http://localhost:3000"],
        },
        routes: {
          "GET /users": "functions/users.handler",
        },
      })
    })
  },
}
```

## Rate Limiting

```typescript
// lib/rate-limit.ts
import { DynamoDB } from "@aws-sdk/client-dynamodb"

const dynamodb = new DynamoDB({ region: "us-east-1" })

export async function rateLimit(
  identifier: string,
  limit: number = 100,
  window: number = 60 * 1000 // 1 minute
): Promise<boolean> {
  const now = Date.now()
  const key = `ratelimit:${identifier}:${Math.floor(now / window)}`
  
  try {
    await dynamodb.updateItem({
      TableName: "RateLimits",
      Key: { key: { S: key } },
      UpdateExpression: "ADD requests :inc SET #ttl = :ttl",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":inc": { N: "1" },
        ":ttl": { N: String(Math.floor((now + window) / 1000)) },
      },
      ConditionExpression: "attribute_not_exists(requests) OR requests < :limit",
      ExpressionAttributeValues: {
        ...{ ":limit": { N: String(limit) } },
      },
    })
    return true
  } catch (error) {
    return false // Rate limit exceeded
  }
}

// Usage in API route
export async function handler(event: APIGatewayProxyEvent) {
  const ip = event.requestContext.identity.sourceIp
  const allowed = await rateLimit(ip, 100, 60000)
  
  if (!allowed) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: "Too many requests" }),
    }
  }
  
  // Process request
}
```

## Secrets Management with SST

```typescript
// sst.config.ts
import { Config } from "sst/constructs"

export default {
  config() {
    return { name: "my-app", region: "us-east-1" }
  },
  stacks(app) {
    app.stack(function Api({ stack }) {
      // Define secrets
      const DATABASE_URL = new Config.Secret(stack, "DATABASE_URL")
      const JWT_SECRET = new Config.Secret(stack, "JWT_SECRET")
      const STRIPE_SECRET_KEY = new Config.Secret(stack, "STRIPE_SECRET_KEY")
      
      const api = new Api(stack, "api", {
        bind: [DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY],
        routes: {
          "GET /users": "functions/users.handler",
        },
      })
    })
  },
}

// Set secrets
// sst secrets set DATABASE_URL "postgres://..."
// sst secrets set JWT_SECRET "your-secret"

// Access in Lambda
import { Config } from "sst/node/config"

export async function handler() {
  const dbUrl = Config.DATABASE_URL
  const jwtSecret = Config.JWT_SECRET
  // Use secrets
}
```

## Security Headers

```typescript
// app/root.tsx (Remix)
export function headers() {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.yourapp.com",
    ].join("; "),
  }
}
```

## Common Vulnerabilities & Prevention

### XSS (Cross-Site Scripting)

```typescript
// ❌ Dangerous - renders raw HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Safe - React escapes by default
<div>{userInput}</div>

// ✅ Safe - sanitize if you need HTML
import DOMPurify from "isomorphic-dompurify"
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### CSRF (Cross-Site Request Forgery)

```typescript
// Remix protects against CSRF automatically with form submissions
// For API endpoints, use CSRF tokens

import { createCookie } from "@remix-run/node"

const csrfCookie = createCookie("csrf", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60, // 1 hour
})

export async function validateCsrfToken(request: Request) {
  const cookie = await csrfCookie.parse(request.headers.get("Cookie"))
  const header = request.headers.get("X-CSRF-Token")
  
  if (!cookie || cookie !== header) {
    throw new Error("Invalid CSRF token")
  }
}
```

### SQL Injection

```typescript
// ❌ NEVER concatenate user input into SQL
const users = await db.raw(`SELECT * FROM users WHERE email = '${email}'`)

// ✅ Use parameterized queries or ORM
const users = await db.raw("SELECT * FROM users WHERE email = ?", [email])

// ✅ Best: Use Prisma/Drizzle
const user = await prisma.user.findUnique({ where: { email } })
```

## Best Practices Checklist

- [ ] **Authentication**: Use secure session management or JWTs
- [ ] **Passwords**: Hash with bcrypt (10+ rounds), enforce strong password policy
- [ ] **Authorization**: Implement RBAC or resource-level permissions
- [ ] **Input Validation**: Validate and sanitize all user input with Zod
- [ ] **HTTPS**: Always use HTTPS in production
- [ ] **CORS**: Configure strict CORS policies
- [ ] **Rate Limiting**: Implement rate limiting on APIs
- [ ] **Secrets**: Use SST Config.Secret, never commit secrets
- [ ] **Security Headers**: Set appropriate security headers
- [ ] **XSS Prevention**: Sanitize HTML, use React's default escaping
- [ ] **CSRF Protection**: Use CSRF tokens for state-changing operations
- [ ] **SQL Injection**: Use ORMs or parameterized queries
- [ ] **Dependencies**: Regularly update dependencies, use `npm audit`
- [ ] **Logging**: Log security events, but never log sensitive data
- [ ] **Error Messages**: Don't expose stack traces or internal details to users

## Testing Security

```typescript
// Test authentication
test("requires authentication", async () => {
  const response = await fetch("/api/protected")
  expect(response.status).toBe(401)
})

// Test authorization
test("requires admin role", async () => {
  const userToken = await getToken({ role: "USER" })
  const response = await fetch("/api/admin", {
    headers: { Authorization: `Bearer ${userToken}` },
  })
  expect(response.status).toBe(403)
})

// Test input validation
test("rejects invalid email", async () => {
  const response = await fetch("/api/register", {
    method: "POST",
    body: JSON.stringify({ email: "invalid", password: "test123" }),
  })
  expect(response.status).toBe(400)
})

// Test rate limiting
test("rate limits excessive requests", async () => {
  const requests = Array.from({ length: 101 }, () => 
    fetch("/api/endpoint")
  )
  const responses = await Promise.all(requests)
  const rateLimited = responses.some(r => r.status === 429)
  expect(rateLimited).toBe(true)
})
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Remix Auth](https://github.com/sergiodxa/remix-auth)
- [Zod Documentation](https://zod.dev)
- [DOMPurify](https://github.com/cure53/DOMPurify)

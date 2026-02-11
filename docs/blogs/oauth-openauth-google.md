# OAuth with OpenAuth & Google - Modern Authentication

## Introduction

Authentication is a critical component of modern web applications, but implementing OAuth correctly can be complex and error-prone. OpenAuth provides a modern, type-safe approach to OAuth 2.0 / OIDC authentication. This blog post explores our Google OAuth integration using OpenAuth, covering provider setup, custom success handlers, profile photo management, and security best practices.

**Related ADRs:**
- [ADR-007: RBAC System Implementation](../adrs/adr-007-rbac-system-implementation.md)
- [ADR-009: Overall Architecture Patterns](../adrs/adr-009-overall-architecture-patterns.md)

## The Authentication Challenge

### Requirements
- **OAuth 2.0 / OIDC**: Industry-standard authentication protocol
- **Google Integration**: Sign in with Google
- **User Management**: Create or lookup users on first login
- **Profile Data**: Store user profile information and photos
- **Type Safety**: Type-safe throughout the auth flow
- **Secure**: Follow OAuth security best practices
- **Flexible**: Support multiple OAuth providers in the future

### Traditional OAuth Challenges

```typescript
// Manual OAuth implementation (problematic)
export async function handleGoogleCallback(code: string) {
  // 1. Exchange code for tokens (many edge cases)
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  // 2. Validate tokens (JWT verification, nonce, state)
  // 3. Fetch user info
  // 4. Handle errors and edge cases
  // ... many lines of complex code
}

// Problems:
// - Token validation complexity
// - CSRF/state management
// - PKCE implementation
// - Refresh token handling
// - Error handling
// - Testing difficulty
```

## OpenAuth Architecture

### Overview

OpenAuth provides:
- **Provider abstraction**: Unified interface for OAuth providers
- **Security built-in**: PKCE, state, nonce validation
- **Type safety**: Fully typed with TypeScript
- **SST integration**: Works seamlessly with SST v3
- **Subjects**: Type-safe user identification

**Related Reading:** [SST v3 Infrastructure Patterns](./sst-infrastructure-patterns.md)

### Issuer Setup

```typescript
// packages/auth/src/issuer.ts
import { issuer } from '@openauthjs/openauth';
import { GoogleProvider } from '@openauthjs/openauth/provider/google';
import { Auth, User } from '@rasika/core';
import { handle } from 'hono/aws-lambda';
import { Resource } from 'sst';

const app = issuer({
  // Configure allowed redirect URIs
  allow: async input => {
    const url = new URL(input.redirectURI);
    // Allow localhost for dev and the production domain
    if (
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.rasika.life') ||
      url.hostname === 'rasika.life'
    ) {
      return true;
    }
    return false;
  },

  // Configure OAuth providers
  providers: {
    google: GoogleProvider({
      clientID: Resource.GoogleClientId.value,
      clientSecret: Resource.GoogleClientSecret.value,
      scopes: ['openid', 'email', 'profile'],
    }),
  },

  // Error handling
  error(ctx, error) {
    console.error('[issuer] OAuth error:', {
      error: error.error,
      description: error.description,
      url: ctx.req.url,
      headers: Object.fromEntries(ctx.req.raw.headers.entries()),
    });
    return ctx.error(error.error, error.description);
  },

  // Define subjects (user types)
  subjects: Auth.subjects,

  // Success handler - called after successful OAuth
  async success(ctx, value) {
    if (value.provider === 'google') {
      // Handle Google-specific logic
      return await handleGoogleSuccess(ctx, value);
    }

    throw new Error('Unsupported provider');
  },
});

export const handler = handle(app);
```

## Subjects Definition

### Type-Safe User Identification

```typescript
// packages/core/src/auth/subjects.ts
import { createSubjects } from '@openauthjs/openauth/subject';
import { z } from 'zod';

/**
 * Shared OpenAuth subjects schema
 * Used by both the issuer and client for token verification
 */
export const subjects = createSubjects({
  user: z.object({
    userID: z.string(),
  }),
});

export type Subjects = typeof subjects;
```

**Why Subjects?**
- **Type safety**: Subject types enforced throughout the auth flow
- **Flexibility**: Support multiple subject types (user, admin, service)
- **Verification**: Automatic token verification against subject schema
- **Serialization**: Subjects are serialized into JWT tokens

## Google OAuth Integration

### Success Handler Implementation

```typescript
// packages/auth/src/issuer.ts
async function handleGoogleSuccess(ctx, value) {
  const tokenset = value.tokenset;

  // 1. Fetch user info using the access token
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenset.access}`,
    },
  });
  const userInfo = await response.json();

  // 2. Extract user information
  const email = userInfo.email as string;
  const name = userInfo.name as string;
  const googlePicture = userInfo.picture as string | undefined;
  const sub = userInfo.id as string;

  // 3. Find or create user in database
  const user = await User.findOrCreateUser({
    email,
    name,
    googleId: sub,
  });

  // 4. Upload profile photo to S3 (if available and not already set)
  if (googlePicture && !user.picture) {
    const picture = await uploadProfilePhoto(googlePicture, user.id);
    if (picture) {
      await User.updateUser(user.id, { picture });
    }
  }

  // 5. Return subject for token generation
  return ctx.subject('user', {
    userID: user.id,
  });
}
```

### User Find or Create

```typescript
// packages/core/src/domain/user/service.ts
import { ROLE } from '../../auth/roles';

export async function findOrCreateUser(input: {
  email: string;
  name: string;
  googleId: string;
}): Promise<User> {
  // Try to find existing user by googleId
  let user = await getUserByGoogleId(input.googleId);

  if (user) {
    return user;
  }

  // Try to find by email (for users who signed up with email first)
  user = await getUserByEmail(input.email);

  if (user) {
    // Link Google account to existing user
    await updateUser(user.id, { googleId: input.googleId });
    return user;
  }

  // Create new user with default role
  return await createUser({
    email: input.email,
    name: input.name,
    googleId: input.googleId,
    role: ROLE.EDITOR,  // Default role for new users
    isActive: true,
  });
}
```

**Related Reading:** [RBAC with Simple Permissions](./rbac-simple-permissions.md)

## Profile Photo Management

### Downloading from Google

```typescript
// packages/auth/src/issuer.ts
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Resource } from 'sst';

const s3Client = new S3Client({});

/**
 * Downloads a profile photo from Google and uploads it to S3.
 * Returns the S3 URL on success, or undefined on failure.
 */
async function uploadProfilePhoto(
  googlePhotoUrl: string,
  userId: string
): Promise<string | undefined> {
  try {
    // 1. Download from Google
    const response = await fetch(googlePhotoUrl);
    if (!response.ok) {
      console.error('[issuer] Failed to download profile photo:', response.status);
      return undefined;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 2. Upload to S3
    const key = `profile-photos/${userId}.jpg`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: Resource.RasikaBucket.name,
        Key: key,
        Body: Buffer.from(buffer),
        ContentType: contentType,
      })
    );

    // 3. Return public URL
    return `https://${Resource.RasikaBucket.name}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('[issuer] Failed to upload profile photo:', error);
    return undefined;
  }
}
```

### Why Store Photos in S3?

**Benefits:**
- **Performance**: Fast CDN delivery
- **Control**: Own the photo URL (Google URLs can expire)
- **Privacy**: No external tracking
- **Reliability**: Not dependent on Google's availability
- **Customization**: Can process/resize images

**Considerations:**
- **Storage cost**: S3 storage is inexpensive
- **Bandwidth**: CloudFront CDN for efficient delivery
- **Updates**: User can change photo independently

## Infrastructure Setup

### SST Configuration

```typescript
// infra/auth.ts
import { database } from './database';
import { getDomain } from './domain';
import { bucket } from './storage';

// Google OAuth secrets
const googleClientId = new sst.Secret('GoogleClientId');
const googleClientSecret = new sst.Secret('GoogleClientSecret');

export const auth = new sst.aws.Auth('RasikaAuth', {
  domain: getDomain('auth'),
  issuer: {
    handler: 'packages/auth/src/issuer.handler',
    link: [database, googleClientId, googleClientSecret, bucket],
    environment: {
      DYNAMODB_TABLE: database.name,
      AWS_REGION: undefined,
    },
  },
});
```

### Secrets Management

```bash
# Set secrets for development
sst secret set GoogleClientId "your-client-id"
sst secret set GoogleClientSecret "your-client-secret"

# Secrets are automatically encrypted and stored in AWS
# Different secrets per stage (dev, staging, prod)
```

**Related Reading:** [SST v3 Infrastructure Patterns](./sst-infrastructure-patterns.md)

## Client-Side Integration

### Remix Auth Client

```typescript
// packages/web/app/lib/auth.server.ts
import { subjects } from '@rasika/core';
import { createClient } from '@openauthjs/openauth/client';

export const authClient = createClient({
  clientID: 'web',
  issuer: process.env.AUTH_URL || 'http://localhost:3000/auth',
  subjects,
});

// Get user from request
export async function getUserFromRequest(request: Request): Promise<User | null> {
  try {
    // Verify token from cookie
    const token = await authClient.verify(subjects, request.headers.get('cookie') || '');

    if (!token || token.type !== 'user') {
      return null;
    }

    // Fetch full user data
    return await User.getUser(token.properties.userID);
  } catch (error) {
    console.error('Failed to verify token:', error);
    return null;
  }
}
```

### Login Flow

```tsx
// packages/web/app/routes/auth.login.tsx
import { redirect } from '@remix-run/node';
import { authClient } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect to Google OAuth
  const url = authClient.authorize(
    new URL(request.url).origin + '/auth/callback',
    'google'
  );

  return redirect(url);
}

// User navigates to: /auth/login
// Redirected to: https://accounts.google.com/o/oauth2/v2/auth?...
```

### Callback Handler

```tsx
// packages/web/app/routes/auth.callback.tsx
import { redirect } from '@remix-run/node';
import { authClient } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  try {
    // Exchange code for tokens
    const tokens = await authClient.exchange(url.searchParams.get('code')!, url.origin + '/auth/callback');

    // Set cookie with tokens
    const response = redirect('/');
    response.headers.set('Set-Cookie', await authClient.setCookie(tokens));

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirect('/login?error=oauth_failed');
  }
}

// Google redirects to: /auth/callback?code=...&state=...
// User gets logged in and redirected to: /
```

### Logout Flow

```tsx
// packages/web/app/routes/auth.logout.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const response = redirect('/');

  // Clear auth cookie
  response.headers.set(
    'Set-Cookie',
    'auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  return response;
}
```

## Protected Routes

### Route Protection

```tsx
// packages/web/app/routes/profile.tsx
import { redirect } from '@remix-run/node';
import { getUserFromRequest } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromRequest(request);

  if (!user) {
    // Redirect to login if not authenticated
    return redirect('/auth/login');
  }

  return json({ user });
}

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Profile</h1>
      <img src={user.picture} alt={user.name} />
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

### Role-Based Route Protection

```tsx
// packages/web/app/routes/admin._index.tsx
import { redirect } from '@remix-run/node';
import { getUserFromRequest } from '~/lib/auth.server';
import { ROLE } from '@rasika/core';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return redirect('/auth/login');
  }

  if (user.role !== ROLE.ADMIN) {
    throw new Response('Forbidden', { status: 403 });
  }

  return json({ user });
}
```

## Security Considerations

### PKCE (Proof Key for Code Exchange)

OpenAuth automatically implements PKCE:
- **Code challenge**: Generated on authorization request
- **Code verifier**: Sent on token exchange
- **Protection**: Prevents authorization code interception attacks

### State Parameter

OpenAuth handles state management:
- **CSRF protection**: State parameter prevents cross-site attacks
- **Automatic validation**: State is verified on callback
- **Session binding**: Links authorization request to callback

### Token Storage

```typescript
// Secure cookie configuration
const cookieOptions = {
  httpOnly: true,     // Not accessible via JavaScript
  secure: true,       // HTTPS only
  sameSite: 'lax',    // CSRF protection
  path: '/',
  maxAge: 60 * 60 * 24 * 7,  // 7 days
};
```

### Redirect URI Validation

```typescript
// Always validate redirect URIs
allow: async input => {
  const url = new URL(input.redirectURI);

  // Whitelist approach
  const allowedDomains = [
    'localhost',
    'rasika.life',
    '*.rasika.life',
  ];

  return allowedDomains.some(domain =>
    url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  );
}
```

## Error Handling

### OAuth Error Handling

```typescript
// packages/auth/src/issuer.ts
error(ctx, error) {
  // Log detailed error information
  console.error('[issuer] OAuth error:', {
    error: error.error,
    description: error.description,
    url: ctx.req.url,
    headers: Object.fromEntries(ctx.req.raw.headers.entries()),
  });

  // Return user-friendly error
  return ctx.error(error.error, error.description);
}
```

### Common OAuth Errors

```typescript
// Handle common OAuth error scenarios
export async function handleOAuthError(error: unknown): Promise<string> {
  if (error instanceof Error) {
    switch (error.message) {
      case 'invalid_grant':
        return 'Authorization code expired or invalid. Please try again.';

      case 'access_denied':
        return 'You denied access. Please authorize to continue.';

      case 'unauthorized_client':
        return 'Application not authorized. Please contact support.';

      default:
        return 'Authentication failed. Please try again.';
    }
  }

  return 'Unknown error occurred';
}
```

**Related Reading:** [Troubleshooting Auth Invalid Grant](../troubleshooting/auth-invalid-grant.md)

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { findOrCreateUser } from '@rasika/core';

describe('User Authentication', () => {
  it('should create new user on first login', async () => {
    const result = await findOrCreateUser({
      email: 'test@example.com',
      name: 'Test User',
      googleId: 'google-123',
    });

    expect(result).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
      googleId: 'google-123',
      role: ROLE.EDITOR,
    });
  });

  it('should return existing user on subsequent login', async () => {
    const user1 = await findOrCreateUser({
      email: 'test@example.com',
      name: 'Test User',
      googleId: 'google-123',
    });

    const user2 = await findOrCreateUser({
      email: 'test@example.com',
      name: 'Test User',
      googleId: 'google-123',
    });

    expect(user1.id).toBe(user2.id);
  });
});
```

### Integration Tests

```typescript
describe('OAuth Flow', () => {
  it('should complete full OAuth flow', async () => {
    // 1. Request authorization
    const authUrl = authClient.authorize('http://localhost:3000/callback', 'google');
    expect(authUrl).toContain('accounts.google.com');

    // 2. Mock OAuth callback
    const mockCode = 'mock-auth-code';

    // 3. Exchange code for tokens
    const tokens = await authClient.exchange(mockCode, 'http://localhost:3000/callback');

    expect(tokens).toHaveProperty('access');
    expect(tokens).toHaveProperty('refresh');
  });
});
```

## Best Practices

### 1. Always Validate Redirect URIs
```typescript
// Use strict whitelist
allow: async input => {
  const allowed = ['localhost', 'rasika.life'];
  return allowed.some(domain => new URL(input.redirectURI).hostname === domain);
}
```

### 2. Handle Profile Photo Failures Gracefully
```typescript
// Don't fail login if photo upload fails
if (googlePicture && !user.picture) {
  try {
    const picture = await uploadProfilePhoto(googlePicture, user.id);
    if (picture) {
      await User.updateUser(user.id, { picture });
    }
  } catch (error) {
    console.error('Profile photo upload failed:', error);
    // Continue with login
  }
}
```

### 3. Use Subjects for Type Safety
```typescript
// Define subjects with Zod for validation
export const subjects = createSubjects({
  user: z.object({
    userID: z.string(),
  }),
});
```

### 4. Store Minimal Data in Tokens
```typescript
// Only store user ID in token, fetch full data as needed
return ctx.subject('user', {
  userID: user.id,  // Only ID in token
});
```

### 5. Implement Proper Error Logging
```typescript
// Log errors with context for debugging
console.error('[issuer] OAuth error:', {
  error: error.error,
  description: error.description,
  url: ctx.req.url,
});
```

## Common Pitfalls

### 1. Exposing Secrets in Client Code
**Problem**: Including secrets in frontend code

**Solution**: Keep secrets in server-side code only

### 2. Not Validating Redirect URIs
**Problem**: Open redirect vulnerability

**Solution**: Strict whitelist of allowed redirect URIs

### 3. Storing Too Much in Tokens
**Problem**: Large token payload

**Solution**: Store only user ID, fetch full data when needed

### 4. Not Handling Token Expiration
**Problem**: User logged out unexpectedly

**Solution**: Implement refresh token logic

## Conclusion

OpenAuth provides a modern, type-safe approach to OAuth 2.0 / OIDC authentication. By handling the complexity of OAuth flows, security features, and token management, it enables developers to focus on application logic rather than authentication plumbing.

For the Rasika.life platform, OpenAuth enables secure Google Sign-In with minimal code, while maintaining full type safety and security best practices throughout the authentication flow.

**Related Reading:**
- [RBAC with Simple Permissions](./rbac-simple-permissions.md)
- [tRPC Type-Safe API Layer](./trpc-type-safe-api-layer.md)
- [SST v3 Infrastructure Patterns](./sst-infrastructure-patterns.md)

## Resources

- [OpenAuth Documentation](https://openauth.js.org/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [SST Auth](https://sst.dev/docs/component/aws/auth)

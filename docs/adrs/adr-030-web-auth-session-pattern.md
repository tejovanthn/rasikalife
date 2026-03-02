# ADR-030: Web Authentication Pattern — Cookie Sessions + Per-Request tRPC JWT

## Status
Accepted

## Context
The web app (React Router v7) needs to:
1. Persist authentication state across requests (user is logged in)
2. Make authenticated calls to the tRPC API from server-side loaders and actions
3. Integrate with the OpenAuth issuer (a separate Lambda/Hono service)

Several concerns interact here: where to store tokens, how to verify them per-request, how to inject them into tRPC calls, and how to handle token expiry.

## Decision
Use **React Router cookie sessions** to store JWT tokens, with **per-request tRPC client creation** that injects the access token as a `Bearer` header. Token verification is delegated to the **OpenAuth client** on every `getUser()` call.

### Flow

**Login:**
1. User is redirected to OpenAuth issuer (`/auth/login`)
2. OpenAuth handles Google OAuth, issues JWT access + refresh tokens
3. Callback route stores tokens in a signed httpOnly cookie session (30-day `maxAge`)

**Per-request auth:**
1. Loader/action calls `getUser(request)` or `requireUser(request)`
2. `getUser` reads tokens from the cookie session
3. Calls `authClient.verify(subjects, accessToken, { refresh: refreshToken })`
4. OpenAuth client handles token refresh transparently if the access token is expired
5. Returns the subject's `userID`, then fetches the user record via tRPC

**Authenticated tRPC calls:**
1. `createServerClient(request)` reads the access token from the session
2. Creates a new `TRPCClient` with `httpBatchLink` and `Authorization: Bearer {token}` header
3. tRPC server extracts and verifies the token in its context middleware

### Cookie configuration
- `httpOnly: true`, `secure: true` (production), `sameSite: lax`
- `maxAge: 30 days`
- Signed with `SESSION_SECRET` env var

## Consequences

### Positive
- ✅ **Simple infrastructure**: No Redis, no DynamoDB sessions — just a signed cookie
- ✅ **Stateless server**: Any Lambda instance can verify any session
- ✅ **Token refresh is automatic**: OpenAuth client handles refresh transparently
- ✅ **Standard patterns**: React Router's `createCookieSessionStorage` is idiomatic
- ✅ **No session store to manage**: Tokens live in the cookie

### Negative
- ❌ **Token verification on every request**: `authClient.verify()` is called per-request; adds latency (network call to OpenAuth issuer)
- ❌ **Cookie size limit**: JWTs + refresh tokens must fit in ~4KB cookie limit
- ❌ **No server-side revocation**: Tokens remain valid until expiry; can't invalidate a specific session
- ❌ **New tRPC client per request**: No connection pooling — acceptable for serverless but different from long-running servers

## Alternatives Considered

### Server-side session store (DynamoDB/Redis)
- **Pros**: Sessions can be revoked, no cookie size limit, smaller cookie
- **Cons**: Adds infrastructure, adds latency on every request, statefulness in a stateless architecture
- **Why rejected**: Overkill for current scale; OpenAuth handles token refresh

### Single shared tRPC client with token injection via context
- **Pros**: Reuse HTTP connection
- **Cons**: Tokens change per-request; thread-safety concerns in shared state; in Lambda every invocation is isolated anyway
- **Why rejected**: Not applicable in Lambda; per-request client is simple and correct

## Implementation Details

- `packages/web/app/lib/auth.server.ts` — session storage, `getUser`, `requireUser`, `requirePermission`, `requireModerator`, `requireAdmin`
- `packages/web/app/api.server.ts` — `client` (public) and `createServerClient(request)` (authenticated)
- `@openauthjs/openauth/client` — `createClient({ clientID, issuer })` for token verification
- RBAC helpers (`requirePermission`, `requireRole`) call `Auth.can()` from `@rasika/core` after verifying the user

## References
- ADR-014: OpenAuth authentication
- ADR-007: RBAC system
- ADR-003: tRPC API layer
- `packages/web/app/lib/auth.server.ts`
- `packages/web/app/api.server.ts`

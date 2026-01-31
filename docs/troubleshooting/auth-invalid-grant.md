# Auth `invalid_grant` Error in Dev Mode

## Problem

When logging in during development, you may encounter an `invalid_grant Bad Request` error from OpenAuth. This typically manifests as:

- Being redirected to `/?error=invalid_grant` after Google authentication
- The callback receiving `error=invalid_grant` instead of an authorization code
- State mismatches between the login flow and callback

## Root Cause

This error occurs when **multiple auth flows overlap or interfere with each other**. The OAuth2/PKCE flow stores state in browser cookies, and when multiple login attempts happen concurrently or stale callbacks arrive, they can corrupt each other.

### Common Scenarios

1. **Multiple login clicks**: User clicks login multiple times while waiting for redirect
2. **Stale browser state**: Old cookies/redirects from previous auth attempts interfere
3. **Browser back/forward navigation**: Triggering callbacks from old flows
4. **Dev server restarts**: Session cookies may persist but server state is reset
5. **Multiple tabs**: Having multiple tabs with pending auth flows

### Technical Details

The auth flow uses PKCE (Proof Key for Code Exchange):
1. `/auth/login` generates a PKCE challenge (state + verifier) and stores it in a session cookie
2. User is redirected to Google via the auth issuer
3. Google redirects back to the auth issuer with an authorization code
4. Auth issuer creates its own code and redirects to `/auth/callback`
5. The callback exchanges the code using the stored verifier

When flows overlap:
- A new login attempt overwrites the PKCE challenge in the session
- The callback from the old flow arrives but can't find its matching challenge
- Or the old flow's callback has an error that overwrites the successful new flow

## Solution

### Immediate Fix

1. **Clear browser data** for `localhost:5173`:
   - Open Chrome DevTools → Application tab
   - Storage → Clear site data (cookies, cache)
2. **Close all browser tabs** for the app
3. **Open ONE fresh tab** and try login again
4. **Click login only ONCE** and wait patiently for the flow to complete

### Preventive Measures (Implemented)

The codebase includes several safeguards:

#### 1. Rate-limiting login attempts (`auth.login.tsx`)
```typescript
// Block new login attempts if one is already in progress (within 2 minutes)
if (existingChallenge && challengeTimestamp) {
  const age = Date.now() - challengeTimestamp;
  if (age < 120000) {
    return redirect('/?error=auth_in_progress');
  }
}
```

#### 2. State validation (`auth.callback.tsx`)
```typescript
// Validate state matches what we stored (prevents cross-flow confusion)
if (state && challenge.state !== state) {
  // This is likely a stale callback from a previous flow - restart login
  return redirect('/auth/login');
}
```

#### 3. Duplicate code protection (`auth.callback.tsx`)
```typescript
// Check if this code was already processed
if (processedCode === code) {
  return redirect('/');
}
```

#### 4. Error cleanup (`auth.callback.tsx`)
```typescript
// On error, clear PKCE challenge so user can retry
if (error) {
  session.unset('pkce_challenge');
  session.unset('pkce_timestamp');
  return redirect(`/?error=${error}`, { ... });
}
```

## Debugging

If the issue persists, add temporary logging to trace the flow:

### In `auth.login.tsx`:
```typescript
console.log('[auth.login] Starting auth flow', {
  callbackUrl,
  timestamp: new Date().toISOString(),
});
```

### In `auth.callback.tsx`:
```typescript
console.log('[auth.callback] Received callback', {
  code: code?.substring(0, 10) + '...',
  state: state?.substring(0, 10) + '...',
  expectedState: challenge.state?.substring(0, 10) + '...',
  statesMatch: challenge.state === state,
});
```

### In the Lambda (SST dev console):
Check for duplicate requests to `/google/callback` - they would indicate the browser is sending multiple redirects.

## Related Files

- `packages/web/app/routes/auth.login.tsx` - Login initiation with rate limiting
- `packages/web/app/routes/auth.callback.tsx` - Callback handling with state validation
- `packages/web/app/lib/auth.server.ts` - Session and token management
- `packages/auth/src/issuer.ts` - OpenAuth issuer configuration

## See Also

- [OpenAuth Documentation](https://openauth.js.org/)
- [SST Auth Component](https://sst.dev/docs/component/aws/auth)
- [OAuth 2.0 PKCE Flow](https://oauth.net/2/pkce/)

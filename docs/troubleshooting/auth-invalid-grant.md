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

## How to Verify Which Layer is Failing

The auth flow has two main layers:
1. **OpenAuth Issuer (Lambda)**: Handles Google OAuth and creates internal auth codes
2. **Remix App**: Exchanges issuer codes for tokens and manages sessions

Check the SST Lambda logs for the complete flow:
```
✓ GET /authorize               - Start auth flow
✓ GET /google/authorize        - Redirect to Google
✓ GET /google/callback         - Google returns with code
✓ POST /token                  - Remix exchanges code (THIS IS KEY!)
```

**If `POST /token` is missing**, the Remix callback didn't run successfully. Check:
- Browser console for `[auth.callback]` error logs
- Browser network tab for redirects to `/?error=...`
- Session cookies might be cleared (hot reload during flow)

## Debugging

### Existing Error Logging (already in codebase):

The codebase includes minimal error logging that triggers only when failures occur:

**In `auth.callback.tsx`:**
- `[auth.callback] Error from OpenAuth:` - Issuer returned an error parameter
- `[auth.callback] Exchange failed:` - Token exchange failed (check error details)
- `[auth.callback] Unexpected error:` - Exception during token exchange

**In `packages/auth/src/issuer.ts`:**
- `[issuer] OAuth error:` - Google OAuth failed (includes error, description, URL, headers)

### Adding Verbose Debug Logging

If you need to trace the full auth flow to diagnose sporadic failures, temporarily add these console logs:

#### In `packages/web/app/routes/auth.callback.tsx`:

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[auth.callback] Invoked');  // ADD THIS
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  console.log('[auth.callback] Params:', {  // ADD THIS
    hasCode: !!code,
    hasState: !!state,
    code: code?.substring(0, 20) + '...',
    state: state?.substring(0, 20) + '...',
  });

  // ... existing error check ...

  try {
    const callbackUrl = `${url.origin}/auth/callback`;
    console.log('[auth.callback] Exchanging code with issuer...', { callbackUrl });  // ADD THIS
    const exchanged = await authClient.exchange(code, callbackUrl, challenge.verifier);

    if (exchanged.err) {
      console.error('[auth.callback] Exchange failed:', exchanged.err);
      return redirect('/?error=exchange_failed');
    }

    console.log('[auth.callback] Exchange successful, storing tokens');  // ADD THIS
    // Store tokens in session...

    console.log('[auth.callback] Redirecting to home with session');  // ADD THIS
    return redirect('/', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (error) {
    console.error('[auth.callback] Unexpected error:', error);
    return redirect('/?error=unexpected');
  }
}
```

#### In `packages/auth/src/issuer.ts`:

```typescript
const app = issuer({
  allow: async input => {
    console.log('[issuer] Validating redirectURI:', input.redirectURI);  // ADD THIS
    const url = new URL(input.redirectURI);
    // ... rest of validation ...
  },
  providers: { /* ... */ },
  async success(ctx, value) {
    console.log('[issuer] Success callback invoked for provider:', value.provider);  // ADD THIS
    if (value.provider === 'google') {
      // ... rest of success handler ...
    }
  },
});
```

#### What to Look For:

Once you've added the logs, try to reproduce the issue and check:

**Browser Console (Remix logs):**
- Does `[auth.callback] Invoked` appear? If not, the redirect from issuer failed
- Does `[auth.callback] Exchanging code with issuer...` appear? If not, it failed before the exchange
- Do you see `Exchange successful` or `Exchange failed`? This tells you if the token exchange worked

**SST Lambda Logs:**
- Is `[issuer] Success callback invoked` present? If not, Google OAuth failed
- Check for duplicate `/google/callback` requests - indicates concurrent auth flows
- Verify `POST /token` appears after the success callback - this is the Remix app exchanging codes

**Remember to remove these verbose logs after debugging** to keep production logs clean.

## Related Files

- `packages/web/app/routes/auth.login.tsx` - Login initiation with rate limiting
- `packages/web/app/routes/auth.callback.tsx` - Callback handling with state validation
- `packages/web/app/lib/auth.server.ts` - Session and token management
- `packages/auth/src/issuer.ts` - OpenAuth issuer configuration

## See Also

- [OpenAuth Documentation](https://openauth.js.org/)
- [SST Auth Component](https://sst.dev/docs/component/aws/auth)
- [OAuth 2.0 PKCE Flow](https://oauth.net/2/pkce/)

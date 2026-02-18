# SST Dev Mode Worker Reboot Bug - Bundle Deletion Race Condition

**Date discovered:** 2026-02-17
**SST versions affected:** 3.17.x, 3.18.x (likely all v3)
**Component:** `sst.aws.Auth` (and potentially any `sst.aws.Function` behind a `Router`/CloudFront)

## Summary

In `sst dev` mode, the worker reboot mechanism deletes the function's `bundle.mjs` from the artifacts directory but does not always rebuild it. Subsequent cold starts of the worker fail because the bundled file no longer exists on disk. This manifests as an intermittent error that causes the function to alternate between working and failing.

## Error

```
Error       packages/auth/src/issuer.handler
The "path" argument must be of type string. Received undefined
  at Object.pathToFileURL (node:url:1018:3)
  at file:///<project>/.sst/platform/dist/nodejs-runtime/index.js:33:24
```

## Root Cause Analysis

### SST Dev Mode Architecture

1. In `sst dev`, Lambda functions are replaced with "bridge" stubs deployed to AWS
2. When a request hits the Lambda, the bridge forwards it to the local dev server via IoT/WebSocket
3. The local dev server spawns a Node.js **Worker thread** for each function (`.sst/platform/dist/nodejs-runtime/loop.js`)
4. The Worker thread loads the bundled handler from `.sst/artifacts/<FunctionName>-dev/bundle.mjs`

### The Bug

When the bridge Lambda receives a new invocation while the dev server's connection state is stale (or from a different Lambda instance), it sends a **"reboot"** message. The reboot mechanism:

1. **Deletes the contents of the artifacts directory** (including `bundle.mjs` and `bundle.mjs.map`)
2. Attempts to create a new worker
3. If a worker already exists, logs `"got reboot but worker already exists"` and **skips the rebuild**
4. The new worker starts with `"running function"` but **no preceding `"building function"` step**
5. The runtime tries to load `bundle.mjs` which no longer exists
6. `fs.existsSync()` returns `false` for all file extensions (.js, .jsx, .mjs, .cjs)
7. `url.pathToFileURL(undefined)` throws the TypeError

### Why It's Intermittent

- **First invocation after build:** Bundle exists, worker loads it successfully
- **Worker stays alive:** Handles requests fine via the 60-second keep-alive loop
- **After reboot trigger:** Bundle deleted, new worker fails
- **Eventually SST rebuilds:** Next file change or event triggers a fresh build, temporarily fixing it

### What Triggers the Reboot

The SST logs show a clear pattern:

```
21:17:46.456 "function built" RasikaAuthIssuer          <- bundle exists
21:17:46.456 "running function" RasikaAuthIssuer         <- worker starts OK
21:18:19.366 "got reboot but worker already exists"      <- ~33s later, reboot requested
21:18:21.511 "got reboot but worker already exists"      <- more reboots
21:18:43.017 "worker init" workerID=29cd3e5c             <- new worker...
21:18:43.017 "running function" RasikaAuthIssuer         <- ...but NO "building function"!
```

The reboot is triggered when:
- The Lambda bridge's connection to the local dev server becomes stale
- CloudFront routes a request to a different Lambda instance (each instance has its own bridge)
- Multiple concurrent Lambda invocations create multiple bridge connections

### Why `sst.aws.Auth` Is Particularly Affected

The `sst.aws.Auth` component creates a **CloudFront Router** in front of the function (when `domain` is set). CloudFront can:
- Route requests to multiple Lambda instances simultaneously
- Maintain connections to different edge locations
- Create new Lambda instances on concurrent requests

This causes multiple bridge connections competing for the same local worker, triggering the reboot cascade.

Regular `sst.aws.Function` with `url: true` (like tRPC) doesn't have a CloudFront layer, so requests go directly to a single Lambda function URL, avoiding the concurrent instance problem.

## Evidence

### Debug output from patched runtime

Added logging to `.sst/platform/dist/nodejs-runtime/index.js`:

```
[SST-DEBUG] handler: "/path/to/.sst/artifacts/RasikaAuthIssuer-dev/bundle.handler"
[SST-DEBUG] looking for: ["bundle.js","bundle.jsx","bundle.mjs","bundle.cjs"]
           exists: [false,false,false,false]
```

The handler path is correct, but ALL files are missing from the artifacts directory.

### Artifacts directory when error occurs

```
$ ls .sst/artifacts/RasikaAuthIssuer-dev/
node_modules -> /path/to/packages/auth/node_modules   (symlink)
resource.enc                                            (config)
                                                        (NO bundle.mjs!)
```

Compare with working tRPC artifacts:
```
$ ls .sst/artifacts/RasikaTRPC-dev/
bundle.mjs          (3.9MB - present!)
bundle.mjs.map
node_modules -> ...
resource.enc
```

### Deleted working directory error

When the artifacts directory is deleted and recreated during reboot, existing workers get:
```
shell-init: error retrieving current directory: getcwd: cannot access parent directories: No such file or directory
```
This confirms the entire directory is being removed and recreated.

## Steps to Reproduce

### Prerequisites
- SST v3 project with `sst.aws.Auth` component
- Auth component configured with a custom `domain` (which creates a CloudFront Router)
- Multiple services that call the auth endpoint (e.g., a tRPC handler that verifies tokens)

### Setup

1. Create an SST v3 project with an Auth component:

```typescript
// infra/auth.ts
export const auth = new sst.aws.Auth('MyAuth', {
  domain: {
    name: 'auth.dev.example.com',
    dns: sst.aws.dns({ zone: 'ZONE_ID' }),
  },
  issuer: {
    handler: './packages/auth/src/issuer.handler',
    link: [/* dependencies */],
  },
});
```

2. Create a function that calls the auth endpoint for token verification:

```typescript
// packages/trpc/src/index.ts
import { createClient } from '@openauthjs/openauth/client';

const authClient = createClient({
  clientID: 'my-api',
  issuer: process.env.AUTH_URL, // Points to auth.dev.example.com
});

// On every request, verify token by calling auth endpoint
const verified = await authClient.verify(subjects, token);
```

3. Create a web app that triggers auth requests on page load

### Reproduction

1. Run `sst dev`
2. Wait for initial build to complete
3. Open the web app (triggers tRPC calls which trigger auth endpoint calls)
4. Watch the SST dev console - within 30-60 seconds you should see:
   - Successful auth invocations
   - `Error: The "path" argument must be of type string. Received undefined`
   - The error alternates with successful invocations

### Verification

Check the SST logs for the reboot pattern:
```bash
strings .sst/log/sst.log | grep "RasikaAuthIssuer" | tail -30
```

Look for:
- `"got reboot but worker already exists"` errors
- `"worker init"` followed by `"running function"` WITHOUT `"building function"` in between
- Multiple worker IDs for the same function

Check the artifacts directory during the error:
```bash
ls .sst/artifacts/<FunctionName>-dev/
# bundle.mjs will be missing
```

## Workaround

Set `dev: false` on the issuer function to disable Live dev mode for the auth handler:

```typescript
export const auth = new sst.aws.Auth('MyAuth', {
  domain: getDomain('auth'),
  issuer: {
    handler: './packages/auth/src/issuer.handler',
    dev: false,  // <-- Deploys real function instead of dev stub
    link: [/* dependencies */],
  },
});
```

This deploys the actual auth handler to Lambda instead of the bridge stub. The auth handler runs directly on AWS, bypassing the local worker mechanism entirely. The trade-off is that changes to the auth handler require a redeploy, but auth handlers rarely change.

## Attempted Fixes That Did NOT Work

| Approach | Result |
|----------|--------|
| Adding `./` prefix to handler path | No effect - SST normalizes paths internally |
| Deleting `.sst/` and `node_modules/` | Issue returned on restart |
| Downgrading/upgrading SST version | Appeared to work initially, regressed on restart |
| Patching runtime with retry loop (Atomics.wait) | Bundle never reappears - SST doesn't rebuild after reboot |
| Patching runtime with shell sleep | `execSync` fails because cwd (artifacts dir) was deleted |
| Removing `domain` from Auth component | Works but impractical - auth needs a stable URL for OAuth |
| Setting `concurrency: { reserved: 1 }` | Minimum Lambda concurrency is 10; doesn't prevent the issue |

## Suggested Fix for SST

The reboot mechanism in the SST dev server (Go backend) should either:

1. **Not delete the bundle during reboot** - preserve the artifacts directory contents when restarting a worker
2. **Always rebuild before running** - if the bundle doesn't exist when a worker starts, trigger an esbuild before `"running function"`
3. **Atomic directory replacement** - build to a temp directory, then atomically swap with the artifacts directory
4. **Deduplicate bridge connections** - when multiple Lambda instances connect for the same function, reuse the existing worker instead of triggering reboots

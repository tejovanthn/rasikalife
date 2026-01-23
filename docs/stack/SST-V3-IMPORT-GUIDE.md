# SST v3 Import and Configuration Guide

*Quick reference for SST v3 patterns matching our codebase*

## Import Patterns

### The Correct Imports (SST v3)

```typescript
// ✅ SST v3 pattern - use sst.aws
import { sst } from './sst.config';

// Components are accessed via sst.aws prefix
new sst.aws.Function("MyFunction", { ... });
new sst.aws.Bucket("MyBucket", { ... });
new sst.aws.Cron("MyCron", { ... });
new sst.aws.Dynamo("MyTable", { ... });
new sst.aws.Queue("MyQueue", { ... });
new sst.aws.SnsTopic("MyTopic", { ... });
```

### ❌ Do NOT Use (SST v2 Patterns)

```typescript
// ❌ SST v2 patterns - NOT valid in SST v3
import { Cron, Bucket, Function } from 'sst/constructs';
import { Function, Bucket } from 'sst/constructs';

// ❌ Using stack parameter
new Cron(stack, "MyCron", { ... });  // stack is not used in SST v3
```

## Component Import Cheat Sheet

| Component | SST v3 Import | Example |
|-----------|---------------|---------|
| Function | `sst.aws.Function` | `new sst.aws.Function("Name", { ... })` |
| Bucket | `sst.aws.Bucket` | `new sst.aws.Bucket("Name", { ... })` |
| Cron | `sst.aws.Cron` | `new sst.aws.Cron("Name", { ... })` |
| Dynamo | `sst.aws.Dynamo` | `new sst.aws.Dynamo("Name", { ... })` |
| Queue | `sst.aws.Queue` | `new sst.aws.Queue("Name", { ... })` |
| SnsTopic | `sst.aws.SnsTopic` | `new sst.aws.SnsTopic("Name", { ... })` |
| Vpc | `sst.aws.Vpc` | `new sst.aws.Vpc("Name", { ... })` |
| Efs | `sst.aws.Efs` | `new sst.aws.Efs("Name", { ... })` |
| Cluster | `sst.aws.Cluster` | `new sst.aws.Cluster("Name", { ... })` |
| Task | `sst.aws.Task` | `new sst.aws.Task("Name", { ... })` |

## Resource Linking in SST v3

### Linking Resources to Functions

**SST v3 Pattern (use `link`):**

```typescript
const bucket = new sst.aws.Bucket("MyBucket");
const table = new sst.aws.Dynamo("MyTable");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [bucket, table]  // ✅ SST v3
});
```

**SST v2 Pattern (do NOT use):**

```typescript
// ❌ SST v2 - bind is not valid in SST v3
new Function(stack, "MyFunction", {
  handler: "src/lambda.handler",
  bind: [bucket, table]  // ❌ WRONG
});
```

### Accessing Linked Resources in Handlers

```typescript
// src/lambda.handler.ts
import { Resource } from "sst";

export async function handler() {
  // Access linked resources
  const bucketName = Resource.MyBucket.name;
  const tableName = Resource.MyTable.tableName;
  const queueUrl = Resource.MyQueue.url;
}
```

### Linking to Frontends

```typescript
// Link to Remix
new sst.aws.Remix("Web", {
  link: [bucket, table]
});

// Link to Next.js
new sst.aws.Nextjs("Web", {
  link: [bucket, table]
});

// Link to Astro
new sst.aws.Astro("Web", {
  link: [bucket, table]
});
```

## Environment Variables in SST v3

### Setting Environment Variables

**For Functions:**

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  environment: {
    DEBUG: "true",
    API_KEY: process.env.API_KEY,
    DATABASE_URL: Resource.MyDatabase.url
  }
});
```

**For Cron Jobs:**

```typescript
new sst.aws.Cron("MyCron", {
  function: {
    handler: "src/cron.handler",
    environment: {
      CRON_ENABLED: "true"
    }
  },
  schedule: "rate(1 hour)"
});
```

### Accessing in Handlers

```typescript
export async function handler() {
  const debug = process.env.DEBUG;
  const apiKey = process.env.API_KEY;
}
```

### Environment Variables Limits

- Total size cannot exceed **4 KB**
- Keys must start with a letter, be at least 2 characters, contain only letters/numbers/underscores

## SDK Usage

### Import the SDK in Handlers

```typescript
import { Resource } from "sst";
```

### Access Linked Resources

```typescript
// Bucket
Resource.MyBucket.name;      // Bucket name
Resource.MyBucket.arn;       // Bucket ARN

// Dynamo Table
Resource.MyTable.name;       // Table name
Resource.MyTable.tableName;  // Table name
Resource.MyTable.arn;        // Table ARN

// Queue
Resource.MyQueue.url;        // Queue URL
Resource.MyQueue.arn;        // Queue ARN

// Topic
Resource.MyTopic.arn;        // Topic ARN
```

## Configuration File Structure

### Our sst.config.ts Pattern

```typescript
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'rasika',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: { region: 'us-east-1' },
      },
    };
  },
  async run() {
    const infra = await import('./infra');

    return {
      site: infra.site.url,
      trpc: infra.trpc.url,
    };
  },
});
```

### Infrastructure Module Pattern

```typescript
// infra/index.ts or infra/*.ts
import { sst } from './sst.config';

// Create resources
export const bucket = new sst.aws.Bucket("MyBucket");

export const myFunction = new sst.aws.Function("MyFunction", {
  handler: "packages/functions/src/handler.handler",
  link: [bucket],
  environment: {
    NODE_ENV: "production"
  }
});

// ... other resources
```

## Common Patterns

### Pattern 1: Bucket with Function

```typescript
const bucket = new sst.aws.Bucket("UploadBucket");

new sst.aws.Function("UploadFunction", {
  handler: "src/upload.handler",
  link: [bucket],
  timeout: "30 seconds"
});
```

### Pattern 2: Cron with Linked Resources

```typescript
const table = new sst.aws.Dynamo("DataTable");

new sst.aws.Cron("CleanupJob", {
  schedule: "rate(1 day)",
  function: {
    handler: "src/cron/cleanup.handler",
    link: [table],
    timeout: "300 seconds"
  }
});
```

### Pattern 3: Queue with Subscriber Function

```typescript
const queue = new sst.aws.Queue("ProcessingQueue");

queue.notify({
  notifications: [
    {
      name: "ProcessItem",
      function: "src/queue-processor.handler"
    }
  ]
});
```

### Pattern 4: Topic with Subscribers

```typescript
const topic = new sst.aws.SnsTopic("Notifications");

topic.subscribe({
  name: "SendNotification",
  function: "src/topic-handler.handler"
});
```

## Migration from SST v2 to SST v3

| SST v2 | SST v3 |
|--------|--------|
| `sst/constructs.Function` | `sst.aws.Function` |
| `sst/constructs.Bucket` | `sst.aws.Bucket` |
| `sst/constructs.Cron` | `sst.aws.Cron` |
| `new X(stack, "Name", {...})` | `new sst.aws.X("Name", {...})` |
| `bind: [resource]` | `link: [resource]` |
| `Resource.X` (from constructs) | `Resource.X` (from sst) |
| `stack` parameter removed | No stack parameter |

## Quick Reference

```typescript
// ✅ Correct SST v3
import { sst } from './sst.config';

const bucket = new sst.aws.Bucket("MyBucket");
const fn = new sst.aws.Function("MyFn", {
  handler: "src/handler.handler",
  link: [bucket],
  environment: { DEBUG: "true" }
});

new sst.aws.Cron("MyCron", {
  function: fn,
  schedule: "rate(1 hour)"
});
```

## Further Reading

- [SST v3 Documentation](https://sst.dev/docs/)
- [Function Component](https://sst.dev/docs/component/aws/function/)
- [Bucket Component](https://sst.dev/docs/component/aws/bucket/)
- [Cron Component](https://sst.dev/docs/component/aws/cron/)
- [Linking Guide](https://sst.dev/docs/linking/)

# SST v3 Cron Component

*Source: https://sst.dev/docs/component/aws/cron/*
*Version: SST v3*
*Last Updated: January 2026*

## Overview

The `Cron` component in SST v3 adds cron jobs to your app using **Amazon EventBridge**. Cron jobs can invoke Lambda Functions or container Tasks (ECS Fargate). Cron continues running even after `sst dev` exits.

## Import Pattern

```typescript
// SST v3 pattern - use sst.aws
import { sst } from './sst.config';
```

## Basic Setup

### Lambda Function Cron (Simplest)

```typescript
new sst.aws.Cron("SearchIndexCron", {
  schedule: "rate(6 hours)",
  function: "src/cron/search-index.handler",
});
```

### Customized Function

```typescript
new sst.aws.Cron("SearchIndexCron", {
  schedule: "rate(6 hours)",
  function: {
    handler: "src/cron/search-index.handler",
    timeout: "60 seconds",
    memory: "512 MB",
    environment: {
      SEARCH_INDEX_REFRESH: "true"
    }
  }
});
```

## Cron Expression Syntax

### Rate Expressions (Simpler)

**Format**: `rate(value unit)`

```typescript
schedule: "rate(1 hour)"
schedule: "rate(6 hours)"
schedule: "rate(1 day)"
```

**Rules**:
- Value must be positive integer
- Use singular for value=1: `rate(1 hour)`, not `rate(1 hours)`
- Use plural for value>1: `rate(5 hours)`

### Cron Expressions (More Control)

**Format**: `cron(minute hour day-of-month month day-of-week year)`

```typescript
// Every 6 hours (at 0, 6, 12, 18)
schedule: "cron(0 0,6,12,18 * * ? *)"

// Every day at 2:00 AM UTC
schedule: "cron(0 2 * * ? *)"
```

## Linking Resources to Cron Function

In SST v3, use the `link` property to link resources to the cron function:

```typescript
const searchBucket = new sst.aws.Bucket("SearchBucket");

new sst.aws.Cron("SearchIndexCron", {
  schedule: "rate(6 hours)",
  function: {
    handler: "src/cron/refresh-index.handler",
    timeout: "300 seconds",
    environment: {
      INDEX_NAME: "search-index",
      REGION: "us-east-1",
    },
    link: [searchBucket],  // SST v3 pattern (NOT bind)
  }
});
```

### Accessing Linked Resources in Handler

```typescript
// src/cron/refresh-index.handler.ts
import { Resource } from "sst";

export async function handler() {
  // Access linked bucket
  const bucketName = Resource.SearchBucket.name;
  
  // Use the bucket...
  console.log(`Using bucket: ${bucketName}`);
}
```

## Environment Variables

Use the `environment` property to set environment variables:

```typescript
new sst.aws.Cron("MyCron", {
  function: {
    handler: "src/cron.handler",
    environment: {
      DEBUG: "true",
      API_KEY: "some-value",
    }
  },
  schedule: "rate(1 hour)"
});
```

Access in handler via `process.env`:

```typescript
export async function handler() {
  const debug = process.env.DEBUG;
  const apiKey = process.env.API_KEY;
}
```

## Lambda Function Reference

The `function` property accepts:

1. **String path** (auto-creates function):
   ```typescript
   function: "src/cron.handler"
   ```

2. **Full function props**:
   ```typescript
   function: {
     handler: "src/cron.handler",
     timeout: "300 seconds",
     memory: "1024 MB",
     environment: { ... },
     link: [bucket],
   }
   ```

3. **Function ARN**:
   ```typescript
   function: "arn:aws:lambda:us-east-1:123456789012:function:my-function"
   ```

## Long-Running Operation Considerations

### Lambda Limits

| Limit | Default | Maximum |
|-------|---------|---------|
| Timeout | 20 seconds | 900 seconds (15 minutes) |
| Memory | 1024 MB | 10240 MB |

### Recommendations for Search Index Refresh

1. **Timeout**: Set `timeout: "300 seconds"` (5 min) or more for index rebuilds
2. **Memory**: Increase to `1024 MB` or `2048 MB` for large datasets
3. **Idempotency**: Design cron handlers to be idempotent

## Full Configuration Options

```typescript
interface CronArgs {
  schedule: "rate(...)" | "cron(...)";
  function?: string | FunctionArgs | "arn:aws:lambda:...";
  task?: Task;
  enabled?: boolean;
  event?: Record<string, any>;
  transform?: {
    rule?: (args, opts, name) => void;
    target?: (args, opts, name) => void;
  };
}

interface FunctionArgs {
  handler: string;
  runtime?: "nodejs18.x" | "nodejs20.x" | "nodejs22.x" | "go" | "rust" | "python3.11" | etc;
  timeout?: "number seconds" | "number minutes";
  memory?: "number MB" | "number GB";
  environment?: Record<string, string>;
  link?: any[];
  permissions?: Permission[];
  // ... more options
}
```

## Gotchas and Best Practices

1. **Cron runs in UTC** - Adjust schedules for your timezone needs
2. **Lambda timeout max is 15 min** - Use ECS Task for longer jobs
3. **Cold starts apply** - First invocation after idle may be slower
4. **Cron runs independently** - It continues running even when `sst dev` stops
5. **Idempotency** - Design cron handlers to be idempotent (same result if run multiple times)
6. **Linking uses `link` not `bind`** - SST v3 replaced `bind` with `link`

## Further Reading

- [Cron Component Docs](https://sst.dev/docs/component/aws/cron/)
- [Function Component](https://sst.dev/docs/component/aws/function/)
- [Linking Resources](https://sst.dev/docs/linking/)
- [AWS EventBridge Cron Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)

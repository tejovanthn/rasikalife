# SST v3 Function Component

*Source: https://sst.dev/docs/component/aws/function/*
*Version: SST v3*
*Last Updated: January 2026*

## Overview

The `Function` component in SST v3 adds serverless AWS Lambda functions to your app. It supports Node.js, Go, Python, and Rust runtimes with built-in bundling via esbuild.

## Import Pattern

```typescript
// SST v3 pattern - use sst.aws
import { sst } from './sst.config';
```

## Basic Setup

### Minimal Function (Node.js)

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler"
});
```

### With Additional Configuration

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  timeout: "3 minutes",
  memory: "1024 MB"
});
```

## Supported Runtimes

| Runtime | Version | Support |
|---------|---------|---------|
| Node.js | 18.x, 20.x, 22.x | Official |
| Python | 3.9, 3.10, 3.11, 3.12 | Community |
| Go | go | Official |
| Rust | rust | Community |

### Node.js Example

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler"
});
```

### Python Example

```typescript
new sst.aws.Function("MyFunction", {
  runtime: "python3.11",
  handler: "functions/src/functions/api.handler"
});
```

### Go Example

```typescript
new sst.aws.Function("MyFunction", {
  runtime: "go",
  handler: "./src"
});
```

### Rust Example

```typescript
new sst.aws.Function("MyFunction", {
  runtime: "rust",
  handler: "./crates/api"
});
```

## Linking Resources

Use the `link` property to link resources (Bucket, Dynamo, etc.) to the function:

```typescript
const bucket = new sst.aws.Bucket("MyBucket");
const table = new sst.aws.Dynamo("MyTable");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [bucket, table]  // SST v3 pattern (NOT bind)
});
```

### Accessing Linked Resources in Handler

```typescript
// src/lambda.handler.ts
import { Resource } from "sst";

export async function handler() {
  // Access linked bucket
  const bucketName = Resource.MyBucket.name;
  
  // Access linked table
  const tableName = Resource.MyTable.tableName;
  
  return { bucketName, tableName };
}
```

## Environment Variables

Use the `environment` property to set Lambda environment variables:

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

### Accessing in Handler

```typescript
export async function handler() {
  const debug = process.env.DEBUG;
  const apiKey = process.env.API_KEY;
  const dbUrl = process.env.DATABASE_URL;
}
```

## Function URLs (Direct HTTP Access)

Enable a dedicated HTTP endpoint for your Lambda:

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  url: true
});
```

### With CORS Configuration

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  url: {
    authorization: "none",  // or "iam"
    cors: {
      allowOrigins: ["https://example.com"],
      allowMethods: ["GET", "POST"],
      allowCredentials: true
    }
  }
});
```

## Bundling Configuration

### Exclude Dependencies from Bundle

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  nodejs: {
    install: ["pg", "mysql2", "@aws-sdk/client-s3"]
  }
});
```

### Custom esbuild Options

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  nodejs: {
    minify: true,
    sourcemap: true,
    format: "esm",  // "esm" or "cjs"
    banner: "console.log('Function starting')"
  }
});
```

### Disable Bundling

```typescript
new sst.aws.Function("MyFunction", {
  bundle: "packages/functions/src",
  handler: "index.handler"
});
```

## VPC Configuration

Connect Lambda to a VPC for access to private resources:

```typescript
const vpc = new sst.aws.Vpc("MyVpc");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  vpc: vpc
});
```

## Permissions

### Define IAM Permissions

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  permissions: [
    {
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: ["arn:aws:s3:::my-bucket/*"]
    }
  ]
});
```

### Use Managed Policies

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  policies: ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
});
```

## Advanced Options

### Concurrency

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  concurrency: {
    reserved: 50,      // Limit max concurrent executions
    provisioned: 10    // Pre-warm instances (incurs extra charges)
  }
});
```

### Logging

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  logging: {
    retention: "1 week",  // "1 day" | "3 days" | "5 days" | "1 week" | ... | "forever"
    format: "json",       // "json" or "text"
  }
});
```

### Versioning

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  versioning: true
});
```

### Storage (/tmp)

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  storage: "5 GB"  // 512 MB to 10 GB
});
```

### Layers

```typescript
new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  layers: ["arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1"]
});
```

## EFS Mount

```typescript
const vpc = new sst.aws.Vpc("MyVpc");
const fileSystem = new sst.aws.Efs("MyFileSystem", { vpc });

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  volume: {
    efs: fileSystem,
    path: "/mnt/files"  // Default: "/mnt/efs"
  }
});
```

## Function Properties

After creation, you can access:

```typescript
const fn = new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler"
});

fn.arn;   // The ARN of the Lambda function
fn.name;  // The name of the Lambda function
fn.url;   // The function URL (if enabled)
```

## Full Configuration Options

```typescript
interface FunctionArgs {
  // Handler
  handler: string;
  runtime?: "nodejs18.x" | "nodejs20.x" | "nodejs22.x" | "go" | "rust" | "python3.9" | ...;

  // Compute
  timeout?: "number seconds" | "number minutes";  // Default: "20 seconds"
  memory?: "number MB" | "number GB";             // Default: "1024 MB"
  storage?: "number MB" | "number GB";            // Default: "512 MB"

  // Networking
  vpc?: Vpc | { privateSubnets: string[]; securityGroups: string[] };

  // Environment
  environment?: Record<string, string>;
  logging?: boolean | { format?: "json" | "text"; retention?: string };

  // Linking
  link?: any[];

  // Permissions
  permissions?: Permission[];
  policies?: string[];

  // URL
  url?: boolean | { authorization?: "none" | "iam"; cors?: CorsConfig };

  // Advanced
  architecture?: "x86_64" | "arm64";
  concurrency?: { reserved?: number; provisioned?: number };
  versioning?: boolean;
  layers?: string[];

  // Bundling (Node.js)
  nodejs?: {
    install?: string[];
    minify?: boolean;
    sourcemap?: boolean;
    format?: "esm" | "cjs";
    banner?: string;
    esbuild?: BuildOptions;
  };

  // Container (Python)
  python?: { container?: boolean };

  // Hooks
  hook?: { postbuild?: (dir: string) => Promise<void> };

  // Custom
  bundle?: string;
  copyFiles?: { from: string; to?: string }[];
  role?: string;
  tags?: Record<string, string>;
  dev?: boolean;  // Default: true (disable for sst dev)
}
```

## Gotchas and Best Practices

1. **Linking uses `link` not `bind`** - SST v3 replaced `bind` with `link`
2. **Access linked resources via `Resource` import** - Use `import { Resource } from "sst"`
3. **Cold starts** - Functions with more memory have faster cold starts
4. **Timeout max is 15 minutes** - For longer operations, use ECS Tasks
5. **Bundle size affects cold starts** - Use `nodejs.install` for large dependencies
6. **Dev mode runs stubs** - Set `dev: false` to disable Live development
7. **Environment variable size limit** - Total size cannot exceed 4 KB
8. **Function URLs vs API Gateway** - URLs are simpler but lack API features

## Integration with Our Stack

In our codebase, we use Function with the standard SST v3 pattern:

```typescript
// In infra module
import { sst } from './sst.config';

export const myFunction = new sst.aws.Function("MyFunction", {
  handler: "packages/functions/src/handler.handler",
  timeout: "30 seconds",
  memory: "1024 MB",
  environment: {
    NODE_ENV: "production"
  },
  link: [myBucket, myTable],
  nodejs: {
    install: ["pg"]  // Native dependencies
  }
});

// Access in other components
new sst.aws.Cron("MyCron", {
  function: myFunction,  // Reference existing function
  schedule: "rate(1 hour)"
});
```

## Further Reading

- [Function Component Docs](https://sst.dev/docs/component/aws/function/)
- [Linking Resources](https://sst.dev/docs/linking/)
- [Environment Variables](https://sst.dev/docs/environment-variables/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

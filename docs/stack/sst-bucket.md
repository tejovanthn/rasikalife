# SST v3 Bucket Component

*Source: https://sst.dev/docs/component/aws/bucket/*
*Version: SST v3*
*Last Updated: January 2026*

## Overview

The `Bucket` component in SST v3 adds an AWS S3 Bucket to your app. It supports public read access, CORS configuration, versioning, and event notifications.

## Import Pattern

```typescript
// SST v3 pattern - use sst.aws
import { sst } from './sst.config';
```

## Basic Setup

### Minimal Bucket

```typescript
const bucket = new sst.aws.Bucket("MyBucket");
```

### Public Read Access

```typescript
new sst.aws.Bucket("PublicBucket", {
  access: "public"
});
```

### CloudFront Access (for CDN)

```typescript
new sst.aws.Bucket("CdnBucket", {
  access: "cloudfront"
});
```

## Bucket Properties

After creation, you can access:

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

// Properties available on the bucket
bucket.arn;    // The ARN of the S3 Bucket
bucket.name;   // The generated name of the S3 Bucket
bucket.domain; // The domain name of the bucket (${bucketName}.s3.amazonaws.com)
```

## Linking to Functions

Use the `link` property to link a bucket to a function:

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

new sst.aws.Function("MyFunction", {
  handler: "src/lambda.handler",
  link: [bucket]
});
```

### Accessing Linked Bucket in Handler

```typescript
// src/lambda.handler.ts
import { Resource } from "sst";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function handler() {
  // Access linked bucket name
  const bucketName = Resource.MyBucket.name;
  
  // Generate pre-signed URL for upload
  const command = new PutObjectCommand({
    Key: "file.txt",
    Bucket: bucketName
  });
  
  const url = await getSignedUrl(new S3Client({}), command);
  return { url };
}
```

## Adding Subscribers (Event Notifications)

Use the `notify` method to subscribe to S3 events:

```typescript
const bucket = new sst.aws.Bucket("MyBucket");

bucket.notify({
  notifications: [
    {
      name: "OnUpload",
      function: "src/subscriber.handler",
      events: ["s3:ObjectCreated:*"]
    }
  ]
});
```

### Notification Options

```typescript
bucket.notify({
  notifications: [
    {
      name: "MySubscriber",
      function: "src/subscriber.handler",
      events: ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"],  // S3 events to trigger
      filterPrefix: "images/",  // Only objects with this prefix
      filterSuffix: ".jpg",     // Only objects with this suffix
    }
  ]
});
```

## Advanced Configuration

### Versioning

```typescript
new sst.aws.Bucket("MyBucket", {
  versioning: true
});
```

### CORS Configuration

```typescript
new sst.aws.Bucket("MyBucket", {
  cors: {
    allowOrigins: ["https://example.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["*"],
    maxAge: "1 day"
  }
});
```

### Bucket Policy

```typescript
new sst.aws.Bucket("MyBucket", {
  policy: [
    {
      actions: ["s3:GetObject"],
      principals: "*",
      conditions: [
        {
          test: "IpAddress",
          variable: "aws:SourceIp",
          values: ["10.0.0.0/16"]
        }
      ]
    }
  ]
});
```

### Enforce HTTPS

```typescript
new sst.aws.Bucket("MyBucket", {
  enforceHttps: true  // Default is true
});
```

## Referencing Existing Buckets

Use `Bucket.get()` to reference an existing bucket:

```typescript
const bucket = sst.aws.Bucket.get("MyBucket", "app-dev-mybucket-12345678");
```

Useful for sharing buckets across stages:

```typescript
const bucket = $app.stage === "frank"
  ? sst.aws.Bucket.get("MyBucket", "app-dev-mybucket-12345678")
  : new sst.aws.Bucket("MyBucket");
```

## Full Configuration Options

```typescript
interface BucketArgs {
  access?: "public" | "cloudfront";
  cors?: boolean | {
    allowHeaders?: string[];
    allowMethods?: string[];
    allowOrigins?: string[];
    exposeHeaders?: string[];
    maxAge?: string;
  };
  enforceHttps?: boolean;
  policy?: PolicyStatement[];
  versioning?: boolean;
  transform?: {
    bucket?: (args, opts, name) => void;
    cors?: (args, opts, name) => void;
    policy?: (args, opts, name) => void;
    publicAccessBlock?: (args, opts, name) => void;
    versioning?: (args, opts, name) => void;
  };
}

interface PolicyStatement {
  actions: string[];
  principals: "*" | { type: "aws" | "service" | "federated"; identifiers: string[] }[];
  effect?: "allow" | "deny";
  conditions?: {
    test: string;
    variable: string;
    values: string[];
  }[];
  paths?: string[];
}
```

## Gotchas and Best Practices

1. **Public access is blocked by default** - Set `access: "public"` to allow public reads
2. **HTTPS is enforced by default** - Set `enforceHttps: false` to allow HTTP
3. **Linking uses `link` not `bind`** - SST v3 uses `link` property
4. **Bucket names are globally unique** - SST auto-generates unique names
5. **Notifications need permissions** - Subscriber functions are auto-linked to bucket
6. **CORS is enabled by default** - Set `cors: false` to disable

## Integration with Our Stack

In our codebase, we use Bucket with the standard SST v3 pattern:

```typescript
// In sst.config.ts or infra module
import { sst } from './sst.config';

export const uploadBucket = new sst.aws.Bucket("UploadBucket");

// Link to function
new sst.aws.Function("UploadFunction", {
  handler: "packages/functions/src/upload.handler",
  link: [uploadBucket],
  timeout: "30 seconds",
});

// Link to frontend (for pre-signed URLs)
new sst.aws.Remix("Web", {
  link: [uploadBucket],
});
```

## Further Reading

- [Bucket Component Docs](https://sst.dev/docs/component/aws/bucket/)
- [Linking Resources](https://sst.dev/docs/linking/)
- [S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)
- [CORS Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)

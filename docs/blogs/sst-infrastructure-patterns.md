# SST v3 Infrastructure Patterns - Serverless Made Simple

## Introduction

Infrastructure as Code (IaC) enables reliable, reproducible deployments, but traditional tools like CloudFormation or Terraform can be verbose and complex. SST (Serverless Stack) v3 provides a modern, type-safe approach to building serverless applications on AWS. This blog post explores our SST v3 infrastructure implementation, covering resource definition, linking, secrets management, and deployment patterns.

**Related ADRs:**
- [ADR-002: SST v3 as Infrastructure Framework](../adrs/adr-002-sst-v3-infrastructure-framework.md)
- [ADR-009: Overall Architecture Patterns](../adrs/adr-009-overall-architecture-patterns.md)

## The Infrastructure Challenge

### Traditional IaC Challenges

```yaml
# Traditional CloudFormation (verbose, error-prone)
Resources:
  DynamoDBTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: RasikaTable
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
        - AttributeName: gsi1pk
          AttributeType: S
        - AttributeName: gsi1sk
          AttributeType: S
        # ... 20 more lines for 6 GSIs
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: gsi1
          KeySchema:
            - AttributeName: gsi1pk
              KeyType: HASH
            - AttributeName: gsi1sk
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        # ... 5 more GSI definitions
```

**Problems:**
- **Verbose**: 100+ lines for a single table
- **No type safety**: YAML doesn't catch errors
- **Hard to test**: Can't test CloudFormation locally
- **Manual linking**: Must manually reference ARNs
- **Complex permissions**: IAM policies are tedious

## SST v3 Architecture

### Core Benefits

- **Type safety**: TypeScript throughout
- **Automatic linking**: Resources link automatically
- **Live lambda dev**: Test changes without deploying
- **Secrets management**: Encrypted secrets per stage
- **Multi-stage**: Dev, staging, prod environments
- **Cost tracking**: Built-in cost estimation

### Project Structure

```
rasika/
├── sst.config.ts           # Main SST configuration
├── infra/                  # Infrastructure definitions
│   ├── index.ts            # Exports all infrastructure
│   ├── database.ts         # DynamoDB table
│   ├── storage.ts          # S3 buckets
│   ├── auth.ts             # OpenAuth setup
│   ├── trpc.ts             # tRPC API
│   ├── search.ts           # Search functions
│   ├── site.ts             # Remix frontend
│   └── domain.ts           # Domain configuration
└── packages/
    ├── auth/               # Auth Lambda handler
    ├── functions/          # Lambda functions
    └── web/                # Remix application
```

## SST Configuration

### Main Config File

```typescript
// sst.config.ts
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
      search: infra.searchReindexFunction.url,
      auth: infra.auth.url,
    };
  },
});
```

**Key Features:**
- **Stage-based removal**: Retain prod resources, remove dev/staging
- **Dynamic imports**: Load infrastructure on demand
- **Return outputs**: Expose URLs for easy access
- **Type safety**: Full TypeScript support

## Infrastructure Resources

### DynamoDB Table

```typescript
// infra/database.ts
const database = new sst.aws.Dynamo('RasikaTable', {
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
    gsi1sk: 'string',
    gsi2pk: 'string',
    gsi2sk: 'string',
    gsi3pk: 'string',
    gsi3sk: 'string',
    gsi4pk: 'string',
    gsi4sk: 'string',
    gsi5pk: 'string',
    gsi5sk: 'string',
    gsi6pk: 'string',
    gsi6sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  globalIndexes: {
    gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
    gsi2: { hashKey: 'gsi2pk', rangeKey: 'gsi2sk' },
    gsi3: { hashKey: 'gsi3pk', rangeKey: 'gsi3sk' },
    gsi4: { hashKey: 'gsi4pk', rangeKey: 'gsi4sk' },
    gsi5: { hashKey: 'gsi5pk', rangeKey: 'gsi5sk' },
    gsi6: { hashKey: 'gsi6pk', rangeKey: 'gsi6sk' },
  },
});

export { database };
```

**Benefits:**
- **Concise**: 30 lines vs 100+ in CloudFormation
- **Type-safe**: TypeScript validation
- **Automatic billing**: PAY_PER_REQUEST by default
- **Stream support**: Built-in DynamoDB streams

**Related Reading:** [Single-Table Design Patterns](./single-table-design-patterns.md)

### S3 Bucket

```typescript
// infra/storage.ts
export const bucket = new sst.aws.Bucket('RasikaBucket', {
  public: true,  // Public read access
  cors: {
    allowOrigins: ['*'],
    allowMethods: ['GET', 'HEAD'],
    allowHeaders: ['*'],
  },
});
```

### OpenAuth Setup

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

**Key Features:**
- **Resource linking**: Automatic permissions and env vars
- **Secrets**: Type-safe secret references
- **Custom domains**: Easy domain configuration

**Related Reading:** [OAuth with OpenAuth & Google](./oauth-openauth-google.md)

### tRPC API

```typescript
// infra/trpc.ts
import { database } from './database';
import { auth } from './auth';
import { getDomain } from './domain';

export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  url: {
    cors: {
      allowOrigins: ['https://rasika.life', 'http://localhost:3000'],
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['Content-Type', 'Authorization'],
    },
  },
  link: [database, auth],
  environment: {
    DYNAMODB_TABLE: database.name,
  },
  timeout: '30 seconds',
  memory: '512 MB',
});

// Create custom domain
const trpcDomain = getDomain('trpc');
trpc.domain = {
  name: trpcDomain,
  redirects: ['www.' + trpcDomain],
};

export { trpc };
```

**Related Reading:** [tRPC Type-Safe API Layer](./trpc-type-safe-api-layer.md)

### Remix Site

```typescript
// infra/site.ts
import { database } from './database';
import { trpc } from './trpc';
import { auth } from './auth';
import { getDomain } from './domain';

export const site = new sst.aws.Remix('RasikaSite', {
  path: 'packages/web',
  link: [database, trpc, auth],
  domain: {
    name: getDomain('site'),
    redirects: ['www.' + getDomain('site')],
  },
  environment: {
    DYNAMODB_TABLE: database.name,
    TRPC_URL: trpc.url,
    AUTH_URL: auth.url,
  },
});
```

## Resource Linking

### Automatic Permissions

```typescript
// infra/trpc.ts
export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  link: [database, auth],  // Automatic IAM permissions!
});

// SST automatically creates IAM policies:
// - DynamoDB: Read/Write access to database
// - Auth: Invoke auth.url
// - Environment variables: Injected automatically
```

### Using Linked Resources

```typescript
// packages/functions/src/trpc.handler.ts
import { Resource } from 'sst';

// Access linked resources via Resource object
export const handler = async (event) => {
  // Database table name (from link)
  const tableName = Resource.RasikaTable.name;

  // Auth URL (from link)
  const authUrl = Resource.RasikaAuth.url;

  // Use resources with automatic permissions
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: tableName,
      // ... query params
    })
  );

  return result;
};
```

## Secrets Management

### Setting Secrets

```bash
# Set secrets for development
sst secret set GoogleClientId "your-client-id"
sst secret set GoogleClientSecret "your-client-secret"

# Set secrets for production
sst secret set GoogleClientId "prod-client-id" --stage prod
sst secret set GoogleClientSecret "prod-secret" --stage prod

# List secrets
sst secret list

# Remove secret
sst secret remove GoogleClientId
```

### Using Secrets

```typescript
// infra/auth.ts
const googleClientId = new sst.Secret('GoogleClientId');
const googleClientSecret = new sst.Secret('GoogleClientSecret');

export const auth = new sst.aws.Auth('RasikaAuth', {
  issuer: {
    handler: 'packages/auth/src/issuer.handler',
    link: [googleClientId, googleClientSecret],  // Link secrets
  },
});
```

```typescript
// packages/auth/src/issuer.ts
import { Resource } from 'sst';

// Access secrets via Resource object
const clientId = Resource.GoogleClientId.value;
const clientSecret = Resource.GoogleClientSecret.value;

export const app = issuer({
  providers: {
    google: GoogleProvider({
      clientID: clientId,
      clientSecret: clientSecret,
      scopes: ['openid', 'email', 'profile'],
    }),
  },
});
```

**Security:**
- **Encrypted at rest**: Secrets stored encrypted in AWS
- **Per-stage**: Different secrets for dev/prod
- **No code changes**: Same code works across stages
- **IAM permissions**: Only linked functions can access

## Multi-Stage Deployment

### Stage Configuration

```bash
# Deploy to dev (default)
sst deploy

# Deploy to staging
sst deploy --stage staging

# Deploy to production
sst deploy --stage prod
```

### Stage-Specific Behavior

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: 'rasika',
      // Retain prod resources, remove others
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: { region: 'us-east-1' },
      },
    };
  },
});
```

### Stage-Specific Resources

```typescript
// infra/domain.ts
export function getDomain(subdomain: string): string {
  const stage = process.env.SST_STAGE || 'dev';

  if (stage === 'prod') {
    return subdomain === 'site'
      ? 'rasika.life'
      : `${subdomain}.rasika.life`;
  }

  return `${subdomain}-${stage}.rasika.life`;
}

// Domains per stage:
// dev: trpc-dev.rasika.life, auth-dev.rasika.life
// staging: trpc-staging.rasika.life, auth-staging.rasika.life
// prod: trpc.rasika.life, auth.rasika.life
```

## Development Workflow

### Live Lambda Dev

```bash
# Start SST dev mode
pnpm run dev

# Opens console at: https://console.sst.dev

# Features:
# - Live Lambda logs
# - Resource explorer
# - Local Lambda execution
# - Hot reload
```

**Benefits:**
- **Fast iteration**: No deployment needed for code changes
- **Real AWS**: Uses actual AWS resources
- **Debugging**: Full console logs and errors
- **Multiple devs**: Each dev gets their own stage

### SST Shell

```bash
# Run commands with proper AWS context
sst shell

# Now have access to all linked resources
> node
> const { Resource } = require('sst');
> console.log(Resource.RasikaTable.name);
RasikaTable-dev-us-east-1

# Run tests with proper environment
sst shell vitest run
```

### Console Access

```bash
# Open SST console
sst dev

# Features:
# - Resource overview
# - Lambda logs
# - DynamoDB browser
# - Secrets manager
# - Cost estimates
```

## Advanced Patterns

### Custom Domains

```typescript
// infra/domain.ts
export function getDomain(subdomain: string): string {
  const stage = process.env.SST_STAGE || 'dev';

  // Production domains
  if (stage === 'prod') {
    return subdomain === 'site'
      ? 'rasika.life'
      : `${subdomain}.rasika.life`;
  }

  // Non-prod: subdomain-stage.rasika.life
  return `${subdomain}-${stage}.rasika.life`;
}

// Usage
const trpcDomain = getDomain('trpc');  // trpc-dev.rasika.life
const authDomain = getDomain('auth');  // auth-dev.rasika.life
```

### Environment Variables

```typescript
// infra/trpc.ts
export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  link: [database, auth],
  environment: {
    // Custom environment variables
    DYNAMODB_TABLE: database.name,
    LOG_LEVEL: process.env.SST_STAGE === 'prod' ? 'error' : 'debug',
    FEATURE_FLAG_NEW_UI: 'true',
  },
});
```

### Conditional Resources

```typescript
// Create resources based on stage
const isProd = process.env.SST_STAGE === 'prod';

export const cdn = isProd
  ? new sst.aws.Cdn('RasikaCDN', {
      domain: 'cdn.rasika.life',
      origins: {
        s3: bucket.url,
      },
    })
  : undefined;
```

### Custom Lambda Layers

```typescript
// infra/trpc.ts
export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  layers: [
    // Custom Lambda layer for shared dependencies
    'arn:aws:lambda:us-east-1:123456789:layer:sharp:1',
  ],
  nodejs: {
    // Exclude dependencies from bundle (included in layer)
    external: ['sharp'],
  },
});
```

### VPC Configuration

```typescript
// infra/trpc.ts
export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  vpc: {
    // Run in VPC for RDS access
    securityGroups: ['sg-123456'],
    subnets: ['subnet-123456', 'subnet-789012'],
  },
});
```

## Cost Optimization

### Resource Sizing

```typescript
// Right-size Lambda functions
export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  memory: '512 MB',      // Start small
  timeout: '30 seconds',  // Set appropriate timeout
});

// Background jobs can be larger
export const indexer = new sst.aws.Function('SearchIndexer', {
  handler: 'packages/functions/src/indexer.handler',
  memory: '2048 MB',      // More memory for CPU-intensive work
  timeout: '5 minutes',   // Longer timeout
});
```

### DynamoDB Billing

```typescript
// PAY_PER_REQUEST by default (good for most cases)
const database = new sst.aws.Dynamo('RasikaTable', {
  // Defaults to PAY_PER_REQUEST
  fields: { /* ... */ },
});

// Use provisioned capacity for predictable workloads
const database = new sst.aws.Dynamo('RasikaTable', {
  billing: {
    mode: 'PROVISIONED',
    readCapacity: 5,
    writeCapacity: 5,
  },
  fields: { /* ... */ },
});
```

### Stage-Based Resources

```typescript
// Use smaller resources for dev/staging
const memorySize = process.env.SST_STAGE === 'prod' ? '1024 MB' : '512 MB';

export const trpc = new sst.aws.Function('TrpcHandler', {
  handler: 'packages/functions/src/trpc.handler',
  memory: memorySize,
});
```

## Testing

### Local Testing

```bash
# Run tests with SST context
sst shell vitest run

# Enables:
# - Access to Resource object
# - Proper environment variables
# - AWS SDK configuration
```

### Integration Tests

```typescript
// packages/trpc/src/routers/artist.test.ts
import { describe, it, expect } from 'vitest';
import { Resource } from 'sst';
import { createCaller } from '../trpc';

describe('Artist Router', () => {
  it('should list artists', async () => {
    const caller = createCaller({
      event: {} as any,
      user: null,
    });

    const result = await caller.artist.list({ limit: 10 });

    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });
});
```

## Best Practices

### 1. Organize Infrastructure by Domain

```typescript
// infra/
├── database.ts      # Database resources
├── storage.ts       # S3 buckets
├── auth.ts          # Authentication
├── trpc.ts          # API functions
└── site.ts          # Frontend
```

### 2. Use Resource Linking

```typescript
// Link resources instead of manual ARNs
export const trpc = new sst.aws.Function('TrpcHandler', {
  link: [database, auth],  // Automatic permissions + env vars
});
```

### 3. Leverage Secrets Management

```bash
# Never commit secrets to git
sst secret set API_KEY "secret-value"
```

### 4. Stage-Specific Configuration

```typescript
// Use stage for environment-specific behavior
const isProd = process.env.SST_STAGE === 'prod';
```

### 5. Resource Naming

```typescript
// Use consistent naming: {Service}{ResourceType}
const database = new sst.aws.Dynamo('RasikaTable');
const auth = new sst.aws.Auth('RasikaAuth');
const site = new sst.aws.Remix('RasikaSite');
```

## Common Pitfalls

### 1. Hardcoding Resource Names
**Problem**: Hardcoded table names break across stages

```typescript
// Wrong
const tableName = 'RasikaTable';
```

**Solution**: Use Resource object
```typescript
// Correct
const tableName = Resource.RasikaTable.name;
```

### 2. Not Using Resource Linking
**Problem**: Manual IAM permissions and env vars

**Solution**: Always use link parameter

### 3. Forgetting Stage-Specific Secrets
**Problem**: Using prod secrets in dev

**Solution**: Set secrets per stage

### 4. Not Using SST Shell for Tests
**Problem**: Tests fail because Resource is undefined

**Solution**: Run tests with `sst shell vitest run`

## Conclusion

SST v3 provides a modern, type-safe approach to infrastructure as code. By abstracting away AWS complexity while maintaining full control, SST enables rapid development of serverless applications with confidence.

For the Rasika.life platform, SST enables us to define our entire infrastructure in ~200 lines of TypeScript, compared to thousands of lines of CloudFormation, while providing better type safety, automatic linking, and an excellent development experience.

**Related Reading:**
- [OAuth with OpenAuth & Google](./oauth-openauth-google.md)
- [tRPC Type-Safe API Layer](./trpc-type-safe-api-layer.md)
- [Single-Table Design Patterns](./single-table-design-patterns.md)

## Resources

- [SST Documentation](https://sst.dev/)
- [SST v3 Guide](https://sst.dev/docs/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Infrastructure as Code](https://www.terraform.io/use-cases/infrastructure-as-code)

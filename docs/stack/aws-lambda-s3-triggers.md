# AWS Lambda S3 Triggers - Node.js/TypeScript

*Source: [AWS Lambda S3 Integration](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html), [TypeScript Handlers](https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html)*
*Last Updated: February 2026*

## Overview

AWS Lambda S3 triggers enable event-driven processing of objects uploaded to S3 buckets. When objects are created or deleted, S3 can automatically invoke Lambda functions, enabling serverless workflows for image processing, document handling, and data transformations.

## Key Concepts

- **Event Source**: S3 bucket notifications
- **Invocation Mode**: Asynchronous
- **Delivery Guarantee**: At least once
- **Handler Pattern**: `async (event) => Promise<void>`
- **Runtime**: Node.js 18+ (LTS versions recommended)

## S3 Event Structure

### ObjectCreated Event Format

```typescript
interface S3Event {
  Records: S3Record[];
}

interface S3Record {
  eventVersion: string;           // e.g., "2.1", "2.2"
  eventSource: string;            // Always "aws:s3"
  awsRegion: string;             // e.g., "us-east-1"
  eventTime: string;             // ISO 8601 timestamp
  eventName: string;             // e.g., "ObjectCreated:Put", "ObjectCreated:CompleteMultipartUpload"
  userIdentity: {
    principalId: string;         // AWS account ID
  };
  requestParameters: {
    sourceIPAddress: string;     // Client IP that initiated the request
  };
  responseElements: {
    'x-amz-request-id': string;   // Request ID for AWS support
    'x-amz-id-2': string;        // Additional request context
  };
  s3: {
    s3SchemaVersion: string;     // e.g., "1.0"
    configurationId: string;     // Notification configuration ID
    bucket: {
      name: string;              // Bucket name
      ownerIdentity: {
        principalId: string;     // Bucket owner ID
      };
      arn: string;               // Bucket ARN
    };
    object: {
      key: string;               // URL-encoded object key
      size: number;              // Object size in bytes
      eTag: string;             // Object ETag
      sequencer: string;         // Event sequence identifier
      versionId?: string;        // Object version ID (if versioning enabled)
    };
  };
}
```

### Example S3 Event

```json
{
  "Records": [
    {
      "eventVersion": "2.1",
      "eventSource": "aws:s3",
      "awsRegion": "us-east-2",
      "eventTime": "2024-09-03T19:37:27.192Z",
      "eventName": "ObjectCreated:Put",
      "userIdentity": {
        "principalId": "AWS:AIDAINPONIXQXHT3IKHL2"
      },
      "requestParameters": {
        "sourceIPAddress": "205.255.255.255"
      },
      "responseElements": {
        "x-amz-request-id": "D82B88E5F771F645",
        "x-amz-id-2": "vlR7PnpV2Ce81l0PRw6jlUpck7Jo5ZsQjryTjKlc5aLWGVHPZLj5NeC6qMa0emYBDXOo6QBU0Wo="
      },
      "s3": {
        "s3SchemaVersion": "1.0",
        "configurationId": "828aa6fc-f7b5-4305-8584-487c791949c1",
        "bucket": {
          "name": "my-upload-bucket",
          "ownerIdentity": {
            "principalId": "A3I5XTEXAMAI3E"
          },
          "arn": "arn:aws:s3:::my-upload-bucket"
        },
        "object": {
          "key": "uploads/document.pdf",
          "size": 1234567,
          "eTag": "d41d8cd98f00b204e9800998ecf8427e",
          "sequencer": "0C0F6F405D6ED209E1"
        }
      }
    }
  ]
}
```

### Important Notes on Object Key

```typescript
// The object key is URL-encoded
const encodedKey = record.s3.object.key; // "uploads/document%2Epdf"

// Always decode before using
const decodedKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
// "uploads/document.pdf"

// Safe decoding function
function decodeS3Key(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, ' '));
}
```

## Lambda Handler Patterns

### Basic S3 Event Handler (TypeScript)

```typescript
import { S3Event, S3EventRecord } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client outside handler for connection reuse
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: S3Event): Promise<void> => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    await processS3Record(record);
  }
};

async function processS3Record(record: S3EventRecord): Promise<void> {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing object: s3://${bucket}/${key}`);
  
  try {
    // Get object from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    
    // Process the object (example: read as stream or buffer)
    const bodyBuffer = await streamToBuffer(response.Body as NodeJS.ReadableStream);
    const contentType = response.ContentType;
    const contentLength = response.ContentLength;
    
    console.log(`Object size: ${contentLength} bytes, type: ${contentType}`);
    
    // TODO: Add your processing logic here
    
  } catch (error) {
    console.error(`Error processing ${key}:`, error);
    throw error; // Lambda will retry on unhandled errors
  }
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

### Handler with Environment Variables

```typescript
import { S3Event } from 'aws-lambda';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

interface ProcessingConfig {
  outputBucket: string;
  maxImageSizeMB: number;
  allowedContentTypes: string[];
}

export const handler = async (event: S3Event): Promise<void> => {
  // Access environment variables with type safety
  const config: ProcessingConfig = {
    outputBucket: process.env.OUTPUT_BUCKET ?? '',
    maxImageSizeMB: parseInt(process.env.MAX_IMAGE_SIZE_MB ?? '10', 10),
    allowedContentTypes: (process.env.ALLOWED_CONTENT_TYPES ?? '').split(',')
  };
  
  if (!config.outputBucket) {
    throw new Error('OUTPUT_BUCKET environment variable not set');
  }
  
  // Process records...
};
```

### Handler Returning Structured Response

```typescript
import { S3Event } from 'aws-lambda';

interface ProcessingResult {
  processedCount: number;
  failedCount: number;
  errors: Array<{ key: string; error: string }>;
}

export const handler = async (event: S3Event): Promise<ProcessingResult> => {
  const result: ProcessingResult = {
    processedCount: 0,
    failedCount: 0,
    errors: []
  };
  
  for (const record of event.Records) {
    try {
      await processRecord(record);
      result.processedCount++;
    } catch (error) {
      result.failedCount++;
      result.errors.push({
        key: record.s3.object.key,
        error: (error as Error).message
      });
    }
  }
  
  console.log('Processing complete:', result);
  return result;
};
```

## Best Practices for Image Processing

### 1. Avoid Recursive Invocation

```typescript
// ❌ BAD: Can cause infinite loop if processing writes to same bucket
export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const result = await processImage(record);
    // This writes back to the same bucket, triggering another event!
    await s3.putObject({
      Bucket: record.s3.bucket.name,
      Key: `processed/${record.s3.object.key}`,
      Body: result
    }).promise();
  }
};

// ✅ GOOD: Use separate input/output buckets or prefixes
export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    // Only process objects from specific prefix
    if (!record.s3.object.key.startsWith('input/')) {
      continue;
    }
    
    const result = await processImage(record);
    
    // Write to different prefix
    await s3.putObject({
      Bucket: record.s3.bucket.name,
      Key: `output/${record.s3.object.key.replace('input/', '')}`,
      Body: result
    }).promise();
  }
};

// ✅ ALTERNATIVE: Use two different buckets
const INPUT_BUCKET = process.env.INPUT_BUCKET;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
```

### 2. Idempotent Processing

```typescript
import { S3Event } from 'aws-lambda';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

interface ProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Check if already processed (idempotency)
    const markerKey = `processed/${key}.status`;
    
    try {
      // Check for existing status marker
      const existingStatus = await checkProcessingStatus(bucket, markerKey);
      
      if (existingStatus?.status === 'completed') {
        console.log(`Already processed: ${key}, skipping`);
        continue;
      }
      
      if (existingStatus?.status === 'processing') {
        console.log(`Processing in progress: ${key}, skipping`);
        continue;
      }
      
      // Mark as processing
      await writeStatusMarker(bucket, markerKey, {
        status: 'processing',
        startedAt: new Date().toISOString()
      } as ProcessingStatus);
      
      // Process the image
      const result = await processImage(record);
      
      // Mark as completed
      await writeStatusMarker(bucket, markerKey, {
        status: 'completed',
        completedAt: new Date().toISOString()
      } as ProcessingStatus);
      
    } catch (error) {
      // Mark as failed
      await writeStatusMarker(bucket, markerKey, {
        status: 'failed',
        error: (error as Error).message
      } as ProcessingStatus);
      
      throw error;
    }
  }
};
```

### 3. Handle Large Payloads with S3 Select or Presigned URLs

```typescript
import { S3Event, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // For very large objects, generate presigned URL for downstream processing
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    // Generate presigned URL valid for 1 hour
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Pass URL to processing service instead of loading entire object
    await processWithExternalService(presignedUrl);
  }
};
```

### 4. Graceful Error Handling with DLQ Support

```typescript
import { S3Event } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const DLQ_BUCKET = process.env.DLQ_BUCKET;

interface DLQEntry {
  timestamp: string;
  bucket: string;
  key: string;
  error: string;
  attemptCount: number;
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      const dlqEntry: DLQEntry = {
        timestamp: new Date().toISOString(),
        bucket: record.s3.bucket.name,
        key: record.s3.object.key,
        error: (error as Error).message,
        attemptCount: record.s3.object.versionId ? 1 : 0 // Simplified
      };
      
      // Write to dead letter queue (S3 bucket)
      await s3Client.send(new PutObjectCommand({
        Bucket: DLQ_BUCKET,
        Key: `failed/${Date.now()}-${record.s3.object.key}`,
        Body: JSON.stringify(dlqEntry, null, 2),
        ContentType: 'application/json'
      }));
      
      console.error('Sent to DLQ:', dlqEntry);
    }
  }
};
```

### 5. Batch Processing with Multiple Records

```typescript
import { S3Event, S3EventRecord } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: S3Event): Promise<void> => {
  const records = event.Records;
  
  console.log(`Processing batch of ${records.length} records`);
  
  // Process in parallel with controlled concurrency
  const BATCH_SIZE = 10;
  const results = [];
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(record => processRecord(record))
    );
    
    results.push(...batchResults);
    
    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`Batch ${i / BATCH_SIZE + 1} had ${failures.length} failures`);
      
      // Handle partial failures
      await handleBatchFailures(
        batch.filter((_, idx) => results[i + idx].status === 'rejected')
      );
    }
  }
};

async function processRecord(record: S3EventRecord): Promise<void> {
  // Processing logic
}
```

## Processing Image Files

### Content Type Validation

```typescript
import { S3Event } from 'aws-lambda';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Get object metadata
    const metadata = await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    
    // Validate content type
    const contentType = metadata.ContentType;
    if (!ALLOWED_IMAGE_TYPES.includes(contentType ?? '')) {
      console.log(`Skipping non-image file: ${key} (type: ${contentType})`);
      continue;
    }
    
    // Validate file size
    if ((metadata.ContentLength ?? 0) > MAX_FILE_SIZE) {
      console.log(`File too large: ${key} (${metadata.ContentLength} bytes)`);
      continue;
    }
    
    // Process the image
    await processImage(bucket, key, metadata);
  }
};
```

### Image Processing with Sharp (for Resizing/Transforming)

```typescript
import * as sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Get image from S3
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(getCommand);
    
    // Convert stream to buffer
    const imageBuffer = await streamToBuffer(response.Body as NodeJS.ReadableStream);
    
    // Process with Sharp
    const processedImage = await sharp(imageBuffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Upload processed image
    const outputKey = `processed/${key.replace('uploads/', '')}`;
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: processedImage,
      ContentType: 'image/jpeg',
      Metadata: {
        'original-name': key,
        'processed-at': new Date().toISOString()
      }
    });
    
    await s3Client.send(putCommand);
    console.log(`Processed and saved: ${outputKey}`);
  }
};
```

## Configuration

### Environment Variables

```
AWS_REGION=us-east-1
INPUT_BUCKET=my-input-bucket
OUTPUT_BUCKET=my-output-bucket
DLQ_BUCKET=my-dlq-bucket
MAX_IMAGE_SIZE_MB=10
GEMINI_API_KEY=your-api-key
```

### IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-input-bucket/*",
        "arn:aws:s3:::my-output-bucket/*",
        "arn:aws:s3:::my-dlq-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-input-bucket",
        "arn:aws:s3:::my-output-bucket"
      ]
    }
  ]
}
```

## S3 Trigger Setup

### Console Setup Steps

1. Go to Lambda → Functions → Select your function
2. Click "Add trigger"
3. Select "S3" trigger type
4. Choose your bucket
5. Set event types:
   - `ObjectCreated (all)` - for all upload events
   - `ObjectCreated:Put` - for PUT requests only
   - `ObjectCreated:CompleteMultipartUpload` - for large file uploads
6. Set prefix (optional): Filter uploads to specific path
7. Set suffix (optional): Filter by file extension (e.g., `.jpg`)
8. Enable "Recursive invocation" checkbox if needed (usually NOT recommended)
9. Click "Add"

### Event Types Reference

| Event Type | Triggered By | Use Case |
|------------|--------------|----------|
| `ObjectCreated:Put` | PUT upload | Standard file upload |
| `ObjectCreated:Post` | POST upload | HTML form upload |
| `ObjectCreated:Copy` | Copy object | File duplication |
| `ObjectCreated:CompleteMultipartUpload` | Multipart upload | Large files (>5GB) |
| `ObjectRemoved:Delete` | Delete object | Cleanup triggers |
| `ObjectRemoved:DeleteMarkerCreated` | Version delete | Version management |

## Integration with Our Stack

For SST deployment:

```typescript
// sst.config.ts
export default {
  async run() {
    const uploadBucket = new sst.aws.S3Bucket('UploadBucket');
    const processingBucket = new sst.aws.S3Bucket('ProcessingBucket');
    
    const processor = new sst.aws.Function('ImageProcessor', {
      handler: 'functions/processor.handler',
      permissions: [
        {
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [uploadBucket.arn + '/*', processingBucket.arn + '/*']
        }
      ],
      environment: {
        OUTPUT_BUCKET: processingBucket.name,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY
      }
    });
    
    // Add S3 trigger
    uploadBucket.onObjectCreated('OnUpload', {
      handler: processor.arn,
      filter: {
        suffix: ['.jpg', '.jpeg', '.png']
      }
    });
    
    return {
      UploadBucket: uploadBucket.name,
      ProcessingBucket: processingBucket.name
    };
  }
};
```

## Gotchas and Best Practices

### Do:
- ✅ Initialize SDK clients outside handler (connection reuse)
- ✅ Use `decodeURIComponent` for object keys
- ✅ Implement idempotent processing (markers or DLQ)
- ✅ Validate content types before processing
- ✅ Handle batched records (multiple objects per event)
- ✅ Set appropriate timeout (15 minutes max)
- ✅ Use separate input/output buckets/prefixes

### Don't:
- ❌ Write to the same bucket that triggered the event (infinite loop)
- ❌ Process large files in Lambda memory (use /tmp or S3 Select)
- ❌ Ignore the `event.Records` array (may contain multiple records)
- ❌ Use synchronous patterns (forEach without await)
- ❌ Hardcode bucket names (use environment variables)

### Performance Tips:
- Keep cold starts minimal (package size < 10MB)
- Use Lambda Layers for common dependencies
- Monitor with CloudWatch metrics
- Set up provisioned concurrency for consistent latency

## Further Reading

- [AWS Lambda S3 Integration Docs](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html)
- [TypeScript Handler Guide](https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html)
- [S3 Event Notification Types](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

# S3 → Lambda → Gemini: Image Processing Pipeline

*Source: [Google Gemini API Integration](docs/stack/google-gemini-api.md), [AWS Lambda S3 Triggers](docs/stack/aws-lambda-s3-triggers.md)*
*Last Updated: February 2026*

## Overview

This document provides a complete implementation guide for processing images uploaded to S3 using Lambda triggers that call the Gemini API for text extraction and structured data retrieval. This pattern is ideal for:
- Document OCR and text extraction
- Invoice and receipt processing
- Content moderation analysis
- Metadata extraction from images
- Form data extraction

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   S3 Upload     │────▶│   Lambda        │────▶│   Gemini API    │
│   (Image)       │     │   (Processor)   │     │   (AI Extract)  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                       │
                               │                       │
                               ▼                       ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   Output        │     │   Structured    │
                        │   (S3/DB)      │     │   JSON Result   │
                        └─────────────────┘     └─────────────────┘
```

## Complete Implementation

### Project Structure

```
functions/
├── package.json
├── tsconfig.json
├── src/
│   ├── handler.ts          # Lambda handler
│   ├── processor.ts         # Image processing logic
│   ├── gemini-client.ts     # Gemini API client
│   ├── s3-client.ts         # S3 operations
│   ├── types.ts            # TypeScript types
│   └── errors.ts           # Error handling
```

### Dependencies

```json
{
  "dependencies": {
    "@google/genai": "^1.40.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.140",
    "@types/node": "^20.14.0",
    "typescript": "^5.4.0"
  }
}
```

### Type Definitions

```typescript
// src/types.ts

import { S3Event } from 'aws-lambda';
import { z } from 'zod';

// S3 Event type
export type ImageProcessingEvent = S3Event;

// Gemini extraction result
export interface ExtractionResult {
  success: boolean;
  text?: string;
  structuredData?: Record<string, unknown>;
  confidence?: number;
  error?: string;
  processingTimeMs: number;
}

// Configuration
export interface ProcessingConfig {
  geminiModel: string;
  maxRetries: number;
  outputBucket: string;
  tempBucket: string;
}

// Extraction schema (example for invoice processing)
export const InvoiceSchema = z.object({
  invoice_number: z.string().optional(),
  date: z.string().optional(),
  vendor: z.string().optional(),
  total_amount: z.number().optional(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number()
    })
  ).optional(),
  confidence: z.number()
});

export type InvoiceData = z.infer<typeof InvoiceSchema>;
```

### Gemini Client

```typescript
// src/gemini-client.ts

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class GeminiClient {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<string> {
    const base64Image = imageBuffer.toString('base64');

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          type: 'text',
          text: 'Extract all text from this image exactly as it appears.'
        },
        {
          type: 'image',
          data: base64Image,
          mime_type: mimeType
        }
      ]
    });

    return response.text ?? '';
  }

  async extractStructuredData<T extends z.ZodType>(
    imageBuffer: Buffer,
    mimeType: string,
    schema: T
  ): Promise<z.infer<T>> {
    const base64Image = imageBuffer.toString('base64');
    const jsonSchema = zodToJsonSchema(schema);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          type: 'text',
          text: 'Extract structured data from this image following the provided schema.'
        },
        {
          type: 'image',
          data: base64Image,
          mime_type: mimeType
        }
      ],
      config: {
        response_mime_type:        response_json_schema 'application/json',
: jsonSchema,
        temperature: 0.1
      }
    });

    if (!response.text) {
      throw new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(response.text);
    return schema.parse(parsed);
  }
}
```

### Error Handling

```typescript
// src/errors.ts

export interface RetryableError {
  retryable: boolean;
  message: string;
  status?: string;
  code?: number;
}

export class ProcessingError extends Error {
  public readonly retryable: boolean;
  public readonly status?: string;
  public readonly code?: number;

  constructor(
    message: string,
    retryable: boolean = false,
    status?: string,
    code?: number
  ) {
    super(message);
    this.name = 'ProcessingError';
    this.retryable = retryable;
    this.status = status;
    this.code = code;
  }
}

export function classifyError(error: unknown): RetryableError {
  const geminiError = error as { status?: string; code?: number; message?: string };
  
  // Gemini API errors
  const retryableStatuses = ['INTERNAL', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED'];
  
  if (retryableStatuses.includes(geminiError.status ?? '')) {
    return {
      retryable: true,
      message: geminiError.message ?? 'Retryable error occurred',
      status: geminiError.status,
      code: geminiError.code
    };
  }

  // Non-retryable errors
  const nonRetryableStatuses = ['INVALID_ARGUMENT', 'NOT_FOUND', 'PERMISSION_DENIED'];
  
  if (nonRetryableStatuses.includes(geminiError.status ?? '')) {
    return {
      retryable: false,
      message: geminiError.message ?? 'Non-retryable error occurred',
      status: geminiError.status,
      code: geminiError.code
    };
  }

  // S3 or other errors - assume non-retryable
  return {
    retryable: false,
    message: error instanceof Error ? error.message : 'Unknown error'
  };
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const classified = classifyError(error);

      if (!classified.retryable || attempt === maxRetries) {
        throw new ProcessingError(
          classified.message,
          false,
          classified.status,
          classified.code
        );
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        30000
      );

      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms`, {
        error: classified.message,
        status: classified.status
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### S3 Client

```typescript
// src/s3-client.ts

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

export async function getObject(
  bucket: string,
  key: string
): Promise<{ buffer: Buffer; contentType?: string; metadata?: Record<string, string> }> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const response = await s3Client.send(command);
  
  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return {
    buffer,
    contentType: response.ContentType,
    metadata: response.Metadata as Record<string, string>
  };
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata
  });

  await s3Client.send(command);
}

export async function moveObject(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
): Promise<void> {
  // Copy to destination
  const copyCommand = new CopyObjectCommand({
    CopySource: `${sourceBucket}/${sourceKey}`,
    Bucket: destBucket,
    Key: destKey
  });
  await s3Client.send(copyCommand);

  // Delete from source
  const deleteCommand = new DeleteObjectCommand({
    Bucket: sourceBucket,
    Key: sourceKey
  });
  await s3Client.send(deleteCommand);
}

export async function putJsonResult(
  bucket: string,
  key: string,
  data: Record<string, unknown>
): Promise<void> {
  await putObject(
    bucket,
    key,
    JSON.stringify(data, null, 2),
    'application/json',
    {
      'processed-at': new Date().toISOString(),
      'pipeline-version': '1.0.0'
    }
  );
}
```

### Processor Logic

```typescript
// src/processor.ts

import { S3EventRecord } from 'aws-lambda';
import { GeminiClient } from './gemini-client';
import * as s3 from './s3-client';
import { withRetry, ProcessingError } from './errors';
import { InvoiceSchema, type InvoiceData } from './types';

export class ImageProcessor {
  private geminiClient: GeminiClient;
  private outputBucket: string;

  constructor(geminiApiKey: string, outputBucket: string) {
    this.geminiClient = new GeminiClient(geminiApiKey);
    this.outputBucket = outputBucket;
  }

  async processRecord(record: S3EventRecord): Promise<void> {
    const startTime = Date.now();
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing: s3://${bucket}/${key}`);

    try {
      // Get image from S3
      const { buffer, contentType, metadata } = await s3.getObject(bucket, key);

      console.log(`Retrieved ${buffer.length} bytes, type: ${contentType}`);

      // Validate image
      if (!this.isValidImage(contentType ?? '', buffer)) {
        throw new ProcessingError(
          `Invalid image type: ${contentType}`,
          false
        );
      }

      // Extract structured data with retry
      const extractionResult = await withRetry(
        () => this.extractInvoiceData(buffer, contentType ?? 'image/jpeg'),
        3,
        1000
      );

      const processingTimeMs = Date.now() - startTime;

      // Save result to output bucket
      const resultKey = `results/${key.replace(/\.[^/.]+$/, '')}.json`;
      await s3.putJsonResult(this.outputBucket, resultKey, {
        success: true,
        sourceKey: key,
        extractedData: extractionResult,
        processingTimeMs,
        processedAt: new Date().toISOString(),
        sourceMetadata: metadata
      });

      console.log(`Completed processing ${key} in ${processingTimeMs}ms`);

    } catch (error) {
      const processingError = error as ProcessingError;
      const processingTimeMs = Date.now() - startTime;

      // Log error details
      console.error(`Failed to process ${key}:`, {
        message: processingError.message,
        retryable: processingError.retryable,
        status: processingError.status,
        processingTimeMs
      });

      // Save error to output bucket
      const errorKey = `errors/${key.replace(/\.[^/.]+$/, '')}.error.json`;
      await s3.putJsonResult(this.outputBucket, errorKey, {
        success: false,
        sourceKey: key,
        error: processingError.message,
        retryable: processingError.retryable,
        processingTimeMs,
        processedAt: new Date().toISOString()
      });

      // Re-throw if retryable (will trigger Lambda retry)
      if (processingError.retryable) {
        throw error;
      }
    }
  }

  private async extractInvoiceData(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<InvoiceData> {
    return this.geminiClient.extractStructuredData(
      imageBuffer,
      mimeType,
      InvoiceSchema
    );
  }

  private isValidImage(contentType: string, buffer: Buffer): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    
    if (!validTypes.includes(contentType)) {
      console.warn(`Unsupported content type: ${contentType}`);
      return false;
    }

    // Check for minimum file size (1 byte)
    if (buffer.length < 1) {
      console.warn('Empty file');
      return false;
    }

    // Optional: Check magic numbers for common image formats
    const magicNumbers: Record<string, Uint8Array> = {
      'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
      'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
      'image/gif': new Uint8Array([0x47, 0x49, 0x46, 0x38])
    };

    const magic = magicNumbers[contentType as keyof typeof magicNumbers];
    if (magic) {
      const header = buffer.slice(0, magic.length);
      const matches = Array.from(header).every((byte, i) => byte === magic[i]);
      if (!matches) {
        console.warn(`Invalid magic number for ${contentType}`);
        return false;
      }
    }

    return true;
  }
}
```

### Lambda Handler

```typescript
// src/handler.ts

import { S3Event } from 'aws-lambda';
import { ImageProcessor } from './processor';

const processor = new ImageProcessor(
  process.env.GEMINI_API_KEY ?? '',
  process.env.OUTPUT_BUCKET ?? ''
);

export const handler = async (event: S3Event): Promise<void> => {
  console.log(`Received ${event.Records.length} S3 event(s)`);

  // Process all records in the event
  const processingPromises = event.Records.map(async (record) => {
    try {
      await processor.processRecord(record);
    } catch (error) {
      console.error('Record processing failed:', error);
      // Don't re-throw - we've already saved to error output
      // Lambda will retry the entire function if needed
    }
  });

  await Promise.all(processingPromises);

  console.log('Batch processing complete');
};
```

### Complete Lambda Handler (Alternative with Better Error Handling)

```typescript
// src/handler.ts

import { S3Event, S3EventRecord, Context } from 'aws-lambda';
import { ImageProcessor } from './processor';
import { ProcessingError } from './errors';
import * as s3 from './s3-client';

let processor: ImageProcessor | null = null;

function getProcessor(): ImageProcessor {
  if (!processor) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }
    if (!process.env.OUTPUT_BUCKET) {
      throw new Error('OUTPUT_BUCKET environment variable not set');
    }
    
    processor = new ImageProcessor(
      process.env.GEMINI_API_KEY,
      process.env.OUTPUT_BUCKET
    );
  }
  return processor;
}

export const handler = async (
  event: S3Event,
  context: Context
): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
  console.log(`Lambda ARN: ${context.functionName}`);
  console.log(`CloudWatch log stream: ${context.logStreamName}`);
  console.log(`Memory limit: ${context.memoryLimitInMB}MB`);
  console.log(`Remaining time: ${context.getRemainingTimeInMillis()}ms`);
  
  console.log(`Received ${event.Records.length} S3 event(s)`);

  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const attemptKey = `attempt-${context.invokedFunctionArn?.split(':').pop() ?? 'unknown'}-${key}`;

    try {
      console.log(`Processing: ${key}`);
      const proc = getProcessor();
      
      await proc.processRecord(record);
      
      console.log(`Successfully processed: ${key}`);
      
    } catch (error) {
      const processingError = error as ProcessingError;
      
      console.error(`Failed to process ${key}:`, {
        message: processingError.message,
        retryable: processingError.retryable,
        status: processingError.status,
        remainingTime: context.getRemainingTimeInMillis()
      });

      // If error is retryable and we have time, return failure for SQS/Lambda retry
      if (processingError.retryable && context.getRemainingTimeInMillis() > 10000) {
        batchItemFailures.push({
          itemIdentifier: record.s3.object.key
        });
      } else {
        // Already logged to error output bucket
        console.log(`Error logged for ${key}, continuing...`);
      }
    }
  }

  console.log(`Completed processing ${event.Records.length} record(s)`);
  
  // Return failed items for SQS retry (if using SQS as DLQ)
  return { batchItemFailures };
};
```

## Environment Configuration

```bash
# .env.example
AWS_REGION=us-east-1
GEMINI_API_KEY=your-gemini-api-key
OUTPUT_BUCKET=your-processed-bucket
TEMP_BUCKET=your-temp-bucket
```

### Lambda Environment Variables

```
GEMINI_API_KEY=<from parameter store or secrets manager>
OUTPUT_BUCKET=processed-results
```

### IAM Role Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CopyObject"
      ],
      "Resource": [
        "arn:aws:s3:::input-bucket/*",
        "arn:aws:s3:::processed-results/*",
        "arn:aws:s3:::temp-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::input-bucket",
        "arn:aws:s3:::processed-results",
        "arn:aws:s3:::temp-bucket"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/*"
    }
  ]
}
```

## Retry Patterns

### Lambda Retry Behavior

Lambda automatically retries failed invocations:
- **Synchronous sources**: API Gateway returns error to client
- **Asynchronous sources (S3)**: Lambda retries twice with 1-minute delay
- **Event source mapping (SQS, Kinesis)**: Depends on configuration

### Retry Configuration

```typescript
// Set maximum retries for Lambda (S3 invokes)
const MAX_LAMBDA_RETRY = 2; // Lambda will retry twice

// Configure retry in SDK calls
async function callGeminiWithRetry(): Promise<string> {
  const maxAttempts = 3;
  const baseDelay = 1000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await geminiCall();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw new Error('All retries exhausted');
}
```

### Dead Letter Queue (DLQ) Pattern

```typescript
// For Lambda async invocation with S3, use S3 as DLQ
const DLQ_BUCKET = process.env.DLQ_BUCKET;

async function handleRecordWithDLQ(record: S3EventRecord): Promise<void> {
  try {
    await processRecord(record);
  } catch (error) {
    // Write to DLQ bucket
    const errorKey = `dlq/${Date.now()}-${record.s3.object.key}`;
    await s3.putJsonResult(
      DLQ_BUCKET ?? '',
      errorKey,
      {
        originalKey: record.s3.object.key,
        bucket: record.s3.bucket.name,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        lambdaRequestId: process.env.AWS_REQUEST_ID
      }
    );
    
    console.log(`Sent to DLQ: ${errorKey}`);
  }
}
```

## Monitoring and Observability

### CloudWatch Metrics

```typescript
// Add metrics to your handler
import { MetricUnits } from '@aws-lambda-powertools/metrics';
import { MetricsLogger } from '@aws-lambda-powertools/metrics';

const metrics = new MetricsLogger({ namespace: 'ImageProcessing' });

export const handler = async (event: S3Event): Promise<void> => {
  metrics.putMetric('InvocationCount', event.Records.length, MetricUnits.Count);
  
  try {
    // Processing logic
    metrics.putMetric('SuccessCount', event.Records.length, MetricUnits.Count);
  } catch (error) {
    metrics.putMetric('ErrorCount', 1, MetricUnits.Count);
    throw error;
  } finally {
    await metrics.flush();
  }
};
```

### Structured Logging

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'ImageProcessor' });

logger.info('Processing started', {
  recordCount: event.Records.length,
  bucket: event.Records[0]?.s3.bucket.name
});

logger.error('Processing failed', {
  key: key,
  error: error.message,
  retryable: classifiedError.retryable
});
```

## Testing

### Unit Tests

```typescript
// src/processor.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageProcessor } from './processor';
import * as s3 from './s3-client';

vi.mock('./s3-client');

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  
  beforeEach(() => {
    processor = new ImageProcessor('test-api-key', 'test-output-bucket');
    vi.clearAllMocks();
  });
  
  describe('processRecord', () => {
    it('should process valid image and save result', async () => {
      const mockBuffer = Buffer.from('mock-image-data');
      const mockRecord = {
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'test-image.jpg' }
        }
      } as any;
      
      vi.mocked(s3.getObject).mockResolvedValue({
        buffer: mockBuffer,
        contentType: 'image/jpeg'
      });
      
      vi.mocked(s3.putJsonResult).mockResolvedValue(undefined);
      
      await processor.processRecord(mockRecord);
      
      expect(s3.getObject).toHaveBeenCalledWith('test-bucket', 'test-image.jpg');
      expect(s3.putJsonResult).toHaveBeenCalledWith(
        'test-output-bucket',
        expect.stringContaining('test-image.jpg'),
        expect.objectContaining({ success: true })
      );
    });
    
    it('should handle invalid image type', async () => {
      const mockRecord = {
        s3: {
          bucket: { name: 'test-bucket' },
          object: { key: 'test-document.pdf' }
        }
      } as any;
      
      vi.mocked(s3.getObject).mockResolvedValue({
        buffer: Buffer.from('pdf-data'),
        contentType: 'application/pdf'
      });
      
      await processor.processRecord(mockRecord);
      
      expect(s3.putJsonResult).toHaveBeenCalledWith(
        'test-output-bucket',
        expect.stringContaining('.error.json'),
        expect.objectContaining({ success: false })
      );
    });
  });
});
```

### Integration Test

```typescript
// tests/integration.test.ts

import { S3Event } from 'aws-lambda';
import { handler } from '../src/handler';

describe('Integration Tests', () => {
  it('should process uploaded image', async () => {
    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-upload-bucket' },
            object: { key: 'test-invoice.jpg' }
          }
        } as any
      ]
    };
    
    // Requires mocked S3 and Gemini API
    const result = await handler(event);
    
    expect(result).toBeDefined();
  });
});
```

## SST Deployment Configuration

```typescript
// sst.config.ts

import { SSTConfig } from 'sst';
import { S3Bucket, Function, Topic } from 'sst/aws';

export default {
  async main() {
    const uploadBucket = new S3Bucket('UploadBucket', {
      notifications: {
        onUpload: {
          handler: 'functions/handler.handler',
          filter: {
            suffix: ['.jpg', '.jpeg', '.png', '.webp']
          }
        }
      }
    });

    const resultsBucket = new S3Bucket('ResultsBucket');

    const processor = new Function('ImageProcessor', {
      handler: 'functions/handler.handler',
      timeout: '15 minutes',
      memorySize: 2048,
      permissions: [
        {
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [
            uploadBucket.arn + '/*',
            resultsBucket.arn + '/*'
          ]
        }
      ],
      environment: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
        OUTPUT_BUCKET: resultsBucket.name,
        POWERTOOLS_SERVICE_NAME: 'ImageProcessor'
      }
    });

    return {
      UploadBucket: uploadBucket.name,
      ResultsBucket: resultsBucket.name,
      ImageProcessor: processor.name
    };
  }
} satisfies SSTConfig;
```

## Performance Considerations

### Memory and Timeout Settings

```typescript
// For image processing, allocate adequate memory
const MEMORY_SIZE = 2048; // MB - adjust based on image size
const TIMEOUT = 900; // 15 minutes max
```

### Cold Start Optimization

```typescript
// Initialize clients outside handler scope
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY ?? '');

export const handler = async (event: S3Event): Promise<void> => {
  // Reuse clients - no cold start penalty
  await processEvent(event);
};
```

### Batch Size Configuration

```typescript
// Lambda S3 trigger batch settings
const BATCH_SIZE = 10; // Max 1000 for S3 events
const BATCH_WINDOW = 60; // Seconds - accumulate events
```

## Gotchas and Best Practices

### Critical Issues to Avoid

1. **Infinite Recursion**:
   ```typescript
   // ❌ BAD - writes back to triggering bucket
   await s3.putObject(bucket, `output/${key}`, result);
   
   // ✅ GOOD - write to different bucket or prefix
   await s3.putObject(OUTPUT_BUCKET, `results/${key}`, result);
   ```

2. **Memory Exhaustion**:
   ```typescript
   // ❌ BAD - process entire stream into memory
   const chunks = [];
   for await (const chunk of stream) { chunks.push(chunk); }
   
   // ✅ GOOD - process in chunks or use /tmp for large files
   ```

3. **Unhandled Array Iteration**:
   ```typescript
   // ❌ BAD - forEach doesn't await
   event.Records.forEach(async (record) => {
     await processRecord(record); // May not complete
   });
   
   // ✅ GOOD - Promise.all waits for all
   await Promise.all(event.Records.map(processRecord));
   ```

4. **Key Encoding**:
   ```typescript
   // ❌ BAD - S3 keys are URL-encoded
   const key = record.s3.object.key; // "uploads/test%2Fimage.jpg"
   
   // ✅ GOOD - always decode
   const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
   ```

### Success Metrics

- ✅ **Idempotent**: Same image produces same result
- ✅ **Retry-safe**: Handles transient failures gracefully
- ✅ **Observable**: Structured logging and metrics
- ✅ **Testable**: Unit and integration tests
- ✅ **Configurable**: Environment-based configuration
- ✅ **Error-resilient**: DLQ for unprocessable items

## Output Schema Examples

### Success Output

```json
{
  "success": true,
  "sourceKey": "uploads/invoice-001.jpg",
  "extractedData": {
    "invoice_number": "INV-2024-001",
    "date": "2024-01-15",
    "vendor": "Acme Corp",
    "total_amount": 1250.00,
    "line_items": [
      {
        "description": "Service Fee",
        "quantity": 1,
        "unit_price": 1000.00
      },
      {
        "description": "Tax",
        "quantity": 1,
        "unit_price": 250.00
      }
    ],
    "confidence": 0.95
  },
  "processingTimeMs": 2450,
  "processedAt": "2024-01-15T10:30:00.000Z",
  "sourceMetadata": {
    "uploaded-by": "user@example.com"
  }
}
```

### Error Output

```json
{
  "success": false,
  "sourceKey": "uploads/corrupted-image.jpg",
  "error": "Invalid image data: image format not recognized",
  "retryable": false,
  "processingTimeMs": 150,
  "processedAt": "2024-01-15T10:30:00.000Z"
}
```

## Further Reading

- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [AWS Lambda S3 Integration](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html)
- [SST Image Processing Guide](https://docs.sst.dev/)
- [Lambda Powertools](https://awslabs.github.io/aws-lambda-powertools-typescript/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

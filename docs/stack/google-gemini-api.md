# Google Gemini API - Node.js/TypeScript Integration

*Source: [Google AI Gemini API Documentation](https://ai.google.dev/gemini-api/docs), [js-genai SDK](https://github.com/googleapis/js-genai)*
*Version: @google/genai v1.40+*
*Last Updated: February 2026*

## Overview

The Google Gemini API enables multimodal AI capabilities for text, image, video, and audio processing. For image text extraction, Gemini 1.5/2.0 Flash models provide fast, cost-effective OCR and content analysis with structured JSON output support.

## Key Concepts

- **Models**: `gemini-2.5-flash` (recommended for images), `gemini-2.5-pro` (higher quality)
- **SDK**: `@google/genai` (modern) or `@google-cloud/vertexai` (Vertex AI)
- **Input Methods**: Base64-encoded images or GCS URLs
- **Output Modes**: Free-form text or structured JSON schemas

## Installation

```bash
npm install @google/genai
```

## Authentication Patterns

### Option 1: API Key (Google AI Studio) - Recommended for Development

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});
```

Set environment variable:
```bash
export GEMINI_API_KEY='your-api-key'
```

### Option 2: Vertex AI (Production/Enterprise)

```typescript
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
});
```

Set environment variables:
```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT='your-project-id'
export GOOGLE_CLOUD_LOCATION='us-central1'
```

### Security Best Practice
- **Never expose API keys in client-side code**
- Use server-side implementations in production
- Implement API key rotation policies

## Image Input Handling

### Method 1: Base64-Encoded Images (Recommended for Small Images)

```typescript
import * as fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractTextFromImage(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { 
        type: 'text', 
        text: 'Extract all text from this image. Return the extracted text exactly as it appears.' 
      },
      { 
        type: 'image', 
        data: base64Image, 
        mime_type: 'image/png' // or 'image/jpeg'
      }
    ]
  });
  
  return response.text ?? '';
}
```

**Supported MIME Types**: `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif`

**Base64 Encoding Best Practices**:
```typescript
// Correct: Use Buffer.from() for proper encoding
const base64Image = Buffer.from(imageBuffer).toString('base64');

// For web uploads (File API):
const base64Image = await file.arrayBuffer()
  .then(buffer => Buffer.from(buffer).toString('base64'));

// Always validate before sending
if (imageBuffer.length > 20 * 1024 * 1024) {
  throw new Error('Image exceeds 20MB limit');
}
```

### Method 2: Cloud Storage URLs (Recommended for Large Images)

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    { 
      type: 'text', 
      text: 'Describe what you see in this image.' 
    },
    { 
      type: 'image', 
      file_uri: 'gs://your-bucket/path/to/image.jpg'
    }
  ]
});
```

**Benefits of GCS URLs**:
- No base64 encoding overhead
- Better for images >5MB
- Reduced bandwidth costs
- Recommended for production pipelines

**Requirements**:
- GCS bucket must be publicly accessible OR
- Use Vertex AI with proper IAM permissions

## Structured JSON Extraction

### Using Zod Schema (Recommended)

```typescript
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define your extraction schema
const DocumentSchema = z.object({
  title: z.string().describe('Document title or header'),
  extractedText: z.string().describe('All text content extracted from the image'),
  language: z.string().optional().describe('Detected language of the text'),
  confidence: z.number().describe('Extraction confidence score 0-1'),
  sections: z.array(
    z.object({
      heading: z.string().optional(),
      content: z.string(),
      boundingBox: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      }).optional()
    })
  ).optional()
});

const jsonSchema = zodToJsonSchema(DocumentSchema);

async function extractStructuredData(imagePath: string): Promise<z.infer<typeof DocumentSchema>> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { 
        type: 'text', 
        text: 'Extract structured data from this document image. Follow the provided schema exactly.' 
      },
      { type: 'image', data: base64Image, mime_type: 'image/jpeg' }
    ],
    config: {
      response_mime_type: 'application/json',
      response_json_schema: jsonSchema
    }
  });
  
  if (!response.text) {
    throw new Error('No response text from Gemini API');
  }
  
  // Parse and validate the response
  const parsedData = JSON.parse(response.text);
  return DocumentSchema.parse(parsedData);
}
```

### Alternative: Direct JSON Schema

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    { type: 'text', text: 'Extract invoice details as JSON' },
    { type: 'image', data: base64Image, mime_type: 'image/png' }
  ],
  config: {
    response_mime_type: 'application/json',
    response_json_schema: {
      type: 'object',
      properties: {
        invoice_number: { type: 'string', description: 'Invoice number' },
        date: { type: 'string', description: 'Invoice date' },
        total_amount: { type: 'number', description: 'Total amount due' },
        line_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' }
            }
          }
        }
      },
      required: ['invoice_number', 'date', 'total_amount']
    }
  }
});
```

## Error Handling Patterns

### Comprehensive Error Handler

```typescript
import { GoogleGenAI } from '@google/genai';

interface GeminiError {
  name: string;
  message: string;
  status?: string;
  code?: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

async function callGeminiWithRetry<T>(
  request: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await request();
    } catch (error) {
      const geminiError = error as GeminiError;
      lastError = new Error(geminiError.message);
      lastError.name = geminiError.name;
      
      // Classify error for appropriate handling
      const isRetryable = shouldRetryError(geminiError);
      
      if (!isRetryable || attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Calculate exponential backoff with jitter
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1) 
          + Math.random() * 1000,
        config.maxDelayMs
      );
      
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`, {
        error: geminiError.message,
        status: geminiError.status
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

function shouldRetryError(error: GeminiError): boolean {
  // Server errors - retry with backoff
  const serverErrors = ['INTERNAL', 'UNAVAILABLE', 'DEADLINE_EXCEEDED'];
  if (serverErrors.includes(error.status)) {
    return true;
  }
  
  // Rate limiting - retry
  if (error.status === 'RESOURCE_EXHAUSTED' || error.code === 429) {
    return true;
  }
  
  // Client errors - don't retry
  const clientErrors = ['INVALID_ARGUMENT', 'NOT_FOUND', 'PERMISSION_DENIED'];
  if (clientErrors.includes(error.status)) {
    return false;
  }
  
  // Unknown error - default to retry
  return true;
}
```

### Error Code Reference

| HTTP Code | Status | Description | Retry? | Action |
|-----------|--------|-------------|--------|--------|
| 400 | INVALID_ARGUMENT | Malformed request | ❌ | Fix request payload |
| 400 | FAILED_PRECONDITION | Free tier not available in region | ❌ | Enable billing |
| 404 | NOT_FOUND | Resource not found | ❌ | Check file URIs |
| 429 | RESOURCE_EXHAUSTED | Rate limit exceeded | ✅ | Wait + retry |
| 500 | INTERNAL | Server-side error | ✅ | Retry with backoff |
| 503 | UNAVAILABLE | Service overloaded | ✅ | Wait + retry |
| 504 | DEADLINE_EXCEEDED | Request timeout | ✅ | Retry with longer timeout |

### Production Error Handler Example

```typescript
async function safeExtractText(imagePath: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const result = await callGeminiWithRetry(
      () => extractTextFromImage(imagePath),
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      }
    );
    
    return { success: true, data: result };
  } catch (error) {
    const geminiError = error as GeminiError;
    
    // Log structured error for monitoring
    console.error('Gemini API Error:', {
      errorName: geminiError.name,
      errorMessage: geminiError.message,
      errorStatus: geminiError.status,
      errorCode: geminiError.code,
      timestamp: new Date().toISOString(),
      imagePath
    });
    
    // Return user-friendly error
    return { 
      success: false, 
      error: getUserFriendlyError(geminiError) 
    };
  }
}

function getUserFriendlyError(error: GeminiError): string {
  switch (error.status) {
    case 'RESOURCE_EXHAUSTED':
      return 'Rate limit exceeded. Please try again in a few moments.';
    case 'UNAVAILABLE':
      return 'Service temporarily unavailable. Retrying...';
    case 'INVALID_ARGUMENT':
      return 'Invalid image format. Please upload a supported image type.';
    case 'PERMISSION_DENIED':
      return 'Access denied. Please check your API credentials.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
```

## Common Patterns

### Pattern 1: Document OCR with Confidence Scoring

```typescript
interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    boundingBox: BoundingBox;
  }>;
}

async function ocrWithConfidence(imagePath: string): Promise<OCRResult> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { 
        type: 'text', 
        text: `Perform OCR on this image. Return JSON with:
        - text: full extracted text
        - confidence: overall confidence 0-1
        - words: array of words with text, confidence, and bounding box coordinates`
      },
      { type: 'image', data: base64Image, mime_type: 'image/png' }
    ],
    config: {
      response_mime_type: 'application/json',
      response_json_schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          confidence: { type: 'number' },
          words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                confidence: { type: 'number' },
                boundingBox: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  
  return JSON.parse(response.text!);
}
```

### Pattern 2: Batch Image Processing

```typescript
async function processBatch(imagePaths: string[], concurrency: number = 5): Promise<Array<{
  path: string;
  result: string;
  error?: string;
}>> {
  const chunks = [];
  
  for (let i = 0; i < imagePaths.length; i += concurrency) {
    chunks.push(imagePaths.slice(i, i + concurrency));
  }
  
  const results = [];
  
  for (const chunk of chunks) {
    const batchResults = await Promise.all(
      chunk.map(async (path) => {
        try {
          const text = await extractTextFromImage(path);
          return { path, result: text };
        } catch (error) {
          return { 
            path, 
            result: '', 
            error: (error as Error).message 
          };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}
```

### Pattern 3: Preprocessing for Better Results

```typescript
async function preprocessAndExtract(imagePath: string): Promise<string> {
  // Validate image before sending
  const stats = fs.statSync(imagePath);
  if (stats.size > 20 * 1024 * 1024) {
    throw new Error('Image exceeds 20MB limit');
  }
  
  // Optionally resize large images
  const MAX_DIMENSION = 4096;
  // Use sharp or similar library to resize if needed
  
  // Extract text
  return extractTextFromImage(imagePath);
}
```

## Configuration Options

### Model Selection

```typescript
// For fast, cost-effective extraction
const fastModel = 'gemini-2.5-flash';

// For higher quality (slower, more expensive)
const qualityModel = 'gemini-2.5-pro';

// For high-volume, simple extraction
const liteModel = 'gemini-2.0-flash-lite';
```

### Generation Config

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [...],
  config: {
    temperature: 0.1,        // Lower = more consistent
    max_output_tokens: 2048,  // Limit response length
    top_p: 0.9,              // Nucleus sampling
    response_mime_type: 'application/json'
  }
});
```

## Integration with Our Stack

For integration with SST/Remix:

```typescript
// In a Lambda function (SST)
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

export async function extractFromImage(bucket: string, key: string) {
  // Get image from S3
  const { Body } = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  const base64Image = Body?.toString('base64');
  
  // Call Gemini API
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { type: 'text', text: 'Extract all text from this image.' },
      { type: 'image', data: base64Image, mime_type: 'image/jpeg' }
    ]
  });
  
  return response.text;
}
```

## Gotchas and Best Practices

### Do:
- ✅ Use base64 for images < 5MB, GCS URLs for larger images
- ✅ Implement exponential backoff with jitter for retries
- ✅ Validate image dimensions and size before sending
- ✅ Use structured JSON schemas for consistent extraction
- ✅ Set appropriate timeouts (60-120 seconds for image processing)
- ✅ Log errors with context for debugging

### Don't:
- ❌ Expose API keys in client-side code
- ❌ Retry client errors (400, 403, 404)
- ❌ Send images > 20MB without resizing
- ❌ Use base64 for videos (use GCS URLs)
- ❌ Ignore rate limits (429 errors)

### Performance Tips:
- Use `gemini-2.5-flash` for fastest response times
- Cache successful API responses for repeated extractions
- Consider preprocessing images to reduce token usage
- Monitor API usage with Google Cloud Console

## Further Reading

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [js-genai SDK Reference](https://googleapis.github.io/js-genai/)
- [Structured Outputs Guide](https://ai.google.dev/gemini-api/docs/structured-output)
- [Error Codes Reference](https://ai.google.dev/gemini-api/docs/troubleshooting)
- [Vertex AI Setup](https://cloud.google.com/vertex-ai/docs/start)

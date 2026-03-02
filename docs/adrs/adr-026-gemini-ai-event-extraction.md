# ADR-026: Google Gemini AI for Event Extraction

## Status
Accepted

## Context
Classical arts events in India are promoted primarily through:
1. **Posters** — uploaded to S3 by users or scraped from social media
2. **Social media posts** — Instagram captions and images from organisers/sabhas

Manually entering event data from these sources is tedious and error-prone. We needed a way to automatically extract structured event data (title, date, venue, artists, organiser) from both images and text.

The extraction problem requires:
- **Multimodal input**: Reading text from poster images (OCR + understanding)
- **Structured output**: JSON matching our event/festival schemas
- **Indian context**: Understanding transliterated names, sabha names, Carnatic/Hindustani terminology
- **Two-step reasoning**: First classify the poster type (single event, festival, multi-event), then extract accordingly

## Decision
Use **Google Gemini 2.5 Flash** (`gemini-2.5-flash`) via the `@google/genai` SDK for all AI-powered extraction.

Two extraction pipelines exist:
1. **Poster extraction** (`event/gemini.ts`): S3 image → classify → extract → create draft events
2. **Social post extraction** (`event/gemini.ts`): Instagram caption + optional image → extract → create draft event

Both use Zod schemas (`ExtractionResultSchema`) converted to JSON Schema via `zod-to-json-schema` to enforce structured output (`responseMimeType: 'application/json'`).

**Poster deduplication** uses a hash of the image stored in a `PosterHash` DynamoDB entity — re-uploading the same poster skips extraction.

## Consequences

### Positive
- ✅ **Multimodal**: Handles both image OCR and text understanding in one model call
- ✅ **Structured output**: `responseMimeType: 'application/json'` + JSON schema gives reliable extraction
- ✅ **Indian context**: Gemini has strong understanding of Indian names, classical arts terminology
- ✅ **Low temperature**: `temperature: 0.1` for deterministic, factual extraction
- ✅ **Cost-effective**: Flash model is cheap per invocation
- ✅ **Schema-driven**: Extraction schemas derived from create schemas — Zod validates AI output
- ✅ **Deduplication**: Hash-based check prevents duplicate processing of the same poster

### Negative
- ❌ **Hallucinations**: AI may infer incorrect dates, venues, or artist names
- ❌ **Always a draft**: All AI-extracted events require human review before approval
- ❌ **External dependency**: Requires Google AI API key; subject to availability and pricing changes
- ❌ **Latency**: Extraction takes 2–10 seconds per poster
- ❌ **Image fetch**: Social post images must be fetched and base64-encoded before sending

## Alternatives Considered

### AWS Textract + custom parsing
- **Pros**: AWS-native, no external API
- **Cons**: OCR only, no semantic understanding, can't handle Indian script or context
- **Why rejected**: Not capable of extracting structured event data from complex posters

### OpenAI GPT-4 Vision
- **Pros**: Strong multimodal model
- **Cons**: Higher cost per call, similar capability for this use case, adds another vendor
- **Why rejected**: Gemini Flash is cost-equivalent or cheaper with comparable quality

### Manual data entry only
- **Pros**: Highest accuracy
- **Cons**: Doesn't scale, bottleneck for community growth
- **Why rejected**: Defeats the goal of low-friction event submission

## Implementation Details

### Extraction pipeline (poster)
1. User uploads poster image → stored in S3
2. SHA-256 hash computed → checked against `PosterHashEntity` (deduplicate)
3. Image fetched from S3, base64-encoded
4. Gemini classifies: `single-event` | `festival` | `multi-event`
5. Gemini extracts structured data per type using JSON schema prompt
6. Output validated with `ExtractionResultSchema.parse(raw)`
7. Draft events/festival created with `extractionConfidence` recorded
8. Human moderator reviews and approves

### Extraction pipeline (social post)
1. Instagram post scraped → stored as `SocialPost` with status `pending`
2. SQS message triggers Lambda (`packages/scraper`)
3. Post text + optional image sent to Gemini
4. Draft event created; post status updated to `processed` or `failed`

### Schema design
Extraction schemas are derived from create schemas with relaxed validators:
- Dates use `z.coerce.string()` (Gemini may return date objects)
- URL/email validators removed
- Nullable fields more permissive than user-facing schemas

## References
- `packages/core/src/domain/event/gemini.ts` — extraction implementation
- `packages/core/src/domain/event/extraction.ts` — Zod schemas
- `packages/core/src/domain/event/poster-hash.ts` — deduplication entity
- `packages/scraper/` — social post extraction Lambda
- [Google Gemini API docs](https://ai.google.dev/gemini-api/docs)
- [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)

import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ClassificationResult, ExtractionResult, PosterType } from './extraction';
import { ClassificationResultSchema, ExtractionResultSchema } from './extraction';

// --- JSON Schemas for prompts ---

const classificationJsonSchema = JSON.stringify(
  zodToJsonSchema(ClassificationResultSchema, { $refStrategy: 'none' }),
  null,
  2
);

const extractionJsonSchema = JSON.stringify(
  zodToJsonSchema(ExtractionResultSchema, { $refStrategy: 'none' }),
  null,
  2
);

// --- Prompts ---

const CLASSIFICATION_PROMPT = `You are an expert at reading Indian classical arts event posters.

Look at this poster image and classify it into one of three categories:

1. "single-event": A poster advertising a single concert, recital, or performance.
   Examples: one artist or ensemble performing on one date at one venue.

2. "festival": A multi-day festival or music season with a schedule of multiple performances.
   Examples: aradhana festivals, music seasons with daily concerts over several days.

3. "multi-event": Multiple separate events on one poster that are NOT part of a named festival.
   Examples: a sabha advertising two unrelated concerts on the same day,
   or a poster with a morning and evening concert by different artists.

Also provide a brief one-sentence English summary of what the poster depicts.
Example summaries:
- "Carnatic vocal concert by Vid. Bhargavi Venkataram at Gayana Samaja, Bangalore on Feb 15"
- "3-day Thyagaraja Aradhana festival at Sree Rama Seva Mandali, Jan 20-22"
- "Two concerts: morning veena recital and evening vocal by different artists"

Return a JSON object matching this JSON Schema:
${classificationJsonSchema}`;

const SHARED_EXTRACTION_RULES = `IMPORTANT RULES:
1. If text is in any Indic language (Kannada, Tamil, Telugu, Hindi, Sanskrit, etc.),
   translate it to English while preserving proper nouns and names.
2. Separate honorific titles from artist names:
   - "Vid." / "Vidwan" / "Vidushi" / "Smt." / "Sri" / "Kum." / "Pt." / "Dr." / "Padmashri"
     go into the "title" field
   - The actual name goes into the "name" field
   - Example: "Vidwan Hosalli Raghuram" → { title: "Vidwan", name: "Hosalli Raghuram" }
3. Identify chief guests and guests of honour with role "chief-guest" or "guest-of-honour".
   They are NOT performing artists.
4. Identify the art form(s) from context and include as tags:
   - Music: carnatic, hindustani, light-music, bhajan, devotional, film-music
   - Dance: bharatanatyam, kuchipudi, mohiniyattam, odissi, kathak
   - Other: harikatha, jugalbandhi, orchestra
5. Classify event types as tags: concert, dance-recital, festival, aradhana,
   debut, award-ceremony, jugalbandhi, lecture-demonstration
6. Determine entry type: "free" if "all are welcome" / "entry free",
   "ticketed" if prices are shown, "by-invitation" if invite-only.
7. Extract ticket prices as key-value pairs: { "general": 500, "vip": 1500 }
8. Extract sponsor names and classify as "sponsor" or "co-sponsor".
9. Extract all contact information (phone numbers, emails, social handles).
10. All date/datetime values MUST be ISO 8601 strings (e.g. "2026-02-15T18:00:00+05:30").`;

const SINGLE_EVENT_PROMPT = `You are an expert at reading Indian classical arts event posters.
This poster advertises a SINGLE event (one concert, recital, or performance).

Extract all details about this one event.

${SHARED_EXTRACTION_RULES}

SINGLE EVENT SPECIFIC INSTRUCTIONS:
- There is exactly ONE event. Return it as the sole element of the "events" array.
- Set "isFestival" to false and "festival" to null.
- Pay close attention to the full artist lineup:
  * Main artist(s) with their instrument/voice type as "role" (e.g. "vocal", "veena")
  * Accompanists: violin, mridangam, ghatam, tabla, flute, etc.
  * The lead performer(s) are usually in the largest font on the poster.
- Extract the complete venue details: name, street, city, state, postal code.
- If the organiser is listed, extract their name and contact info.

Return a JSON object matching this JSON Schema:
${extractionJsonSchema}`;

const FESTIVAL_PROMPT = `You are an expert at reading Indian classical arts event posters.
This poster advertises a FESTIVAL — a multi-day event with multiple performances.

Extract the festival metadata AND each individual performance as a separate event.

${SHARED_EXTRACTION_RULES}

FESTIVAL SPECIFIC INSTRUCTIONS:
- Set "isFestival" to true.
- Extract festival-level metadata: name, description, startDate, endDate, organiser, tags, sponsors.
- For each individual performance in the schedule, create a separate entry in "events".
- Each event needs its own startDateTime, title, artists, and venue (if different per event).
- If all events share the same venue, repeat it for each event.
- For multi-day recurring NON-MUSIC/NON-ARTS items (daily puja, abhisheka, processions, bhojan),
  do NOT create separate events — mention them in the festival description instead.
- Preserve the chronological order of events in the array.
- If event times are not specified individually, use reasonable defaults (e.g. evening concerts at 18:00).

Return a JSON object matching this JSON Schema:
${extractionJsonSchema}`;

const MULTI_EVENT_PROMPT = `You are an expert at reading Indian classical arts event posters.
This poster advertises MULTIPLE SEPARATE EVENTS that are not part of a named festival.

Extract each event individually.

${SHARED_EXTRACTION_RULES}

MULTI-EVENT SPECIFIC INSTRUCTIONS:
- Set "isFestival" to false and "festival" to null.
- Create a separate entry in the "events" array for each distinct event/performance.
- Look for visual or textual separators between events on the poster:
  different dates, different time slots, different artists, horizontal rules, etc.
- Each event needs its own title, startDateTime, artists, and venue.
- If events share a venue, repeat the venue info for each.
- If events share an organiser, repeat the organiser info for each.

Return a JSON object matching this JSON Schema:
${extractionJsonSchema}`;

// --- Helpers ---

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
}

interface ImageData {
  data: string;
  mimeType: string;
}

async function fetchImageAsBase64(url: string): Promise<ImageData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const data = Buffer.from(buffer).toString('base64');

  return { data, mimeType: contentType };
}

async function callGemini(ai: GoogleGenAI, prompt: string, imageData: ImageData, hint?: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          ...(hint ? [{ text: `ADDITIONAL CONTEXT (Instagram auto-generated caption):\n${hint}\n\n` }] : []),
          { text: prompt },
          { inlineData: { data: imageData.data, mimeType: imageData.mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error('Empty response from Gemini API');
  }

  return response.text;
}

// --- Step 1: Classification ---

async function classifyPoster(
  ai: GoogleGenAI,
  imageData: ImageData,
  hint?: string
): Promise<ClassificationResult> {
  const text = await callGemini(ai, CLASSIFICATION_PROMPT, imageData, hint);
  const raw = JSON.parse(text);
  return ClassificationResultSchema.parse(raw);
}

// --- Step 2: Specialized extraction ---

function getPromptForType(posterType: PosterType): string {
  switch (posterType) {
    case 'single-event':
      return SINGLE_EVENT_PROMPT;
    case 'festival':
      return FESTIVAL_PROMPT;
    case 'multi-event':
      return MULTI_EVENT_PROMPT;
  }
}

async function extractByType(
  ai: GoogleGenAI,
  imageData: ImageData,
  classification: ClassificationResult,
  hint?: string
): Promise<ExtractionResult> {
  const prompt = getPromptForType(classification.posterType);

  const text = await callGemini(ai, prompt, imageData, hint);
  const raw = JSON.parse(text);
  return ExtractionResultSchema.parse(raw);
}

// --- Social post extraction ---

const SOCIAL_POST_PROMPT = `You are an expert at identifying Indian classical arts events from social media posts.

Analyze this Instagram post (caption and optional image) and determine if it announces a concert,
recital, performance, or festival.

${SHARED_EXTRACTION_RULES}

SOCIAL POST SPECIFIC INSTRUCTIONS:
- Many posts are NOT event announcements (photos, news, tributes, general content). If no event is
  described, return isFestival=false, festival=null, events=[], confidence=0.
- If an event is found, extract it exactly as you would from a poster.
- The caption text provides the most reliable information — use it as the primary source.
- If an image is provided, use it to supplement the caption (dates, venue details, artist photos).
- Instagram captions often contain emoji, hashtags, and informal language — normalise to structured
  data. Strip hashtags from extracted fields.
- If the post is for a past event and no date is clear, set confidence below 0.4.

Return a JSON object matching this JSON Schema:
${extractionJsonSchema}`;

export interface SocialPostInput {
  postText?: string;
  mediaUrl?: string;
}

export async function extractFromSocialPost(input: SocialPostInput): Promise<ExtractionResult> {
  if (!input.postText && !input.mediaUrl) {
    return ExtractionResultSchema.parse({
      isFestival: false,
      festival: null,
      events: [],
      confidence: 0,
    });
  }

  const ai = getGeminiClient();

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  parts.push({ text: SOCIAL_POST_PROMPT });

  if (input.postText) {
    parts.push({ text: `\n\nINSTAGRAM POST CAPTION:\n${input.postText}` });
  }

  if (input.mediaUrl) {
    try {
      const imageData = await fetchImageAsBase64(input.mediaUrl);
      parts.push({ inlineData: { data: imageData.data, mimeType: imageData.mimeType } });
    } catch {
      // Image fetch failed — continue with text-only extraction
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  if (!response.text) {
    throw new Error('Empty response from Gemini API');
  }

  const raw = JSON.parse(response.text);
  return ExtractionResultSchema.parse(raw);
}

// --- Public API ---

export async function extractFromPoster(posterUrl: string, hint?: string): Promise<ExtractionResult> {
  const ai = getGeminiClient();
  const imageData = await fetchImageAsBase64(posterUrl);

  let classification: ClassificationResult;
  try {
    classification = await classifyPoster(ai, imageData, hint);
  } catch (error) {
    console.error('[Gemini] ERROR: Classification failed:', error);
    throw error;
  }

  let result: ExtractionResult;
  try {
    result = await extractByType(ai, imageData, classification, hint);
  } catch (error) {
    console.error('[Gemini] ERROR: Extraction failed:', error);
    throw error;
  }

  return result;
}

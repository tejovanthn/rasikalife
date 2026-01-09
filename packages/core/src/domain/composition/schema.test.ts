import { describe, it, expect } from 'vitest';
import { createCompositionSchema } from './schema';

describe('Composition Schema with Structured Verses', () => {
  it('should validate structured verses', () => {
    const validComposition = {
      title: 'Test Composition',
      language: 'Sanskrit',
      tradition: 'carnatic' as const,
      structuredVerses: [
        {
          type: 'pallavi' as const,
          order: 1,
          text: 'Sample pallavi text',
        },
        {
          type: 'anupallavi' as const,
          order: 2,
          text: 'Sample anupallavi text',
        },
      ],
      editorId: 'test-user',
    };

    const result = createCompositionSchema.safeParse(validComposition);
    if (!result.success) {
      console.log('Validation errors:', result.error.issues);
    }
    expect(result.success).toBe(true);
  });

  it('should accept both structured verses and simple verses', () => {
    const compositionWithBoth = {
      title: 'Test Composition',
      language: 'Tamil',
      tradition: 'carnatic' as const,
      verses: 'Simple verses text',
      structuredVerses: [
        {
          type: 'lyrics' as const,
          order: 1,
          text: 'Structured verses text',
        },
      ],
      editorId: 'test-user',
    };

    const result = createCompositionSchema.safeParse(compositionWithBoth);
    expect(result.success).toBe(true);
  });

  it('should validate metadata', () => {
    const compositionWithMetadata = {
      title: 'Test Composition',
      language: 'Telugu',
      tradition: 'carnatic' as const,
      metadata: {
        hasRagaDetails: true,
        hasTalaDetails: false,
        lyricSections: 2,
        sectionTypes: ['pallavi', 'caraNam'],
      },
      editorId: 'test-user',
    };

    const result = createCompositionSchema.safeParse(compositionWithMetadata);
    expect(result.success).toBe(true);
  });
});

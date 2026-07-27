import { describe, expect, it } from 'vitest';
import { readClearableField, readOptionalInt } from './form-fields';

function formDataWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('readClearableField', () => {
  it('returns undefined when the field was not submitted at all', () => {
    const formData = formDataWith({ other: 'x' });
    expect(readClearableField(formData, 'caption')).toBeUndefined();
  });

  it('returns an empty string when the field was submitted empty', () => {
    const formData = formDataWith({ caption: '' });
    expect(readClearableField(formData, 'caption')).toBe('');
  });

  it('returns an empty string when the field was submitted as whitespace', () => {
    const formData = formDataWith({ caption: '   ' });
    expect(readClearableField(formData, 'caption')).toBe('');
  });

  it('returns the trimmed value when present', () => {
    const formData = formDataWith({ caption: '  On stage  ' });
    expect(readClearableField(formData, 'caption')).toBe('On stage');
  });
});

describe('readOptionalInt', () => {
  // The bug this guards: `Number.parseInt(raw, 10) || undefined` maps 0 to undefined,
  // which a patch handler reads as "leave alone" — so moving a gallery photo into the
  // first slot submitted order 0 and silently wrote nothing.
  it('returns 0 rather than undefined when the field is zero', () => {
    const formData = formDataWith({ order: '0' });
    expect(readOptionalInt(formData, 'order')).toBe(0);
  });

  it('returns undefined when the field was not submitted at all', () => {
    const formData = formDataWith({ other: 'x' });
    expect(readOptionalInt(formData, 'order')).toBeUndefined();
  });

  it('returns undefined when the field was submitted empty or as whitespace', () => {
    expect(readOptionalInt(formDataWith({ order: '' }), 'order')).toBeUndefined();
    expect(readOptionalInt(formDataWith({ order: '  ' }), 'order')).toBeUndefined();
  });

  it('returns undefined when the value does not parse as a number', () => {
    const formData = formDataWith({ order: 'first' });
    expect(readOptionalInt(formData, 'order')).toBeUndefined();
  });

  it('rejects rather than silently truncating a non-integer', () => {
    // parseInt reads a prefix: '12.7' would come back as 12 and '1e3' as 1.
    expect(readOptionalInt(formDataWith({ order: '12.7' }), 'order')).toBeUndefined();
    expect(readOptionalInt(formDataWith({ order: '12abc' }), 'order')).toBeUndefined();
  });

  it('accepts a negative integer, leaving range checks to the schema', () => {
    expect(readOptionalInt(formDataWith({ order: '-3' }), 'order')).toBe(-3);
  });

  it('parses a positive integer', () => {
    const formData = formDataWith({ order: ' 12 ' });
    expect(readOptionalInt(formData, 'order')).toBe(12);
  });
});

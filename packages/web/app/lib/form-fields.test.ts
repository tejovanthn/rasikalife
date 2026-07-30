import { describe, expect, it } from 'vitest';
import { readClearableField, readOptionalInt, readRepeatedRows } from './form-fields';

function formDataWith(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

/** Repeated names, the way a list of rows actually arrives from the wizard. */
function formDataWithRows(columns: Record<string, string[]>): FormData {
  const formData = new FormData();
  for (const [key, values] of Object.entries(columns)) {
    for (const value of values) formData.append(key, value);
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

describe('readRepeatedRows', () => {
  const spec = {
    required: 'workTitle',
    strings: { role: 'workRole' },
    numbers: { year: 'workYear' },
  };

  it('reads parallel columns into one object per row', () => {
    const formData = formDataWithRows({
      workTitle: ['Shivarpanam', 'Matrutvam'],
      workRole: ['director', 'director'],
      workYear: ['2019', '2023'],
    });

    expect(readRepeatedRows(formData, spec)).toEqual([
      { required: 'Shivarpanam', rest: { role: 'director', year: 2019 } },
      { required: 'Matrutvam', rest: { role: 'director', year: 2023 } },
    ]);
  });

  // A moderator who adds a row and then leaves it blank means to add nothing, so an empty
  // required field drops the row rather than submitting a titleless work that fails Zod.
  it('drops a row whose required field is blank', () => {
    const formData = formDataWithRows({
      workTitle: ['Ramayanam', '   ', ''],
      workRole: ['director', 'director', ''],
      workYear: ['2021', '2022', ''],
    });

    expect(readRepeatedRows(formData, spec).map(r => r.required)).toEqual(['Ramayanam']);
  });

  // Rows correlate by index, so dropping row 0 must not shift row 1's year onto it.
  it('keeps columns aligned by index when an earlier row is dropped', () => {
    const formData = formDataWithRows({
      workTitle: ['', 'Matrutvam'],
      workRole: ['', 'director'],
      workYear: ['1999', '2023'],
    });

    expect(readRepeatedRows(formData, spec)).toEqual([
      { required: 'Matrutvam', rest: { role: 'director', year: 2023 } },
    ]);
  });

  it('omits a blank optional rather than setting it undefined', () => {
    const formData = formDataWithRows({
      workTitle: ['Matrutvam'],
      workRole: [''],
      workYear: [''],
    });

    const [row] = readRepeatedRows(formData, spec);
    expect(row.rest).toEqual({});
    expect('role' in row.rest).toBe(false);
  });

  it('omits a number that does not parse as an integer', () => {
    const formData = formDataWithRows({
      workTitle: ['Matrutvam'],
      workRole: ['director'],
      workYear: ['2o23'],
    });

    expect(readRepeatedRows(formData, spec)).toEqual([
      { required: 'Matrutvam', rest: { role: 'director' } },
    ]);
  });

  it('returns nothing when the group was never submitted', () => {
    expect(readRepeatedRows(new FormData(), spec)).toEqual([]);
  });

  it('tolerates a shorter optional column than the required one', () => {
    const formData = formDataWithRows({
      workTitle: ['Shivarpanam', 'Matrutvam'],
      workRole: ['director'],
    });

    expect(readRepeatedRows(formData, spec)).toEqual([
      { required: 'Shivarpanam', rest: { role: 'director' } },
      { required: 'Matrutvam', rest: {} },
    ]);
  });
});

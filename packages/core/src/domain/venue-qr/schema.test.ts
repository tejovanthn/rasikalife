import { describe, expect, it } from 'vitest';
import { QR_BULK_ASSIGN_MAX } from './constants';
import { BulkAssignQrSchema } from './schema';

const code = (i: number) => `ABCDEF${Math.floor(i / 10)}${i % 10}`;
const item = (i: number, label = 'Entrance') => ({ code: code(i), label });

describe('BulkAssignQrSchema', () => {
  it('takes a label per code', () => {
    const parsed = BulkAssignQrSchema.parse({
      items: [item(1, ' Entrance '), item(2, 'Ticket desk')],
      venueId: 'v1',
    });
    expect(parsed.items.map(i => i.label)).toEqual(['Entrance', 'Ticket desk']);
  });

  it('refuses repeated codes', () => {
    const result = BulkAssignQrSchema.safeParse({
      items: [item(1), item(1, 'Desk')],
      venueId: 'v1',
    });
    expect(result.success).toBe(false);
  });

  it('refuses none and more than the maximum', () => {
    expect(BulkAssignQrSchema.safeParse({ items: [], venueId: 'v1' }).success).toBe(false);
    const many = Array.from({ length: QR_BULK_ASSIGN_MAX + 1 }, (_, i) => item(i));
    expect(BulkAssignQrSchema.safeParse({ items: many, venueId: 'v1' }).success).toBe(false);
    expect(
      BulkAssignQrSchema.safeParse({ items: many.slice(0, QR_BULK_ASSIGN_MAX), venueId: 'v1' })
        .success
    ).toBe(true);
  });

  it('refuses an empty or too long label and a bad code', () => {
    const parse = (i: { code: string; label: string }) =>
      BulkAssignQrSchema.safeParse({ items: [i], venueId: 'v1' }).success;
    expect(parse({ code: code(1), label: '  ' })).toBe(false);
    expect(parse({ code: code(1), label: 'x'.repeat(61) })).toBe(false);
    expect(parse({ code: code(1), label: 'x'.repeat(60) })).toBe(true);
    expect(parse({ code: 'abc', label: 'Entrance' })).toBe(false);
  });
});

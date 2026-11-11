import { describe, expect, it } from 'vitest';
import { QrScanDayEntity, VenueQrEntity } from './entity';
import { venueRefFor } from './keys';

/**
 * The keys these entities actually write, read off `.params()` rather than off the templates.
 * Every other test in this domain mocks the entity, so only this file can catch the two
 * ElectroDB traps in CLAUDE.md: an index over an optional attribute (rule 9) and a patch that
 * leaves a GSI sort key stale (rule 7).
 */
const BASE = { code: 'ABCDEFGH', batchId: 'batch1', createdAt: '2026-11-12T00:00:00.000Z' };

function keys(item: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(item).filter(([field]) => /^(pk|sk|gsi\d(pk|sk))$/.test(field))
  );
}

describe('venue qr keys', () => {
  it('puts an unassigned code in its own batch partition, never an empty venue partition', () => {
    const params = VenueQrEntity.create({
      ...BASE,
      status: 'unassigned',
      venueRef: venueRefFor({ batchId: 'batch1' }),
    }).params() as { Item: Record<string, unknown> };

    const k = keys(params.Item);
    expect(k.pk).toBe('qr#abcdefgh');
    expect(k.sk).toBe('#metadata');
    expect(k.gsi1pk).toBe('venue_qrs#batch#batch1');
    expect(k.gsi1pk).not.toBe('venue_qrs#');
    expect(k.gsi1sk).toBe('2026-11-12t00:00:00.000z#abcdefgh');
    expect(k.gsi2pk).toBe('qr_status#unassigned');
    expect(k.gsi2sk).toBe('batch1#abcdefgh');
  });

  it('keeps unassigned partitions apart from any venue id', () => {
    expect(venueRefFor({ batchId: 'b1' })).toBe('batch#b1');
    expect(venueRefFor({ venueId: 'venue1', batchId: 'b1' })).toBe('venue1');
    expect(venueRefFor({ venueId: '', batchId: 'b1' })).toBe('batch#b1');
  });

  it('writes all four index keys when a patch assigns a code', () => {
    // The same fields `assignQr` sets. Without `createdAt` and `batchId` ElectroDB would write
    // the new partition keys and silently skip both sort keys (rule 7).
    const params = VenueQrEntity.patch({ code: 'ABCDEFGH' })
      .set({
        status: 'active',
        venueId: 'venue1',
        venueRef: 'venue1',
        venueName: 'Hall',
        label: 'Main entrance',
        batchId: 'batch1',
        createdAt: BASE.createdAt,
      })
      .params() as { ExpressionAttributeValues: Record<string, unknown> };

    const values = Object.values(params.ExpressionAttributeValues);
    expect(values).toContain('venue_qrs#venue1');
    expect(values).toContain('2026-11-12t00:00:00.000z#abcdefgh');
    expect(values).toContain('qr_status#active');
    expect(values).toContain('batch1#abcdefgh');
  });

  it('writes the status keys when a patch retires a code', () => {
    const params = VenueQrEntity.patch({ code: 'ABCDEFGH' })
      .set({ status: 'retired', retiredAt: '2026-11-13T00:00:00.000Z', batchId: 'batch1' })
      .params() as { ExpressionAttributeValues: Record<string, unknown> };

    const values = Object.values(params.ExpressionAttributeValues);
    expect(values).toContain('qr_status#retired');
    expect(values).toContain('batch1#abcdefgh');
  });

  it('keeps scan days in the same item collection as the code', () => {
    const day = QrScanDayEntity.update({ code: 'ABCDEFGH', date: '2026-11-12' })
      .add({ scans: 1 })
      .params() as { Key: { pk: string; sk: string }; UpdateExpression: string };

    expect(day.Key).toEqual({ pk: 'qr#abcdefgh', sk: 'scan_day#2026-11-12' });
    expect(day.UpdateExpression).toContain('ADD');
  });
});

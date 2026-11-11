import { ApplicationError, ErrorCode } from '../../constants';
import { dateInTimeZone } from '../../shared/timezone';
import { computeDiff, createChangeHistory } from '../change-history/service';
import { isConditionalFailure } from '../class-enrollment/outcome';
import { resolveFollowTarget } from '../follow/target';
import { getSpace } from '../venue-space';
import { DEFAULT_TIMEZONE, QR_BULK_ASSIGN_MAX } from './constants';
import { QrScanDayEntity, VenueQrEntity } from './entity';
import type { QrScanDay, VenueQr } from './entity';
import { venueRefFor } from './keys';
import { ListQrSchema, QR_STATUSES } from './schema';
import type {
  AssignQrInput,
  BulkAssignQrInput,
  ListQrInput,
  ReassignQrInput,
  UpdateQrLabelInput,
} from './schema';

export type { QrScanDay, VenueQr } from './entity';
export { generateQrCode, mintQrCodes } from './mint';
export * from './constants';
export * from './keys';
export * from './resolve';
export * from './add-concert';
export * from './schema';
export { resolveScan } from './scan';
export type { ScanEventView, ScanOutcomeView, ScanResolution } from './scan';

const AUDITED_FIELDS = ['status', 'venueId', 'venueName', 'spaceId', 'label', 'note'] as const;

function pickAudited(qr: Partial<VenueQr> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!qr) return out;
  for (const field of AUDITED_FIELDS) {
    if (qr[field] !== undefined) out[field] = qr[field];
  }
  return out;
}

async function audit(
  userId: string,
  code: string,
  comment: string,
  before: VenueQr,
  after: VenueQr
): Promise<void> {
  const diff = await computeDiff(pickAudited(before), pickAudited(after));
  await createChangeHistory({
    entityType: 'venueQr',
    entityId: code,
    userId,
    action: 'update',
    diff: diff as unknown as Record<string, unknown>,
    comment,
  });
}

export async function getQr(code: string): Promise<VenueQr | null> {
  const result = await VenueQrEntity.get({ code }).go();
  return (result.data as VenueQr | null) ?? null;
}

async function requireQr(code: string): Promise<VenueQr> {
  const qr = await getQr(code);
  if (!qr) throw new ApplicationError(ErrorCode.QR_NOT_FOUND, `QR code ${code} not found`);
  return qr;
}

async function requireVenueAndSpace(venueId: string, spaceId?: string) {
  // A merged venue resolves to its canonical record, so a code is never bound to a redirect.
  const venue = await resolveFollowTarget('venue', venueId);
  if (!venue) throw new ApplicationError(ErrorCode.VENUE_NOT_FOUND, `Venue ${venueId} not found`);
  if (spaceId) {
    const space = await getSpace(venue.id, spaceId);
    if (!space) {
      throw new ApplicationError(ErrorCode.SPACE_NOT_FOUND, `Space ${spaceId} not found`);
    }
  }
  return venue;
}

/** After a refused conditional write, read the row again to say which rule was broken. */
async function explainRefusal(code: string, expected: 'unassigned' | 'active'): Promise<Error> {
  const qr = await getQr(code);
  if (!qr) return new ApplicationError(ErrorCode.QR_NOT_FOUND, `QR code ${code} not found`);
  if (qr.status === 'retired') {
    return new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${code} is retired`);
  }
  if (expected === 'unassigned') {
    return new ApplicationError(ErrorCode.QR_NOT_UNASSIGNED, `QR code ${code} is already assigned`);
  }
  return new ApplicationError(ErrorCode.VALIDATION_ERROR, `QR code ${code} is not assigned`);
}

export type ListQrResult = { items: VenueQr[]; nextToken?: string; hasMore: boolean };

/**
 * Codes by venue, or by status (with an optional batch), or by batch alone.
 *
 * With only a batch, or with no filter at all, there is no single index to page through, so the
 * statuses are read one after the other and no cursor is returned. A batch is at most 200 codes.
 * TODO(spec): the unfiltered list has no cursor; add one if it must page past `limit`.
 */
export async function listQrs(rawInput: ListQrInput = {}): Promise<ListQrResult> {
  const { status, batchId, venueId, cursor, limit } = ListQrSchema.parse(rawInput);

  if (venueId) {
    const byVenue = VenueQrEntity.query.byVenue({ venueRef: venueId });
    const options = { limit, cursor, order: 'desc' as const };
    const result =
      status || batchId
        ? await byVenue
            .where((attr, op) => {
              const parts: string[] = [];
              if (status) parts.push(op.eq(attr.status, status));
              if (batchId) parts.push(op.eq(attr.batchId, batchId));
              return parts.join(' AND ');
            })
            .go(options)
        : await byVenue.go(options);
    return {
      items: (result.data as VenueQr[]) ?? [],
      nextToken: result.cursor ?? undefined,
      hasMore: Boolean(result.cursor),
    };
  }

  if (status) {
    const result = await VenueQrEntity.query
      .byStatus(batchId ? { status, batchId } : { status })
      .go({ limit, cursor });
    return {
      items: (result.data as VenueQr[]) ?? [],
      nextToken: result.cursor ?? undefined,
      hasMore: Boolean(result.cursor),
    };
  }

  const items: VenueQr[] = [];
  for (const each of QR_STATUSES) {
    if (items.length >= limit) break;
    const result = await VenueQrEntity.query
      .byStatus(batchId ? { status: each, batchId } : { status: each })
      .go({ limit: limit - items.length });
    items.push(...((result.data as VenueQr[]) ?? []));
  }
  return { items, hasMore: false };
}

/**
 * Binds an unassigned code to a venue. Guarded on `status = unassigned` in the write itself, so
 * two moderators scanning the same sticker cannot both win.
 *
 * Rule 7: `venueRef` and `status` are index keys. The patch also sets `createdAt` (gsi1 sort
 * key) and `batchId` (gsi2 sort key), or ElectroDB would leave the sort keys stale.
 */
export async function assignQr(
  input: AssignQrInput & { userId: string },
  now: Date = new Date()
): Promise<VenueQr> {
  const before = await requireQr(input.code);
  if (before.status === 'retired') {
    throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${input.code} is retired`);
  }
  if (before.status !== 'unassigned') {
    throw new ApplicationError(
      ErrorCode.QR_NOT_UNASSIGNED,
      `QR code ${input.code} is already assigned`
    );
  }
  const venue = await requireVenueAndSpace(input.venueId, input.spaceId);

  let after: VenueQr;
  try {
    const result = await VenueQrEntity.patch({ code: input.code })
      .set({
        status: 'active',
        venueId: venue.id,
        venueRef: venueRefFor({ venueId: venue.id, batchId: before.batchId }),
        venueName: venue.name,
        label: input.label,
        assignedBy: input.userId,
        assignedAt: now.toISOString(),
        batchId: before.batchId,
        createdAt: before.createdAt,
        ...(input.spaceId ? { spaceId: input.spaceId } : {}),
        ...(input.note ? { note: input.note } : {}),
      })
      .where((attr, op) => op.eq(attr.status, 'unassigned'))
      .go({ response: 'all_new' });
    after = result.data as VenueQr;
  } catch (error) {
    if (isConditionalFailure(error)) throw await explainRefusal(input.code, 'unassigned');
    throw error;
  }

  await audit(input.userId, input.code, 'assign', before, after);
  return after;
}

/**
 * Assigns up to 50 codes to one venue with numbered labels (`Entrance 1`, `Entrance 2`) in the
 * order given. Every code is checked before the first write, so a bad code stops the whole call
 * with nothing changed. A race that lands mid-way still throws, leaving earlier codes assigned.
 */
export async function bulkAssignQr(
  input: BulkAssignQrInput & { userId: string },
  now: Date = new Date()
): Promise<VenueQr[]> {
  if (input.codes.length > QR_BULK_ASSIGN_MAX) {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `Bulk assign takes at most ${QR_BULK_ASSIGN_MAX} codes`
    );
  }
  await requireVenueAndSpace(input.venueId, input.spaceId);
  for (const code of input.codes) {
    const qr = await requireQr(code);
    if (qr.status === 'retired') {
      throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${code} is retired`);
    }
    if (qr.status !== 'unassigned') {
      throw new ApplicationError(
        ErrorCode.QR_NOT_UNASSIGNED,
        `QR code ${code} is already assigned`
      );
    }
  }

  const assigned: VenueQr[] = [];
  for (const [index, code] of input.codes.entries()) {
    assigned.push(
      await assignQr(
        {
          code,
          venueId: input.venueId,
          spaceId: input.spaceId,
          label: `${input.labelPrefix} ${index + 1}`,
          userId: input.userId,
        },
        now
      )
    );
  }
  return assigned;
}

export async function updateQrLabel(
  input: UpdateQrLabelInput & { userId: string }
): Promise<VenueQr> {
  const before = await requireQr(input.code);
  if (before.status === 'retired') {
    throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${input.code} is retired`);
  }
  if (before.status === 'unassigned') {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `QR code ${input.code} is not assigned yet`
    );
  }
  let after: VenueQr;
  try {
    const result = await VenueQrEntity.patch({ code: input.code })
      .set({ label: input.label })
      .where((attr, op) => op.eq(attr.status, 'active'))
      .go({ response: 'all_new' });
    after = result.data as VenueQr;
  } catch (error) {
    if (isConditionalFailure(error)) throw await explainRefusal(input.code, 'active');
    throw error;
  }
  await audit(input.userId, input.code, 'label', before, after);
  return after;
}

/**
 * Moves an active code to another venue. Counters and past `QrScanDay` rows stay with the code;
 * follows keep their original `qrCode`. Changing `venueRef` moves the code between `byVenue`
 * partitions, so `createdAt` is set too (rule 7). A missing `spaceId` clears the old one with
 * `.remove` (rule 8).
 */
export async function reassignQr(input: ReassignQrInput & { userId: string }): Promise<VenueQr> {
  const before = await requireQr(input.code);
  if (before.status === 'retired') {
    throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${input.code} is retired`);
  }
  if (before.status === 'unassigned') {
    throw new ApplicationError(
      ErrorCode.VALIDATION_ERROR,
      `QR code ${input.code} is not assigned yet`
    );
  }
  const venue = await requireVenueAndSpace(input.venueId, input.spaceId);

  let after: VenueQr;
  try {
    let patch = VenueQrEntity.patch({ code: input.code }).set({
      venueId: venue.id,
      venueRef: venueRefFor({ venueId: venue.id, batchId: before.batchId }),
      venueName: venue.name,
      label: input.label,
      createdAt: before.createdAt,
      ...(input.spaceId ? { spaceId: input.spaceId } : {}),
    });
    if (!input.spaceId) patch = patch.remove(['spaceId']);
    const result = await patch
      .where((attr, op) => op.eq(attr.status, 'active'))
      .go({ response: 'all_new' });
    after = result.data as VenueQr;
  } catch (error) {
    if (isConditionalFailure(error)) throw await explainRefusal(input.code, 'active');
    throw error;
  }
  await audit(input.userId, input.code, 'reassign', before, after);
  return after;
}

/**
 * One-way. A retired code keeps its `venueId`, so the scan page can send a stale sticker's
 * reader to the old venue page. Retiring an unassigned code is allowed (a defaced spare).
 */
export async function retireQr(
  input: { code: string; userId: string },
  now: Date = new Date()
): Promise<VenueQr> {
  const before = await requireQr(input.code);
  if (before.status === 'retired') {
    throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${input.code} is already retired`);
  }
  let after: VenueQr;
  try {
    const result = await VenueQrEntity.patch({ code: input.code })
      .set({ status: 'retired', retiredAt: now.toISOString(), batchId: before.batchId })
      .where((attr, op) => op.ne(attr.status, 'retired'))
      .go({ response: 'all_new' });
    after = result.data as VenueQr;
  } catch (error) {
    if (isConditionalFailure(error)) {
      throw new ApplicationError(ErrorCode.QR_RETIRED, `QR code ${input.code} is already retired`);
    }
    throw error;
  }
  await audit(input.userId, input.code, 'retire', before, after);
  return after;
}

function mapMissing(code: string, error: unknown): never {
  if (isConditionalFailure(error)) {
    throw new ApplicationError(ErrorCode.QR_NOT_FOUND, `QR code ${code} not found`);
  }
  throw error;
}

/**
 * Counts one scan on the code and on today's rollup. Retired codes are counted too (a defaced or
 * swapped sticker shows up as scans on a retired code). The code row goes first: its patch is
 * conditioned on the row existing, so an unknown code never creates a stray `QrScanDay`.
 * Callers treat this as fire and forget.
 */
export async function recordScan(code: string, at: Date = new Date()): Promise<void> {
  try {
    await VenueQrEntity.patch({ code })
      .add({ scanCount: 1 })
      .set({ lastScannedAt: at.toISOString() })
      .go();
  } catch (error) {
    mapMissing(code, error);
  }
  await QrScanDayEntity.update({ code, date: dateInTimeZone(at, DEFAULT_TIMEZONE) })
    .add({ scans: 1 })
    .go();
}

/** Counts `count` new follows made through a code, on the code and on today's rollup. */
export async function recordQrFollows(
  code: string,
  count: number,
  at: Date = new Date()
): Promise<void> {
  if (count <= 0) return;
  try {
    await VenueQrEntity.patch({ code }).add({ followCount: count }).go();
  } catch (error) {
    mapMissing(code, error);
  }
  await QrScanDayEntity.update({ code, date: dateInTimeZone(at, DEFAULT_TIMEZONE) })
    .add({ follows: count })
    .go();
}

/** Rollup rows for one code, oldest first. `from` and `to` are yyyy-mm-dd, inclusive. */
export async function listScanDays(
  code: string,
  range: { from?: string; to?: string } = {}
): Promise<QrScanDay[]> {
  const base = QrScanDayEntity.query;
  const result =
    range.from && range.to
      ? await base.primary({ code }).between({ date: range.from }, { date: range.to }).go({
          pages: 'all',
        })
      : await base.primary({ code }).go({ pages: 'all' });
  return (result.data as QrScanDay[]) ?? [];
}

export type QrStats = { scansTotal: number; scansLast7Days: number; follows: number };

/** Scans (total and the last 7 days) and follows for one code, from its counters and rollups. */
export async function getQrStats(code: string, now: Date = new Date()): Promise<QrStats> {
  const qr = await requireQr(code);
  const to = dateInTimeZone(now, DEFAULT_TIMEZONE);
  const from = dateInTimeZone(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), DEFAULT_TIMEZONE);
  const days = await listScanDays(code, { from, to });
  return {
    scansTotal: qr.scanCount ?? 0,
    scansLast7Days: days.reduce((sum, day) => sum + (day.scans ?? 0), 0),
    follows: qr.followCount ?? 0,
  };
}

/**
 * Merge cascade: points every code of `loserId` at `canonicalId`. `venueRef` moves the row to the
 * canonical `byVenue` partition, so `createdAt` (gsi1 sort key) is set too (rule 7). Retired
 * codes move as well, so a stale sticker redirects to the surviving venue page.
 */
export async function repointQrsToVenue(
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<number> {
  let moved = 0;
  let cursor: string | null = null;
  do {
    const page = (await VenueQrEntity.query
      .byVenue({ venueRef: loserId })
      .go({ limit: 100, cursor })) as { data: VenueQr[]; cursor: string | null };
    cursor = page.cursor;
    for (const row of page.data ?? []) {
      await VenueQrEntity.patch({ code: row.code })
        .set({
          venueId: canonicalId,
          venueRef: canonicalId,
          venueName: canonicalName,
          createdAt: row.createdAt,
        })
        .go();
      moved += 1;
    }
  } while (cursor);
  return moved;
}

/** Rename cascade: refreshes the denormalized `venueName` on the venue's codes. */
export async function refreshQrVenueName(venueId: string, newName: string): Promise<void> {
  let cursor: string | null = null;
  do {
    const page = (await VenueQrEntity.query
      .byVenue({ venueRef: venueId })
      .go({ limit: 100, cursor })) as { data: VenueQr[]; cursor: string | null };
    cursor = page.cursor;
    await Promise.all(
      (page.data ?? []).map(row =>
        VenueQrEntity.patch({ code: row.code }).set({ venueName: newName }).go()
      )
    );
  } while (cursor);
}

/** Every code of one batch, whatever its status, ordered by code. A batch is at most 200. */
export async function listQrsInBatch(batchId: string): Promise<VenueQr[]> {
  const items: VenueQr[] = [];
  for (const status of QR_STATUSES) {
    const result = await VenueQrEntity.query.byStatus({ status, batchId }).go({ pages: 'all' });
    items.push(...((result.data as VenueQr[]) ?? []));
  }
  return items.sort((a, b) => a.code.localeCompare(b.code));
}

export type VenueQrStatsRow = {
  code: string;
  status: VenueQr['status'];
  label?: string;
  spaceId?: string;
  scansLast7Days: number;
  scansTotal: number;
  follows: number;
  lastScannedAt?: string;
};

/**
 * One row per code at a venue, for the venue QR panel and the partner dashboard. Retired codes
 * are included (their scans are still counted); callers that want only live ones filter on
 * `status`. A venue holds a handful of codes, so a rollup query each is fine.
 */
export async function statsByVenue(
  venueId: string,
  now: Date = new Date()
): Promise<VenueQrStatsRow[]> {
  const result = await VenueQrEntity.query.byVenue({ venueRef: venueId }).go({ pages: 'all' });
  const codes = (result.data as VenueQr[]) ?? [];
  const to = dateInTimeZone(now, DEFAULT_TIMEZONE);
  const from = dateInTimeZone(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), DEFAULT_TIMEZONE);
  return Promise.all(
    codes.map(async qr => {
      const days = await listScanDays(qr.code, { from, to });
      return {
        code: qr.code,
        status: qr.status,
        label: qr.label,
        spaceId: qr.spaceId,
        scansLast7Days: days.reduce((sum, day) => sum + (day.scans ?? 0), 0),
        scansTotal: qr.scanCount ?? 0,
        follows: qr.followCount ?? 0,
        lastScannedAt: qr.lastScannedAt,
      };
    })
  );
}

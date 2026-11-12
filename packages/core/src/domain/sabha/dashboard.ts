/**
 * Reads behind the sabha dashboard and the follower export. Rules are in `sabha.ts`; this file
 * only loads rows, so a test can inject every read.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApplicationError, ErrorCode } from '../../constants';
import { batchGetAll } from '../../shared/batch-get';
import { EventEntity } from '../event/entity';
import type { Event } from '../event/entity';
import { listAllFollowersOfTarget } from '../follow';
import { OrganiserEntity } from '../organiser/entity';
import type { PartnerTargetType } from '../partner-member/schema';
import { UserEntity } from '../user/entity';
import { statsByVenue } from '../venue-qr';
import { PRESIGNED_URL_TTL_SEC } from '../venue-qr/constants';
import { listSpaces } from '../venue-space';
import { VenueEntity } from '../venue/entity';
import { PartnerExportEntity } from './export-entity';
import type { PartnerExport } from './export-entity';
import {
  buildExportRows,
  buildFollowersCsv,
  exportKey,
  followerStats,
  followerTrend,
  splitEventsByTime,
} from './rules';
import type { ExportUser, FollowerRow } from './rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_BATCH = 100;

export type TargetRecord = {
  id: string;
  name: string;
  verifiedAt?: string;
  requireEventReview?: boolean;
  /** An organiser's one home venue. Venues have none. */
  venueId?: string;
  followerCount?: number;
};

export async function getPartnerTarget(
  targetType: PartnerTargetType,
  targetId: string
): Promise<TargetRecord | null> {
  const result =
    targetType === 'organiser'
      ? await OrganiserEntity.get({ id: targetId }).go()
      : await VenueEntity.get({ id: targetId }).go();
  const row = result.data as (TargetRecord & { deletedAt?: string }) | null;
  return row && !row.deletedAt ? row : null;
}

/**
 * Events of an organiser or at a venue, approved or waiting for review. Drafts, rejected rows
 * and soft-deleted rows are left out. The key range is padded by a day because stored times
 * carry their own offsets, then cut on instants (`splitEventsByTime`).
 */
export async function listTargetEvents(
  targetType: PartnerTargetType,
  targetId: string,
  now: Date = new Date(),
  options: { pastDays?: number; pastLimit?: number } = {}
): Promise<{ upcoming: Event[]; past: Event[] }> {
  const pastDays = options.pastDays ?? 365;
  const from = new Date(now.getTime() - (pastDays + 1) * DAY_MS).toISOString();
  const query =
    targetType === 'organiser'
      ? EventEntity.query.byOrganiser({ organiserId: targetId })
      : EventEntity.query.byVenue({ venueId: targetId });
  const result = await query
    .gte({ startDateTime: from })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ pages: 'all' });
  const events = ((result.data ?? []) as Event[]).filter(
    event => event.status === 'approved' || event.status === 'submitted'
  );
  const split = splitEventsByTime(events, now);
  return { upcoming: split.upcoming, past: split.past.slice(0, options.pastLimit ?? 100) };
}

/** Approved events a verified owner published without review, recent and upcoming, newest first. */
export async function listOwnerPublishedEvents(
  now: Date = new Date(),
  options: { sinceDays?: number } = {}
): Promise<Event[]> {
  const from = new Date(now.getTime() - (options.sinceDays ?? 30) * DAY_MS).toISOString();
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .gte({ startDateTime: from })
    .where((attr, op) => `${op.exists(attr.ownerPublishedAt)} AND ${op.notExists(attr.deletedAt)}`)
    .go({ pages: 'all' });
  return ((result.data ?? []) as Event[]).sort((a, b) =>
    (b.ownerPublishedAt ?? '').localeCompare(a.ownerPublishedAt ?? '')
  );
}

export async function listFollowRows(
  targetType: PartnerTargetType,
  targetId: string
): Promise<FollowerRow[]> {
  return (await listAllFollowersOfTarget(targetType, targetId)) as FollowerRow[];
}

/**
 * The venue whose codes belong on this dashboard. A venue sees its own. An organiser sees the
 * codes at its home venue (`Organiser.venueId`) and none otherwise. Codes belong to venues, so a
 * sabha renting a hall never sees scans from other sabhas' concerts there (owner decision 15).
 */
export function codesVenueId(targetType: PartnerTargetType, target: TargetRecord): string | null {
  return targetType === 'venue' ? target.id : (target.venueId ?? null);
}

export async function getPartnerOverview(
  targetType: PartnerTargetType,
  targetId: string,
  now: Date = new Date()
) {
  const target = await getPartnerTarget(targetType, targetId);
  if (!target) {
    throw new ApplicationError(
      targetType === 'venue' ? ErrorCode.VENUE_NOT_FOUND : ErrorCode.ORGANISER_NOT_FOUND,
      `${targetType} ${targetId} not found`
    );
  }
  const venueId = codesVenueId(targetType, target);
  const [follows, events, rawCodes, spaces] = await Promise.all([
    listFollowRows(targetType, targetId),
    listTargetEvents(targetType, targetId, now, { pastLimit: 0 }),
    venueId ? statsByVenue(venueId, now) : Promise.resolve([]),
    venueId ? listSpaces(venueId) : Promise.resolve([]),
  ]);
  const spaceNames = new Map(spaces.map(space => [space.spaceId, space.name]));
  const codes = rawCodes.map(code => ({
    ...code,
    spaceName: code.spaceId ? spaceNames.get(code.spaceId) : undefined,
  }));
  return {
    target: {
      id: target.id,
      name: target.name,
      verifiedAt: target.verifiedAt,
      requireEventReview: target.requireEventReview === true,
    },
    followers: followerStats(follows, now),
    trend: followerTrend(follows, now, 30),
    scansThisWeek: codes.reduce((sum, code) => sum + code.scansLast7Days, 0),
    upcomingConcerts: events.upcoming.filter(e => e.status === 'approved').length,
    codes,
  };
}

async function loadExportUsers(ids: string[]): Promise<Map<string, ExportUser>> {
  const unique = [...new Set(ids)];
  const users = new Map<string, ExportUser>();
  for (let i = 0; i < unique.length; i += USER_BATCH) {
    const batch = unique.slice(i, i + USER_BATCH);
    // Unprocessed keys are retried, and the export throws rather than drop a consented row.
    const rows = await batchGetAll(
      batch.map(id => ({ id })),
      keys => UserEntity.get(keys).go()
    );
    for (const user of rows as ExportUser[]) users.set(user.id, user);
  }
  return users;
}

export type ExportDeps = {
  listFollows: (type: PartnerTargetType, id: string) => Promise<FollowerRow[]>;
  loadUsers: (ids: string[]) => Promise<Map<string, ExportUser>>;
  putObject: (key: string, body: string) => Promise<void>;
  signUrl: (key: string) => Promise<string>;
  audit: (row: {
    targetType: PartnerTargetType;
    targetId: string;
    userId: string;
    rowCount: number;
    key: string;
    createdAt: string;
  }) => Promise<void>;
};

function s3(): { client: S3Client; bucket: string } {
  return {
    client: new S3Client({ region: process.env.AWS_REGION || 'us-east-1' }),
    bucket: process.env.PRIVATE_FILES_BUCKET ?? '',
  };
}

const realDeps: ExportDeps = {
  listFollows: listFollowRows,
  loadUsers: loadExportUsers,
  async putObject(key, body) {
    const { client, bucket } = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'text/csv; charset=utf-8',
      })
    );
  },
  async signUrl(key) {
    const { client, bucket } = s3();
    const name = key.split('/').pop() ?? 'followers.csv';
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="followers-${name}"`,
      }),
      { expiresIn: PRESIGNED_URL_TTL_SEC }
    );
  },
  async audit(row) {
    await PartnerExportEntity.create(row).go();
  },
};

/**
 * Builds the CSV of followers who chose to share with this target, writes it to the private
 * bucket and returns a 5 minute link. Authorises nothing: the router has already checked that
 * the caller is an owner. Only `Follow` rows with `shareWithTarget = true` go into the file. The
 * audit row is written after the file is stored and before the link is returned, so no link
 * exists for an export that was not logged.
 */
export async function exportFollowers(
  input: { targetType: PartnerTargetType; targetId: string; userId: string },
  now: Date = new Date(),
  deps: ExportDeps = realDeps
): Promise<{ url: string; rowCount: number; key: string }> {
  const follows = await deps.listFollows(input.targetType, input.targetId);
  const sharing = follows.filter(follow => follow.shareWithTarget === true);
  const users = await deps.loadUsers(sharing.map(follow => follow.userId));
  const rows = buildExportRows(sharing, users, input.targetType);
  const key = exportKey(input.targetType, input.targetId, now);

  await deps.putObject(key, buildFollowersCsv(rows));
  await deps.audit({
    targetType: input.targetType,
    targetId: input.targetId,
    userId: input.userId,
    rowCount: rows.length,
    key,
    createdAt: now.toISOString(),
  });
  return { url: await deps.signUrl(key), rowCount: rows.length, key };
}

/** The audit rows of a target's exports, newest first. */
export async function listExportAudit(
  targetType: PartnerTargetType,
  targetId: string,
  limit = 20
): Promise<PartnerExport[]> {
  const result = await PartnerExportEntity.query
    .primary({ targetType, targetId })
    .go({ limit, order: 'desc' });
  return (result.data ?? []) as PartnerExport[];
}

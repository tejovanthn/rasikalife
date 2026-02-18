export enum EntityPrefix {
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION',
  USER = 'USER',
  RAGA = 'RAGA',
  TALA = 'TALA',
  EVENT = 'EVENT',
  VENUE = 'VENUE',
  THREAD = 'THREAD',
  REPLY = 'REPLY',
  UPDATE = 'UPDATE',
  COLLECTION = 'COLLECTION',
  PERFORMANCE = 'PERFORMANCE',
  RECORDING = 'RECORDING',
  FESTIVAL = 'FESTIVAL',
  ORGANISER = 'ORGANISER',
}

export enum SecondaryPrefix {
  METADATA = '#METADATA',
  FOLLOWS = 'FOLLOWS',
  FOLLOWER = 'FOLLOWER',
  SUBSCRIPTION = 'SUBSCRIPTION',
  KARMA = 'KARMA',
  BADGE = 'BADGE',
  KARMA_PERMISSION = 'KARMA_PERMISSION',
  MANAGER = 'MANAGER',
  MANAGES = 'MANAGES',
  MEMBER = 'MEMBER',
  MEMBEROF = 'MEMBEROF',
  VERSION = 'VERSION',
  ATTRIBUTION = 'ATTRIBUTION',
  COMPOSES = 'COMPOSES',
  EVENT = 'EVENT',
  ARTIST = 'ARTIST',
  PERFORMANCE = 'PERFORMANCE',
  RECORDING = 'RECORDING',
  TICKET = 'TICKET',
  PATRON = 'PATRON',
  PATRONIZES = 'PATRONIZES',
  BENEFIT = 'BENEFIT',
  ITEM = 'ITEM',
  FAVORITE = 'FAVORITE',
  VOTE = 'VOTE',
  HISTORY = 'HISTORY',
  FEED = 'FEED',
  SUBSCRIBES = 'SUBSCRIBER',
  FLAG = 'FLAG',
  MOD_ACTION = 'MOD_ACTION',
  APPROVAL = 'APPROVAL',
  MSG = 'MSG',
  CONVO = 'CONVO',
  STEP = 'STEP',
  TRANSACTION = 'TRANSACTION',
  RECEIPT = 'RECEIPT',
  SEARCH = 'SEARCH',
  SUGGEST = 'SUGGEST',
  METRIC = 'METRIC',
  AUDIT = 'AUDIT',
  SYNC = 'SYNC',
  VARIANT = 'VARIANT',
  NAME = 'NAME',
  ALIAS = 'ALIAS',
  CREATED = 'CREATED',
}

export function formatKey(prefix: EntityPrefix | string, id: string): string {
  return `${prefix}#${id}`;
}

export function formatDateSortKey(
  prefix: SecondaryPrefix | string,
  date: string,
  id?: string
): string {
  return id ? `${prefix}#${date}#${id}` : `${prefix}#${date}`;
}

export function formatVersionKey(version: string, timestamp?: string): string {
  return timestamp ? `VERSION#${version}#${timestamp}` : `VERSION#${version}`;
}

export async function createBaseItem(
  entityType: EntityPrefix,
  id?: string,
  sortKey: string = SecondaryPrefix.METADATA
) {
  const { generateId } = await import('../utils');
  const itemId = id || (await generateId());

  return {
    pk: formatKey(entityType, itemId),
    sk: sortKey,
    id: itemId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createCompositeId(parts: string[]): string {
  return parts.join('#');
}

export function formatIndexKey(prefix: string, value: string): string {
  return `${prefix}#${value}`;
}

export function extractIdFromKey(key: string): string {
  return key.split('#').pop() || '';
}

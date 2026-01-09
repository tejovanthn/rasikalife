export var EntityPrefix;
(function (EntityPrefix) {
    EntityPrefix["ARTIST"] = "ARTIST";
    EntityPrefix["COMPOSITION"] = "COMPOSITION";
    EntityPrefix["USER"] = "USER";
    EntityPrefix["RAGA"] = "RAGA";
    EntityPrefix["TALA"] = "TALA";
    EntityPrefix["EVENT"] = "EVENT";
    EntityPrefix["VENUE"] = "VENUE";
    EntityPrefix["THREAD"] = "THREAD";
    EntityPrefix["REPLY"] = "REPLY";
    EntityPrefix["UPDATE"] = "UPDATE";
    EntityPrefix["COLLECTION"] = "COLLECTION";
    EntityPrefix["PERFORMANCE"] = "PERFORMANCE";
    EntityPrefix["RECORDING"] = "RECORDING";
})(EntityPrefix || (EntityPrefix = {}));
export var SecondaryPrefix;
(function (SecondaryPrefix) {
    SecondaryPrefix["METADATA"] = "#METADATA";
    SecondaryPrefix["FOLLOWS"] = "FOLLOWS";
    SecondaryPrefix["FOLLOWER"] = "FOLLOWER";
    SecondaryPrefix["SUBSCRIPTION"] = "SUBSCRIPTION";
    SecondaryPrefix["KARMA"] = "KARMA";
    SecondaryPrefix["BADGE"] = "BADGE";
    SecondaryPrefix["KARMA_PERMISSION"] = "KARMA_PERMISSION";
    SecondaryPrefix["MANAGER"] = "MANAGER";
    SecondaryPrefix["MANAGES"] = "MANAGES";
    SecondaryPrefix["MEMBER"] = "MEMBER";
    SecondaryPrefix["MEMBEROF"] = "MEMBEROF";
    SecondaryPrefix["VERSION"] = "VERSION";
    SecondaryPrefix["ATTRIBUTION"] = "ATTRIBUTION";
    SecondaryPrefix["COMPOSES"] = "COMPOSES";
    SecondaryPrefix["EVENT"] = "EVENT";
    SecondaryPrefix["ARTIST"] = "ARTIST";
    SecondaryPrefix["PERFORMANCE"] = "PERFORMANCE";
    SecondaryPrefix["RECORDING"] = "RECORDING";
    SecondaryPrefix["TICKET"] = "TICKET";
    SecondaryPrefix["PATRON"] = "PATRON";
    SecondaryPrefix["PATRONIZES"] = "PATRONIZES";
    SecondaryPrefix["BENEFIT"] = "BENEFIT";
    SecondaryPrefix["ITEM"] = "ITEM";
    SecondaryPrefix["FAVORITE"] = "FAVORITE";
    SecondaryPrefix["VOTE"] = "VOTE";
    SecondaryPrefix["HISTORY"] = "HISTORY";
    SecondaryPrefix["FEED"] = "FEED";
    SecondaryPrefix["SUBSCRIBES"] = "SUBSCRIBER";
    SecondaryPrefix["FLAG"] = "FLAG";
    SecondaryPrefix["MOD_ACTION"] = "MOD_ACTION";
    SecondaryPrefix["APPROVAL"] = "APPROVAL";
    SecondaryPrefix["MSG"] = "MSG";
    SecondaryPrefix["CONVO"] = "CONVO";
    SecondaryPrefix["STEP"] = "STEP";
    SecondaryPrefix["TRANSACTION"] = "TRANSACTION";
    SecondaryPrefix["RECEIPT"] = "RECEIPT";
    SecondaryPrefix["SEARCH"] = "SEARCH";
    SecondaryPrefix["SUGGEST"] = "SUGGEST";
    SecondaryPrefix["METRIC"] = "METRIC";
    SecondaryPrefix["AUDIT"] = "AUDIT";
    SecondaryPrefix["SYNC"] = "SYNC";
    SecondaryPrefix["VARIANT"] = "VARIANT";
    SecondaryPrefix["NAME"] = "NAME";
    SecondaryPrefix["ALIAS"] = "ALIAS";
    SecondaryPrefix["CREATED"] = "CREATED";
})(SecondaryPrefix || (SecondaryPrefix = {}));
export function formatKey(prefix, id) {
    return `${prefix}#${id}`;
}
export function formatDateSortKey(prefix, date, id) {
    return id ? `${prefix}#${date}#${id}` : `${prefix}#${date}`;
}
export function formatVersionKey(version, timestamp) {
    return timestamp ? `VERSION#${version}#${timestamp}` : `VERSION#${version}`;
}
export async function createBaseItem(entityType, id, sortKey = SecondaryPrefix.METADATA) {
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
export function createCompositeId(parts) {
    return parts.join('#');
}
export function formatIndexKey(prefix, value) {
    return `${prefix}#${value}`;
}
export function extractIdFromKey(key) {
    return key.split('#').pop() || '';
}

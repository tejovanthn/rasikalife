import KSUID from 'ksuid';
export const generateId = () => {
    return KSUID.randomSync().string;
};
export const generateIdSync = () => {
    return KSUID.randomSync().string;
};
export const generateRandomString = (length = 6) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
export const getCurrentISOString = () => {
    return new Date().toISOString();
};
export const formatDateYYYYMMDD = (date) => {
    return date.toISOString().split('T')[0];
};
export const toISOString = (date) => {
    if (typeof date === 'string' || typeof date === 'number') {
        return new Date(date).toISOString();
    }
    return date.toISOString();
};
export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
export const isPast = (date) => {
    return new Date(date) < new Date();
};
export const isFuture = (date) => {
    return new Date(date) > new Date();
};
export const daysBetween = (dateA, dateB) => {
    const a = new Date(dateA);
    const b = new Date(dateB);
    const diffTime = Math.abs(b.getTime() - a.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
export const getTimeBasedShard = (id, shardCount = 10) => {
    // Extract timestamp from KSUID (first 4 characters)
    const timestamp = Number.parseInt(id.substring(0, 4), 36);
    return timestamp % shardCount;
};
export const getTimestampFromId = (id) => {
    const timestamp = Number.parseInt(id.substring(0, 4), 36);
    return new Date(timestamp * 1000);
};

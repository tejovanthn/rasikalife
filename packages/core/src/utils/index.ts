import KSUID from 'ksuid';

export const generateId = (): string => {
  return KSUID.randomSync().string;
};

export const generateRandomString = (length = 6): string => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const getCurrentISOString = (): string => {
  return new Date().toISOString();
};

export const formatDateYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const toISOString = (date: Date | string | number): string => {
  if (typeof date === 'string' || typeof date === 'number') {
    return new Date(date).toISOString();
  }
  return date.toISOString();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isPast = (date: Date | string): boolean => {
  return new Date(date) < new Date();
};

export const isFuture = (date: Date | string): boolean => {
  return new Date(date) > new Date();
};

export const daysBetween = (dateA: Date | string, dateB: Date | string): number => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffTime = Math.abs(b.getTime() - a.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getTimeBasedShard = (id: string, shardCount = 10): number => {
  const timestamp = Number.parseInt(id.substring(0, 4), 36);
  return timestamp % shardCount;
};

export const getTimestampFromId = (id: string): Date => {
  const timestamp = Number.parseInt(id.substring(0, 4), 36);
  return new Date(timestamp * 1000);
};

export * from './transliteration';

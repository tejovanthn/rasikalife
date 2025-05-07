/**
 * ID generation utilities using KSUID
 */
import { randomBytes } from 'crypto';
import ksuid from 'ksuid';

/**
 * Generate a new KSUID-based ID
 * Uses KSUID for time-sortable, unique IDs
 */
export const generateId = async (): Promise<string> => {
  return (await ksuid.random()).string;
};

/**
 * Generate a prefixed ID for domain entities
 * @param prefix - The entity type prefix (e.g., 'user', 'artist')
 */
export const generatePrefixedId = async (prefix: string): Promise<string> => {
  return `${prefix}_${(await ksuid.random()).string}`;
};

/**
 * Generate a new KSUID-based ID synchronously
 * Less optimal than async version but useful in some contexts
 */
export const generateIdSync = (): string => {
  return ksuid.randomSync().string;
};

/**
 * Generate a new random string (for verification codes, etc.)
 * @param length - Length of the random string
 */
export const generateRandomString = (length: number = 6): string => {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Parse timestamp from KSUID
 * Useful for extracting creation time from IDs
 * @param id - KSUID string
 */
export const getTimestampFromId = (id: string): Date => {
  // For prefixed IDs, extract just the KSUID portion
  const ksuidPart = id.includes('_') ? id.split('_')[1] : id;
  
  try {
    const parsed = ksuid.parse(ksuidPart);
    return new Date(parsed.date);
  } catch (error) {
    throw new Error(`Invalid KSUID: ${id}`);
  }
};
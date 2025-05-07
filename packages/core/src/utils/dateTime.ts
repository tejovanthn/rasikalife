/**
 * Date and time utilities for the application
 */

/**
 * Get the current ISO datetime string
 */
export const getCurrentISOString = (): string => {
  return new Date().toISOString();
};

/**
 * Format a date as YYYY-MM-DD
 * Used for DynamoDB date-based indexes
 * @param date - Date to format
 */
export const formatDateYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Convert a date to ISO string, handling different input types
 * @param date - Date to convert (Date object, ISO string, or timestamp)
 */
export const toISOString = (date: Date | string | number): string => {
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  if (typeof date === 'string') {
    // If it's already ISO format, return as is
    if (date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
      return date;
    }
    return new Date(date).toISOString();
  }
  
  return new Date(date).toISOString();
};

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Check if a date is in the past
 * @param date - Date to check
 */
export const isPast = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate.getTime() < Date.now();
};

/**
 * Check if a date is in the future
 * @param date - Date to check
 */
export const isFuture = (date: Date | string): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate.getTime() > Date.now();
};

/**
 * Calculate the difference between two dates in days
 * @param dateA - First date
 * @param dateB - Second date
 */
export const daysBetween = (dateA: Date | string, dateB: Date | string): number => {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  
  // Convert to UTC to avoid time zone issues
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  
  const millisPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((utcB - utcA) / millisPerDay);
};

/**
 * Generate a time-based shard key for high-volume items
 * Used to prevent hot partitions in DynamoDB
 * @param id - The base ID
 * @param shardCount - Number of shards to distribute across
 */
export const getTimeBasedShard = (id: string, shardCount: number = 10): number => {
  const now = new Date();
  const minute = now.getMinutes();
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return (hash + minute) % shardCount;
};
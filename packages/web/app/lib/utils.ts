import { type ClassValue, clsx } from 'clsx';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import { twMerge } from 'tailwind-merge';
import { convert } from 'url-slug';

dayjs.extend(localizedFormat);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Enhanced slugify function
export const slugify = ({
  name,
  type,
  id,
}: {
  name: string;
  type?: 'artists' | 'compositions' | 'ragas' | 'talas';
  id?: string;
}) => {
  const slug = convert(`${name}-${id}`, {
    camelCase: false,
  });

  // Generate URLs based on entity type
  if (type === 'compositions' || (!type && id)) {
    return `/carnatic/compositions/${slug}`;
  }
  if (type === 'artists') {
    return `/artists/${slug}`;
  }
  if (type === 'ragas') {
    return `/carnatic/ragas/${slug}`;
  }
  if (type === 'talas') {
    return `/carnatic/talas/${slug}`;
  }

  // Generic fallback
  return `/carnatic/${type}/${convert(name, { camelCase: false })}`;
};

// Utility for extracting ID from slug
export const extractIdFromSlug = (slug: string): string | null => {
  const parts = slug.split('-');
  return parts.pop() || null;
};

// Utility for capitalizing the first letter of a string
export const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Capitalize every word of an entity name for display.
 *
 * Stored names are lowercase ITRANS, so a raga reaches the page as `darbari kanada`
 * once transliterated. A proper noun in a page title and a meta description has to
 * read as one — `capitalize` alone leaves the second word bare. Words after an
 * opening bracket count, so alias lists read `Navaroj (Navroj)`.
 *
 * Names only. Never run this over lyrics or prose.
 */
export const titleCaseName = (str: string): string =>
  str.replace(/(^|[\s([{/–—-])([a-z])/g, (_, before: string, letter: string) => {
    return before + letter.toUpperCase();
  });

// Utility for formatting text
export const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

// Utility for formatting dates (SSR-safe using dayjs)
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).format('DD/MM/YYYY');
};

// Utility for formatting dates with locale
export const formatDateLocale = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).format('LL');
};

// Full event date, always rendered in India time. The SSR Lambda runs in UTC, so
// an evening IST concert formatted in the runtime zone lands on the previous day;
// pinning the zone keeps the displayed day right wherever the code runs. One
// formatter, used across every date the profile shows, so no section drifts.
export const formatEventDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Utility for relative time (e.g., "3 days ago")
export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  return dayjs(dateString).fromNow();
};

// Utility for formatting numbers
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// URL parameter utilities
export const buildSearchParams = (
  params: Record<string, string | number | undefined>
): URLSearchParams => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      searchParams.set(key, value.toString());
    }
  }

  return searchParams;
};

// Generic error handling utility
export const handleApiError = (error: unknown): Response => {
  console.error('API Error:', error);

  if (error instanceof Response) {
    return error;
  }

  return new Response('Internal Server Error', {
    status: 500,
    statusText: 'An unexpected error occurred',
  });
};

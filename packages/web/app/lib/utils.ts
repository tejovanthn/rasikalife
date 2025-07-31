import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { convert } from 'url-slug';
import { entityConfigs } from './routeConfig';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Enhanced slugify function using entity configs
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

  // Use entity configs for consistent URL generation
  if (type && entityConfigs[type]) {
    return `${entityConfigs[type].basePath}/${slug}`;
  }

  // Fallback for backward compatibility
  if (type === 'compositions' || (!type && id)) {
    return `/carnatic/compositions/${slug}`;
  }
  if (type === 'artists') {
    return `/carnatic/artists/${slug}`;
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

// Utility for formatting text
export const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

// Utility for formatting dates
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
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

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      searchParams.set(key, value.toString());
    }
  });

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

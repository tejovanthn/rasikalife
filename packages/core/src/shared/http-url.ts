import { z } from 'zod';

/** True only for an absolute `http:` or `https:` URL. `javascript:` and `data:` are refused. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** A URL field an owner may set and a public page renders as a link or image. */
export const httpUrlSchema = z
  .string()
  .url()
  .refine(isHttpUrl, { message: 'Must be an http or https URL' });

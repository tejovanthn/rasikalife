import { createSubjects } from '@openauthjs/openauth/subject';
import { z } from 'zod';

/**
 * Shared OpenAuth subjects schema
 * Used by both the issuer and client for token verification
 */
export const authSubjects = createSubjects({
  user: z.object({
    userID: z.string(),
  }),
});

export type AuthSubjects = typeof authSubjects;

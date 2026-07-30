import { z } from 'zod';

import { CLAIM_SOURCES } from '../artist/schema';
import { YearSchema } from '../shared/schemas';

export const AddArtistAffiliationSchema = z
  .object({
    artistId: z.string().min(1),
    artistName: z.string().min(1).max(200),
    // Required, unlike the organisation name in an extractor's output. See the entity for why
    // an unresolved organisation is not yet an affiliation.
    organiserId: z.string().min(1),
    organisationName: z.string().min(1).max(200),
    role: z.string().max(200).optional(),
    discipline: z.string().max(100).optional(),
    startYear: YearSchema.optional(),
    endYear: YearSchema.optional(),
    isCurrent: z.boolean().optional(),
    source: z.enum(CLAIM_SOURCES).optional(),
  })
  // A role cannot both have ended and still be held. The importer can produce the pair — it
  // reads isCurrent from one CSV column and endYear from another — and the result renders as
  // "1998–2015" while sorting to the top of the organisation's faculty list as current.
  .refine(input => !(input.isCurrent && input.endYear), {
    message: 'An affiliation with an end year cannot also be current',
    path: ['isCurrent'],
  });

export type AddArtistAffiliationInput = z.infer<typeof AddArtistAffiliationSchema>;

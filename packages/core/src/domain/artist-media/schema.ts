import { z } from 'zod';

/**
 * The kinds of coverage this records. A closed set, unlike `instrument` and `city` which are
 * free text (§11.1): those arrive from posters and scrapes where an enum would reject real
 * data, whereas this value is only ever chosen by a moderator from a dropdown. Five options
 * is few enough that nobody hesitates and enough to badge or filter on later.
 *
 * Lives here beside the schema so the form, the CSV and any future filter read one list.
 */
export const MEDIA_TYPES = ['article', 'review', 'interview', 'video', 'feature'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  article: 'Article',
  review: 'Review',
  interview: 'Interview',
  video: 'Video',
  feature: 'Feature',
};

export const AddArtistMediaSchema = z.object({
  artistId: z.string().min(1),
  title: z.string().min(1).max(300),
  // Required: a press mention is fundamentally something a reader can go and read. The image
  // is the optional part, so coverage can be logged in seconds and the scan added later.
  url: z.string().url(),
  mediaType: z.enum(MEDIA_TYPES),
  outlet: z.string().max(200).optional(),
  // Date only, not a timestamp: publication dates are reported as a day, and storing a
  // spurious time would render as one in every locale that formats it.
  publishedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  imageUrl: z.string().url().optional(),
  uploadId: z.string().optional(),
  createdBy: z.string().min(1),
});

export const UpdateArtistMediaSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  url: z.string().url().optional(),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  outlet: z.string().max(200).optional(),
  publishedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  imageUrl: z.string().url().optional(),
  uploadId: z.string().optional(),
});

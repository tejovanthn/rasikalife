import { z } from 'zod';

export const PROGRAM_TYPES = ['regular', 'workshop'] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

/** Shared with `classSession`, so a session's mode and a program's default cannot drift apart. */
export const CLASS_MODES = ['online', 'in-person'] as const;
export type ClassMode = (typeof CLASS_MODES)[number];

/**
 * What happens to a credit when a learner misses a class.
 *
 * `burn` is the default because it is the prevailing assumption among gurus, and because it is
 * the option that does not produce an argument about money three months later. A guru who
 * disagrees changes it once per program.
 */
export const SKIP_POLICIES = ['burn', 'no-burn'] as const;
export type SkipPolicy = (typeof SKIP_POLICIES)[number];

export const CreateClassProgramSchema = z.object({
  institutionId: z.string().min(1),
  type: z.enum(PROGRAM_TYPES).default('regular'),
  title: z.string().min(1).max(200).optional(),
  agenda: z.string().max(2000).optional(),
  isGroup: z.boolean().default(false),
  defaultMode: z.enum(CLASS_MODES).default('in-person'),
  defaultTeacherId: z.string().min(1).optional(),
  nominalCount: z.number().int().min(1).max(500).optional(),
  defaultPackSize: z.number().int().min(1).max(500).optional(),
  skipPolicy: z.enum(SKIP_POLICIES).default('burn'),
});

export type CreateClassProgramInput = z.infer<typeof CreateClassProgramSchema>;

export const UpdateClassProgramSchema = CreateClassProgramSchema.partial().omit({
  institutionId: true,
});

export type UpdateClassProgramInput = z.infer<typeof UpdateClassProgramSchema>;

/**
 * Fields a form may empty.
 *
 * Bounded because the list arrives from a request: `clear: ['skipPolicy']` would strip a
 * required attribute that every credit decision reads. Only the two free-text fields a guru can
 * legitimately blank are here.
 */
export const CLEARABLE_PROGRAM_FIELDS = ['title', 'agenda'] as const;
export type ClearableProgramField = (typeof CLEARABLE_PROGRAM_FIELDS)[number];

/**
 * What the roster and the student's card call this program.
 *
 * A regular class has no title on purpose — asking a guru to name her weekly Tuesday lesson is
 * asking her to invent something. The fallback lives here so both apps say the same words.
 */
export function programDisplayTitle(program: { title?: string; type?: ProgramType }): string {
  const title = program.title?.trim();
  if (title) {
    return title;
  }
  return program.type === 'workshop' ? 'Workshop' : 'Weekly class';
}

export function isArchived(program: { archivedAt?: string }): boolean {
  return Boolean(program.archivedAt);
}

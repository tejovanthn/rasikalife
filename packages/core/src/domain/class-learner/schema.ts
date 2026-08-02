import { z } from 'zod';

/**
 * Data minimisation is the schema's job here, not the UI's. A form can be redesigned; a field
 * that never existed cannot quietly start being collected.
 */
export const CreateClassLearnerSchema = z.object({
  institutionId: z.string().min(1),
  firstName: z.string().min(1).max(80),
  // An initial, not a surname. Four characters covers "Iyer" typed by a guru who ignores the
  // label, and stops a full name being pasted in.
  lastInitial: z.string().max(4).optional(),
  isMinor: z.boolean().default(false),
});

export type CreateClassLearnerInput = z.infer<typeof CreateClassLearnerSchema>;

export const UpdateClassLearnerSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastInitial: z.string().max(4).optional(),
  isMinor: z.boolean().optional(),
});

export type UpdateClassLearnerInput = z.infer<typeof UpdateClassLearnerSchema>;

/** "Priya R." — what a roster row and every denormalized `learnerName` shows. */
export function learnerDisplayName(learner: {
  firstName: string;
  lastInitial?: string;
}): string {
  const initial = learner.lastInitial?.trim();
  return initial ? `${learner.firstName.trim()} ${initial}` : learner.firstName.trim();
}

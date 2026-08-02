import { z } from 'zod';

export const TEACHER_ROLES = ['owner', 'teacher'] as const;
export type TeacherRole = (typeof TEACHER_ROLES)[number];

export const AddClassTeacherSchema = z.object({
  institutionId: z.string().min(1),
  userId: z.string().min(1),
  institutionName: z.string().min(1).max(200),
  role: z.enum(TEACHER_ROLES).default('teacher'),
});

export type AddClassTeacherInput = z.infer<typeof AddClassTeacherSchema>;

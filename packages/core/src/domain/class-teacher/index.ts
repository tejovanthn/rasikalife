import { ClassTeacherEntity } from './entity';
import type { ClassTeacher } from './entity';
import type { AddClassTeacherInput } from './schema';

/**
 * `put`, not `upsert`. The row is the pair's complete state, and CLAUDE.md rule 8 applies —
 * an undefined value falls out of an UpdateExpression, so re-adding with a corrected role would
 * leave the old one standing.
 */
export async function addClassTeacher(input: AddClassTeacherInput): Promise<ClassTeacher> {
  const result = await ClassTeacherEntity.put(input).go();
  return result.data as ClassTeacher;
}

/** Every institution this user may teach at — owned or merely joined. */
export async function listUserTeaching(userId: string): Promise<ClassTeacher[]> {
  if (!userId) {
    return [];
  }
  const result = await ClassTeacherEntity.query.byUser({ userId }).go({ pages: 'all' });
  return (result.data as ClassTeacher[]) ?? [];
}

export async function listInstitutionTeachers(institutionId: string): Promise<ClassTeacher[]> {
  const result = await ClassTeacherEntity.query.primary({ institutionId }).go({ pages: 'all' });
  return (result.data as ClassTeacher[]) ?? [];
}

/**
 * The teacher half of `assertClassAccess`.
 *
 * A GetItem on a small row, where the old version loaded the whole institution to read a list
 * off it. Both guards matter: a blank id must never read as "matches everything", which is the
 * failure mode CLAUDE.md rule 9 describes for an index and which applies just as well here.
 */
export async function isClassTeacher(institutionId: string, userId: string): Promise<boolean> {
  if (!institutionId || !userId) {
    return false;
  }
  const result = await ClassTeacherEntity.get({ institutionId, userId }).go();
  return Boolean(result.data);
}

export async function removeClassTeacher(institutionId: string, userId: string): Promise<void> {
  await ClassTeacherEntity.delete({ institutionId, userId }).go();
}

/**
 * Keeps the denormalized institution name in step. The obligation that denormalizing bought —
 * without it a renamed institution keeps its old name in every teacher's context switcher.
 */
export async function cascadeInstitutionNameUpdate(
  institutionId: string,
  institutionName: string
): Promise<number> {
  const rows = await listInstitutionTeachers(institutionId);
  await Promise.all(
    rows.map(row =>
      ClassTeacherEntity.patch({ institutionId, userId: row.userId }).set({ institutionName }).go()
    )
  );
  return rows.length;
}

export { ClassTeacherEntity } from './entity';
export type { ClassTeacher } from './entity';
export { AddClassTeacherSchema, TEACHER_ROLES } from './schema';
export type { AddClassTeacherInput, TeacherRole } from './schema';

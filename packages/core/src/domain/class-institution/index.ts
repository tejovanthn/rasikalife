import { generateId } from '../../utils';
import { isInstitutionTeacher } from './access';
import { ClassInstitutionEntity } from './entity';
import type { ClassInstitution } from './entity';
import type { CreateClassInstitutionInput, UpdateClassInstitutionInput } from './schema';

export async function createClassInstitution(
  input: CreateClassInstitutionInput
): Promise<ClassInstitution> {
  const result = await ClassInstitutionEntity.create({
    id: generateId(),
    name: input.name,
    ownerUserId: input.ownerUserId,
    timezone: input.timezone,
    // The owner is seeded into the teacher list rather than being checked separately on every
    // authorisation call. One list to read means one thing to get wrong, and a substitute
    // teacher added later is then indistinguishable from the owner at the point of use.
    teacherIds: [input.ownerUserId],
  }).go();
  return result.data as ClassInstitution;
}

export async function getClassInstitution(id: string): Promise<ClassInstitution | null> {
  const result = await ClassInstitutionEntity.get({ id }).go();
  return (result.data as ClassInstitution) ?? null;
}

export async function listInstitutionsByOwner(ownerUserId: string): Promise<ClassInstitution[]> {
  const result = await ClassInstitutionEntity.query.byOwner({ ownerUserId }).go({ pages: 'all' });
  return (result.data as ClassInstitution[]) ?? [];
}

/**
 * The guru's first write to anything creates their institution behind their back.
 *
 * Onboarding a guru is "add your first student", not "set up your organisation". The MVP UI
 * never mentions the word, so nothing may ever block on it existing.
 */
export async function ensureClassInstitution(input: {
  ownerUserId: string;
  name: string;
  timezone?: string;
}): Promise<ClassInstitution> {
  const existing = await listInstitutionsByOwner(input.ownerUserId);
  const first = existing[0];
  if (first) {
    return first;
  }
  return createClassInstitution({
    ownerUserId: input.ownerUserId,
    name: input.name,
    timezone: input.timezone ?? 'Asia/Kolkata',
  });
}

export async function updateClassInstitution(
  id: string,
  input: UpdateClassInstitutionInput
): Promise<ClassInstitution | null> {
  const result = await ClassInstitutionEntity.patch({ id }).set(input).go({ response: 'all_new' });
  return (result.data as ClassInstitution) ?? null;
}

export async function addInstitutionTeacher(
  id: string,
  userId: string
): Promise<ClassInstitution | null> {
  const institution = await getClassInstitution(id);
  if (!institution) {
    return null;
  }
  if (isInstitutionTeacher(institution, userId)) {
    return institution;
  }
  const result = await ClassInstitutionEntity.patch({ id })
    .append({ teacherIds: [userId] })
    .go({ response: 'all_new' });
  return (result.data as ClassInstitution) ?? null;
}

export { isInstitutionTeacher } from './access';
export type { ClassInstitutionRef } from './access';
export { ClassInstitutionEntity } from './entity';
export type { ClassInstitution } from './entity';
export { CreateClassInstitutionSchema, UpdateClassInstitutionSchema } from './schema';
export type { CreateClassInstitutionInput, UpdateClassInstitutionInput } from './schema';

import { generateId } from '../../utils';
import {
  addClassTeacher,
  cascadeInstitutionNameUpdate,
  isClassTeacher,
  removeClassTeacher,
} from '../class-teacher';
import { ClassInstitutionEntity } from './entity';
import type { ClassInstitution } from './entity';
import type { CreateClassInstitutionInput, UpdateClassInstitutionInput } from './schema';

/**
 * Creates the institution **and** the owner's teacher row, in that order.
 *
 * Not a transaction, deliberately: the two rows are in different partitions and the failure mode
 * is recoverable and visible. An institution with no teacher row belongs to nobody, so its owner
 * lands back on the "do you teach?" screen and creating again is idempotent from their side —
 * `createClassInstitution` is only reached through a path that first checks they own none.
 *
 * The reverse order would be worse: a teacher row pointing at an institution that does not exist
 * would put a phantom entry in the context switcher that navigates to a 404.
 */
export async function createClassInstitution(
  input: CreateClassInstitutionInput
): Promise<ClassInstitution> {
  const result = await ClassInstitutionEntity.create({
    id: generateId(),
    name: input.name,
    ownerUserId: input.ownerUserId,
    timezone: input.timezone,
  }).go();

  const institution = result.data as ClassInstitution;

  await addClassTeacher({
    institutionId: institution.id,
    userId: input.ownerUserId,
    institutionName: institution.name,
    role: 'owner',
  });

  return institution;
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
 * Idempotent provisioning, used by any teaching write that must not fail on a missing record.
 *
 * `createInstitution` in the router is the deliberate, named path a guru takes through
 * onboarding and refuses a second institution; this is the safety net underneath it.
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
  const institution = (result.data as ClassInstitution) ?? null;

  // The context switcher renders the denormalized name on every page load, so a rename that
  // stopped here would show the old one to every teacher until they were re-added.
  if (institution && input.name !== undefined) {
    await cascadeInstitutionNameUpdate(id, institution.name);
  }

  return institution;
}

export async function addInstitutionTeacher(
  id: string,
  userId: string
): Promise<ClassInstitution | null> {
  const institution = await getClassInstitution(id);
  if (!institution) {
    return null;
  }
  if (await isClassTeacher(id, userId)) {
    return institution;
  }
  await addClassTeacher({
    institutionId: id,
    userId,
    institutionName: institution.name,
    role: 'teacher',
  });
  return institution;
}

/**
 * Removing the owner is refused rather than allowed and repaired.
 *
 * An institution whose owner cannot reach it has a credit ledger nobody can correct, and there
 * is no ownership-transfer path yet to fix it with.
 */
export async function removeInstitutionTeacher(
  id: string,
  userId: string
): Promise<{ removed: boolean; reason?: 'owner' }> {
  const institution = await getClassInstitution(id);
  if (institution?.ownerUserId === userId) {
    return { removed: false, reason: 'owner' };
  }
  await removeClassTeacher(id, userId);
  return { removed: true };
}

export { ClassInstitutionEntity } from './entity';
export type { ClassInstitution } from './entity';
export { CreateClassInstitutionSchema, UpdateClassInstitutionSchema } from './schema';
export type { CreateClassInstitutionInput, UpdateClassInstitutionInput } from './schema';

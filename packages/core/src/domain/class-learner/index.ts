import { generateId } from '../../utils';
import { ClassLearnerEntity } from './entity';
import type { ClassLearner } from './entity';
import type { CreateClassLearnerInput, UpdateClassLearnerInput } from './schema';

export async function createClassLearner(input: CreateClassLearnerInput): Promise<ClassLearner> {
  const result = await ClassLearnerEntity.create({
    id: generateId(),
    institutionId: input.institutionId,
    firstName: input.firstName,
    lastInitial: input.lastInitial,
    isMinor: input.isMinor,
  }).go();
  return result.data as ClassLearner;
}

export async function getClassLearner(id: string): Promise<ClassLearner | null> {
  const result = await ClassLearnerEntity.query.byId({ id }).go();
  return (result.data?.[0] as ClassLearner) ?? null;
}

export async function listInstitutionLearners(institutionId: string): Promise<ClassLearner[]> {
  const result = await ClassLearnerEntity.query.primary({ institutionId }).go({ pages: 'all' });
  const items = (result.data as ClassLearner[]) ?? [];
  return [...items].sort((a, b) => a.firstName.localeCompare(b.firstName));
}

export async function updateClassLearner(
  id: string,
  input: UpdateClassLearnerInput
): Promise<ClassLearner | null> {
  const learner = await getClassLearner(id);
  if (!learner) {
    return null;
  }
  // The primary key is institution-scoped, so the patch needs the institution the byId lookup
  // just supplied. Patching recomputes every key ElectroDB templates, which is why this goes
  // through the entity rather than a raw update (CLAUDE.md rule 7).
  const result = await ClassLearnerEntity.patch({ institutionId: learner.institutionId, id })
    .set(input)
    .go({ response: 'all_new' });
  return (result.data as ClassLearner) ?? null;
}

export { ClassLearnerEntity } from './entity';
export type { ClassLearner } from './entity';
export {
  CreateClassLearnerSchema,
  UpdateClassLearnerSchema,
  learnerDisplayName,
} from './schema';
export type { CreateClassLearnerInput, UpdateClassLearnerInput } from './schema';

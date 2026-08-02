import { generateId } from '../../utils';
import { ClassProgramEntity } from './entity';
import type { ClassProgram } from './entity';
import type { CreateClassProgramInput, UpdateClassProgramInput } from './schema';

export async function createClassProgram(input: CreateClassProgramInput): Promise<ClassProgram> {
  const result = await ClassProgramEntity.create({
    id: generateId(),
    institutionId: input.institutionId,
    type: input.type,
    title: input.title,
    agenda: input.agenda,
    isGroup: input.isGroup,
    defaultMode: input.defaultMode,
    defaultTeacherId: input.defaultTeacherId,
    nominalCount: input.nominalCount,
    defaultPackSize: input.defaultPackSize,
    skipPolicy: input.skipPolicy,
  }).go();
  return result.data as ClassProgram;
}

export async function getClassProgram(id: string): Promise<ClassProgram | null> {
  const result = await ClassProgramEntity.query.byId({ id }).go();
  return (result.data?.[0] as ClassProgram) ?? null;
}

/**
 * Archived programs are hidden from the guru's roster by default and never from a learner's
 * history — see `listLearnerEnrollments`. The session notes are the durable value of the whole
 * product, and they must not disappear behind a toggle the student cannot see.
 */
export async function listInstitutionPrograms(
  institutionId: string,
  options?: { includeArchived?: boolean }
): Promise<ClassProgram[]> {
  const result = await ClassProgramEntity.query.primary({ institutionId }).go({ pages: 'all' });
  const items = (result.data as ClassProgram[]) ?? [];
  const visible = options?.includeArchived ? items : items.filter(p => !p.archivedAt);
  // Newest first. The sort key is `createdAt#id`, so this is the index order reversed.
  return [...visible].reverse();
}

export async function updateClassProgram(
  id: string,
  input: UpdateClassProgramInput
): Promise<ClassProgram | null> {
  const program = await getClassProgram(id);
  if (!program) {
    return null;
  }
  const result = await ClassProgramEntity.patch(primaryKeyOf(program))
    .set(input)
    .go({ response: 'all_new' });
  return (result.data as ClassProgram) ?? null;
}

export async function archiveClassProgram(id: string): Promise<ClassProgram | null> {
  const program = await getClassProgram(id);
  if (!program) {
    return null;
  }
  const result = await ClassProgramEntity.patch(primaryKeyOf(program))
    .set({ archivedAt: new Date().toISOString() })
    .go({ response: 'all_new' });
  return (result.data as ClassProgram) ?? null;
}

export async function unarchiveClassProgram(id: string): Promise<ClassProgram | null> {
  const program = await getClassProgram(id);
  if (!program) {
    return null;
  }
  // `.remove`, not `.set({ archivedAt: undefined })`. ElectroDB drops undefined values out of
  // the UpdateExpression entirely, so the set version leaves the timestamp standing and the
  // program stays archived while the code reads as though it unarchived it. CLAUDE.md rule 8.
  const result = await ClassProgramEntity.patch(primaryKeyOf(program))
    .remove(['archivedAt'])
    .go({ response: 'all_new' });
  return (result.data as ClassProgram) ?? null;
}

/** The sort key carries `createdAt`, so a patch needs more than the id the caller has. */
function primaryKeyOf(program: ClassProgram): {
  institutionId: string;
  createdAt: string;
  id: string;
} {
  return {
    institutionId: program.institutionId,
    createdAt: program.createdAt,
    id: program.id,
  };
}

export { ClassProgramEntity } from './entity';
export type { ClassProgram } from './entity';
export {
  CLASS_MODES,
  CreateClassProgramSchema,
  PROGRAM_TYPES,
  SKIP_POLICIES,
  UpdateClassProgramSchema,
  isArchived,
  programDisplayTitle,
} from './schema';
export type {
  ClassMode,
  CreateClassProgramInput,
  ProgramType,
  SkipPolicy,
  UpdateClassProgramInput,
} from './schema';

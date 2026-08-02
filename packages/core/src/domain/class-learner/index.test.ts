import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ClassLearnerEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    query: { primary: vi.fn(), byId: vi.fn() },
  },
}));

import {
  CreateClassLearnerSchema,
  createClassLearner,
  getClassLearner,
  learnerDisplayName,
  listInstitutionLearners,
  updateClassLearner,
} from '.';
import { ClassLearnerEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const LEARNER = {
  id: 'learn1',
  institutionId: 'inst1',
  firstName: 'Priya',
  isMinor: false,
};

describe('class-learner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a learner', async () => {
    vi.mocked(ClassLearnerEntity.create).mockReturnValue(goResolves(LEARNER) as never);

    await createClassLearner({ institutionId: 'inst1', firstName: 'Priya', isMinor: true });

    expect(ClassLearnerEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Priya', isMinor: true })
    );
  });

  it('reads one through the id index', async () => {
    vi.mocked(ClassLearnerEntity.query.byId).mockReturnValue(goResolves([LEARNER]) as never);

    expect(await getClassLearner('learn1')).toEqual(LEARNER);
    expect(ClassLearnerEntity.query.byId).toHaveBeenCalledWith({ id: 'learn1' });
  });

  it('is null when there is no such learner', async () => {
    vi.mocked(ClassLearnerEntity.query.byId).mockReturnValue(goResolves([]) as never);
    expect(await getClassLearner('nope')).toBeNull();
  });

  it('sorts a roster by first name', async () => {
    vi.mocked(ClassLearnerEntity.query.primary).mockReturnValue(
      goResolves([
        { ...LEARNER, firstName: 'Ravi' },
        { ...LEARNER, firstName: 'Anika' },
      ]) as never
    );

    const result = await listInstitutionLearners('inst1');

    expect(result.map(l => l.firstName)).toEqual(['Anika', 'Ravi']);
  });

  // The primary key is institution-scoped, so a patch needs the institution the byId lookup
  // just supplied — and going through the entity is what recomputes every templated key.
  it('patches with the full composite the sort key needs', async () => {
    vi.mocked(ClassLearnerEntity.query.byId).mockReturnValue(goResolves([LEARNER]) as never);
    const chain: Record<string, unknown> = { go: vi.fn().mockResolvedValue({ data: {} }) };
    chain.set = vi.fn().mockReturnValue(chain);
    vi.mocked(ClassLearnerEntity.patch).mockReturnValue(chain as never);

    await updateClassLearner('learn1', { isMinor: false });

    expect(ClassLearnerEntity.patch).toHaveBeenCalledWith({
      institutionId: 'inst1',
      id: 'learn1',
    });
  });
});

describe('learnerDisplayName', () => {
  it('adds the initial when there is one', () => {
    expect(learnerDisplayName({ firstName: 'Priya', lastInitial: 'R' })).toBe('Priya R');
  });

  it('is just the first name otherwise', () => {
    expect(learnerDisplayName({ firstName: 'Priya' })).toBe('Priya');
    expect(learnerDisplayName({ firstName: 'Priya', lastInitial: '  ' })).toBe('Priya');
  });
});

/**
 * Data minimisation is the schema's job, not the UI's. A form can be redesigned; a field that
 * never existed cannot quietly start being collected. India's DPDP Act treats under-18 data as
 * needing verifiable parental consent, and the cheapest way to stay clear of that is to hold
 * nothing.
 */
describe('CreateClassLearnerSchema', () => {
  it('accepts a first name and nothing else', () => {
    expect(() =>
      CreateClassLearnerSchema.parse({ institutionId: 'inst1', firstName: 'Priya' })
    ).not.toThrow();
  });

  it('defaults isMinor to false rather than guessing', () => {
    const parsed = CreateClassLearnerSchema.parse({ institutionId: 'inst1', firstName: 'Priya' });
    expect(parsed.isMinor).toBe(false);
  });

  it('takes an initial, not a surname', () => {
    expect(() =>
      CreateClassLearnerSchema.parse({
        institutionId: 'inst1',
        firstName: 'Priya',
        lastInitial: 'Raman',
      })
    ).toThrow();
  });

  it('has nowhere to put a birthday, a photo or a phone number', () => {
    const parsed = CreateClassLearnerSchema.parse({
      institutionId: 'inst1',
      firstName: 'Priya',
      dateOfBirth: '2012-04-01',
      photoUrl: 'https://example.com/child.jpg',
      phone: '+919000000000',
      notes: 'Lives at ...',
    } as never);

    expect(parsed).not.toHaveProperty('dateOfBirth');
    expect(parsed).not.toHaveProperty('photoUrl');
    expect(parsed).not.toHaveProperty('phone');
    expect(parsed).not.toHaveProperty('notes');
  });
});

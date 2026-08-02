import { describe, expect, it } from 'vitest';
import { contextCount, parseContext, resolveDestination, serializeContext } from './context';
import type { MyContexts } from './context';

const NOTHING: MyContexts = { teaching: [], learners: [] };
const TEACHES: MyContexts = {
  teaching: [{ institutionId: 'inst1', name: 'Smt Radha', isOwner: true }],
  learners: [],
};
const LEARNS: MyContexts = {
  teaching: [],
  learners: [{ id: 'learn1', name: 'Anika', relation: 'guardian' }],
};
const BOTH: MyContexts = {
  teaching: TEACHES.teaching,
  learners: LEARNS.learners,
};

/**
 * The §A7 matrix, tested directly rather than through the UI. Resolver correctness *is* the
 * change — everything else in the addendum is a screen hanging off it.
 */
describe('resolveDestination', () => {
  it('sends a brand-new account to the chooser', () => {
    expect(resolveDestination(NOTHING, null)).toBe('/welcome');
  });

  it('sends a learner home', () => {
    expect(resolveDestination(LEARNS, null)).toBe('/home');
  });

  it('sends a teacher to the roster', () => {
    expect(resolveDestination(TEACHES, null)).toBe('/teaching');
  });

  /**
   * §A5: a teacher added to an institution they do not own. Nothing distinguishes this case here,
   * and that is the point — `getMyContexts` reads the junction, so ownership never enters into it.
   */
  it('sends a non-owner teacher to the roster too', () => {
    const coTeacher: MyContexts = {
      teaching: [{ institutionId: 'inst1', name: 'Smt Radha', isOwner: false }],
      learners: [],
    };
    expect(resolveDestination(coTeacher, null)).toBe('/teaching');
  });

  it('defaults a both-contexts user to teaching', () => {
    expect(resolveDestination(BOTH, null)).toBe('/teaching');
  });

  it('honours a stored learner context', () => {
    expect(resolveDestination(BOTH, { kind: 'learner', learnerId: 'learn1' })).toBe(
      '/home?learner=learn1'
    );
  });

  it('honours a stored teaching context', () => {
    expect(resolveDestination(BOTH, { kind: 'teaching', institutionId: 'inst1' })).toBe(
      '/teaching'
    );
  });

  /**
   * The guardian whose last learner was removed. Following a stale pointer would land them on a
   * 404 rather than on the screen that explains where their access went.
   */
  it('ignores a stored context the user no longer has', () => {
    expect(resolveDestination(TEACHES, { kind: 'learner', learnerId: 'gone' })).toBe('/teaching');
    expect(resolveDestination(LEARNS, { kind: 'teaching', institutionId: 'gone' })).toBe('/home');
    expect(resolveDestination(NOTHING, { kind: 'learner', learnerId: 'gone' })).toBe('/welcome');
  });

  it('escapes a learner id into the query string', () => {
    const odd: MyContexts = {
      teaching: [],
      learners: [{ id: 'a b&c', name: 'X', relation: 'self' }],
    };
    expect(resolveDestination(odd, { kind: 'learner', learnerId: 'a b&c' })).toBe(
      '/home?learner=a%20b%26c'
    );
  });
});

describe('context cookie round trip', () => {
  it('survives serialize and parse', () => {
    for (const context of [
      { kind: 'teaching', institutionId: 'inst1' },
      { kind: 'learner', learnerId: 'learn1' },
    ] as const) {
      expect(parseContext(serializeContext(context))).toEqual(context);
    }
  });

  // A KSUID contains no colon today, but the parser must not depend on that.
  it('keeps an id containing a colon intact', () => {
    expect(parseContext(serializeContext({ kind: 'learner', learnerId: 'a:b:c' }))).toEqual({
      kind: 'learner',
      learnerId: 'a:b:c',
    });
  });

  it('reads anything unparseable as no stored context', () => {
    expect(parseContext(undefined)).toBeNull();
    expect(parseContext('')).toBeNull();
    expect(parseContext('garbage')).toBeNull();
    expect(parseContext('t:')).toBeNull();
    expect(parseContext('x:inst1')).toBeNull();
  });
});

describe('contextCount', () => {
  it('counts both kinds, so one context means no switcher', () => {
    expect(contextCount(NOTHING)).toBe(0);
    expect(contextCount(TEACHES)).toBe(1);
    expect(contextCount(BOTH)).toBe(2);
  });
});

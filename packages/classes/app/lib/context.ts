/**
 * Which context a signed-in person lands in, and how that survives between visits.
 *
 * A guru is frequently also a learner — in Carnatic music people study under a senior vidwan for
 * decades while teaching their own students. Role is a property of a *relationship*, not of a
 * person, so it can be neither a role on the user nor a separate subdomain. Both contexts live
 * on one origin and this decides which one opens.
 *
 * Pure, so the whole table can be tested without a request.
 */

export type TeachingContext = { institutionId: string; name: string; isOwner: boolean };
export type LearnerContext = { id: string; name: string; relation: string; isMinor?: boolean };

export type MyContexts = {
  teaching: TeachingContext[];
  learners: LearnerContext[];
};

/** What the client stores and the server reads back. */
export type StoredContext =
  | { kind: 'teaching'; institutionId: string }
  | { kind: 'learner'; learnerId: string };

/**
 * A cookie, where §A1 asked for `localStorage`.
 *
 * That paragraph wants two things which `localStorage` cannot both give: resolve server-side and
 * redirect, *and* send a both-contexts user to their last used learner. The server cannot read
 * `localStorage`, so that version must land on `/teaching` first and bounce — which is exactly
 * the flash of the wrong context the same paragraph forbids, and it is worst on the PWA cold
 * start it names as the common entry.
 *
 * A cookie is server-readable, so the redirect is one hop and always right. It is also not a
 * field on the shared `user` entity, which is the thing §A1 actually rules out. The cost is a few
 * bytes on every request to this origin.
 *
 * Versioned in the name: a stored value whose shape changes must not be parsed by new code, and
 * bumping the name is cheaper than a migration when a miss costs one default redirect.
 */
export const CONTEXT_COOKIE = 'rl_ctx_v1';

export function serializeContext(context: StoredContext): string {
  return context.kind === 'teaching' ? `t:${context.institutionId}` : `l:${context.learnerId}`;
}

export function parseContext(value: string | undefined | null): StoredContext | null {
  if (!value) {
    return null;
  }
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  if (!id) {
    return null;
  }
  if (kind === 't') {
    return { kind: 'teaching', institutionId: id };
  }
  if (kind === 'l') {
    return { kind: 'learner', learnerId: id };
  }
  return null;
}

/**
 * The destination table from §A1.
 *
 * | teaches | learns | destination        |
 * |---------|--------|--------------------|
 * | no      | no     | /welcome           |
 * | no      | yes    | /home              |
 * | yes     | no     | /teaching          |
 * | yes     | yes    | last used, else /teaching |
 *
 * A stored context that points at something the user no longer has is ignored rather than
 * followed — that is the guardian whose last learner was removed, and following it would land
 * them on a 404 instead of the screen that explains where their access went.
 */
export function resolveDestination(contexts: MyContexts, stored: StoredContext | null): string {
  const teaches = contexts.teaching.length > 0;
  const learns = contexts.learners.length > 0;

  if (!teaches && !learns) {
    return '/welcome';
  }

  if (stored) {
    if (
      stored.kind === 'teaching' &&
      contexts.teaching.some(t => t.institutionId === stored.institutionId)
    ) {
      return '/teaching';
    }
    if (stored.kind === 'learner' && contexts.learners.some(l => l.id === stored.learnerId)) {
      return `/home?learner=${encodeURIComponent(stored.learnerId)}`;
    }
    // Falls through deliberately. An invalid stored value is not an error, it is a context the
    // user has since lost.
  }

  if (teaches) {
    return '/teaching';
  }

  return '/home';
}

/** Whether the switcher is worth rendering at all. One context means no control. */
export function contextCount(contexts: MyContexts): number {
  return contexts.teaching.length + contexts.learners.length;
}

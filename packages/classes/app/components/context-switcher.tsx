import { Form } from 'react-router';
import type { MyContexts, StoredContext } from '~/lib/context';
import { contextCount, serializeContext } from '~/lib/context';

/**
 * One control for everything the signed-in person can be here.
 *
 * §A2: it *merges* with the learner profile switcher rather than sitting beside it. Two dropdowns
 * — "which app" and "which child" — would ask people to model a distinction they do not have. A
 * guardian thinks in terms of children; a guru thinks in terms of teaching. One list of both is
 * the shortest description of what is available.
 *
 * ## Why this is a disclosure and not a `<select>`
 *
 * It was a `<select>` that submitted its own form on `change`. That is WCAG 3.2.2 On Input, a
 * **Level A** failure: on Windows and in Firefox a keyboard user arrowing through the options
 * fires `change` on each one, so choosing the third child means being navigated to the first two
 * on the way. The `<noscript>` button did not help anybody who had JavaScript.
 *
 * A `<details>` holding one submit button per context needs no JavaScript, navigates only on a
 * deliberate activation, and is reachable by keyboard the same way. It also lets each row carry
 * more than a `<option>` can.
 *
 * Never rendered for a single context, which is nearly everyone: a parent with one child, or an
 * adult student with one `self` row.
 */
export function ContextSwitcher({
  contexts,
  current,
}: {
  contexts: MyContexts;
  current: StoredContext;
}) {
  if (contextCount(contexts) < 2) {
    return null;
  }

  const currentLabel =
    current.kind === 'teaching'
      ? (contexts.teaching.find(t => t.institutionId === current.institutionId)?.name ?? 'Teaching')
      : (contexts.learners.find(l => l.id === current.learnerId)?.name ?? 'My classes');

  const entries: Array<{ key: string; value: StoredContext; label: string }> = [
    ...contexts.teaching.map(teaching => ({
      key: `t-${teaching.institutionId}`,
      value: { kind: 'teaching' as const, institutionId: teaching.institutionId },
      // An owner sees their own arrangement named for what it is; somebody teaching at another
      // guru's school needs to be told whose. §A5.
      label: teaching.isOwner ? 'Teaching' : `Teaching at ${teaching.name}`,
    })),
    ...contexts.learners.map(learner => ({
      key: `l-${learner.id}`,
      value: { kind: 'learner' as const, learnerId: learner.id },
      label: learner.name,
    })),
  ];

  return (
    <details className="relative">
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground">
        <span className="max-w-[8rem] truncate">{currentLabel}</span>
        <span aria-hidden="true">▾</span>
      </summary>

      <Form
        method="post"
        action="/api/context"
        className="absolute right-0 z-40 mt-1 min-w-[12rem] rounded-md border border-border bg-card p-1 shadow-lg"
      >
        <ul>
          {entries.map(entry => {
            const isCurrent = serializeContext(entry.value) === serializeContext(current);
            return (
              <li key={entry.key}>
                <button
                  type="submit"
                  name="context"
                  value={serializeContext(entry.value)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`flex min-h-tap w-full items-center rounded px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isCurrent ? 'font-semibold text-primary' : 'text-card-foreground'
                  }`}
                >
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ul>
      </Form>
    </details>
  );
}

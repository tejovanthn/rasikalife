import { Select } from '@rasika/ui';
import { Form } from 'react-router';
import type { MyContexts } from '~/lib/context';
import { contextCount, serializeContext } from '~/lib/context';

/**
 * One control for everything the signed-in person can be here.
 *
 * §A2: it *merges* with the learner profile switcher rather than sitting beside it. Two dropdowns
 * — "which app" and "which child" — would ask people to model a distinction they do not have. A
 * guardian thinks in terms of children; a guru thinks in terms of teaching. One list of both is
 * the shortest description of what is available.
 *
 * Never rendered for a single context, which is nearly everyone: a parent with one child, or an
 * adult student with one `self` row.
 */
export function ContextSwitcher({
  contexts,
  current,
}: {
  contexts: MyContexts;
  current: { kind: 'teaching'; institutionId: string } | { kind: 'learner'; learnerId: string };
}) {
  if (contextCount(contexts) < 2) {
    return null;
  }

  const value = serializeContext(current);

  return (
    <Form method="post" action="/api/context">
      <label htmlFor="context" className="sr-only">
        Switch between your classes
      </label>
      <Select
        id="context"
        name="context"
        defaultValue={value}
        className="h-tap w-auto max-w-[12rem] text-sm"
        onChange={event => event.currentTarget.form?.requestSubmit()}
      >
        {contexts.teaching.map(teaching => (
          <option
            key={teaching.institutionId}
            value={serializeContext({ kind: 'teaching', institutionId: teaching.institutionId })}
          >
            {/* An owner sees their own arrangement named for what it is; somebody teaching at
                another guru's school needs to be told whose. §A5. */}
            {teaching.isOwner ? 'Teaching' : `Teaching at ${teaching.name}`}
          </option>
        ))}
        {contexts.learners.map(learner => (
          <option
            key={learner.id}
            value={serializeContext({ kind: 'learner', learnerId: learner.id })}
          >
            {learner.name}
          </option>
        ))}
      </Select>
      <noscript>
        <button type="submit" className="min-h-tap px-2 text-sm underline">
          Switch
        </button>
      </noscript>
    </Form>
  );
}

import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from 'react-router';
import { Form, Link, data, useActionData, useLoaderData } from 'react-router';
import { createServerClient } from '~/api.server';
import { Button } from '~/components/ui/button';
import { NOTIFICATIONS_PATH, UNSUBSCRIBE_COPY, unsubscribeMessage } from '~/lib/notifications';

/**
 * One-click unsubscribe, from the email footer and from Gmail's `List-Unsubscribe-Post`.
 * Works signed out: the signed link is the credential (decisions.md #3).
 *
 * GET only reads. A link scanner (a mail provider or a security gateway) opens links before the
 * reader does, so a GET that unsubscribed would unsubscribe people who did nothing. The page
 * shows a button; POST does the work. Gmail's one-click request is a POST to this same URL with
 * `List-Unsubscribe=One-Click`, so it lands in the same action and needs no session or CSRF
 * token. The result is a plain page, never a redirect, since Gmail ignores the body anyway.
 *
 * Never cached: the page is per link, and the loader runs on every request.
 */
const NO_STORE = 'private, no-store';

export const headers: HeadersFunction = () => ({ 'Cache-Control': NO_STORE });

export const meta: MetaFunction = () => [
  { title: 'Unsubscribe - Rasika.life' },
  { name: 'robots', content: 'noindex, nofollow' },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const token = params.token ?? '';
  const client = await createServerClient(request);
  try {
    const found = await client.notify.checkUnsubscribe.query({ token });
    return data({ kind: found?.kind ?? null }, { headers: { 'Cache-Control': NO_STORE } });
  } catch (error) {
    console.error('Unsubscribe check failed:', error);
    return data({ kind: null }, { headers: { 'Cache-Control': NO_STORE } });
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const token = params.token ?? '';
  const client = await createServerClient(request);
  try {
    const result = await client.notify.unsubscribe.mutate({ token });
    return data({ kind: result?.kind ?? null }, { headers: { 'Cache-Control': NO_STORE } });
  } catch (error) {
    console.error('Unsubscribe failed:', error);
    return data({ kind: null }, { status: 500, headers: { 'Cache-Control': NO_STORE } });
  }
}

export default function Unsubscribe() {
  const loaded = useLoaderData<typeof loader>();
  const done = useActionData<typeof action>();

  // After a POST the action's answer wins: the token has been used, so the loader would now
  // call the same link expired.
  const kind = done ? done.kind : loaded.kind;
  const didUnsubscribe = done !== undefined && done.kind !== null;

  return (
    <main className="container mx-auto px-4 py-12 max-w-xl space-y-6">
      {kind === null ? (
        <p>{UNSUBSCRIBE_COPY.expired}</p>
      ) : didUnsubscribe ? (
        <>
          <p>{unsubscribeMessage(kind)}</p>
          <p>
            {UNSUBSCRIBE_COPY.changedMind}{' '}
            <Link to={NOTIFICATIONS_PATH} className="underline">
              {UNSUBSCRIBE_COPY.manage}
            </Link>
          </p>
        </>
      ) : (
        <Form method="post">
          <Button type="submit" className="min-h-11">
            {UNSUBSCRIBE_COPY.confirm}
          </Button>
        </Form>
      )}
      {kind === null && (
        <Link to={NOTIFICATIONS_PATH} className="underline">
          {UNSUBSCRIBE_COPY.manage}
        </Link>
      )}
    </main>
  );
}

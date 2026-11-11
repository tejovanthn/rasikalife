import { Button } from '@rasika/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, data, redirect, useActionData } from 'react-router';
import { useDashboard } from '~/components/dashboard-context';
import { FormError } from '~/components/shell';
import { createServerClient, errorMessage } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SABHA_COPY } from '~/lib/copy';
import { pageMeta } from '~/lib/meta';
import { dashboardPath, isOwner, isTargetType } from '~/lib/sabha';

export const meta = () => pageMeta(SABHA_COPY.tabs.export);

function target(params: LoaderFunctionArgs['params']) {
  const { targetType, id } = params;
  if (!isTargetType(targetType) || !id) throw data(null, { status: 404 });
  return { targetType, targetId: id };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  target(params);
  return {};
}

/**
 * Builds the file and sends the browser to its 5 minute link. `partner.exportFollowers` is the
 * check: it admits an owner of this target and nobody else (not a moderator), and writes the
 * audit row before it returns the link. The form posts with `reloadDocument`, so the browser
 * itself follows the redirect to the file and saves it.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const input = target(params);
  const trpc = await createServerClient(request);
  try {
    const { url } = await trpc.partner.exportFollowers.mutate(input);
    return redirect(url);
  } catch (error) {
    return data({ message: errorMessage(error) }, { status: 400 });
  }
}

export default function Export() {
  const { targetType, targetId, overview } = useDashboard();
  const result = useActionData<typeof action>();

  if (!isOwner(overview.role as 'owner')) {
    return <p>{SABHA_COPY.export.viewerOnly}</p>;
  }

  return (
    <div className="max-w-xl">
      <p className="mb-6">{SABHA_COPY.export.notice(overview.target.name)}</p>
      <Form method="post" reloadDocument action={dashboardPath(targetType, targetId, 'export')}>
        <Button type="submit">{SABHA_COPY.export.download}</Button>
      </Form>
      <div className="mt-3">
        <FormError>{result?.message}</FormError>
      </div>
    </div>
  );
}
